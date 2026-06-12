// ── ESTADO ────────────────────────────────────────────────────────────────────
const TEXTOS_DEFAULT = {
  observacoes: `• Os valores em dólares são apenas para fins de referência. O pagamento deve ser feito em ienes ou em reais (seguindo o câmbio turismo indicado abaixo).\n• Esta cotação foi montada conforme as demandas e sugestões iniciais, podendo ser alterada e personalizada.\n• A compra de ingressos para experiências pode ser adicionada à cotação conforme interesse dos clientes.`,
  condicoes: `• Orçamento válido por 7 dias, sujeito à alteração sem aviso prévio até o efetivo pagamento e emissão.\n• Valores baseados no câmbio turismo.\n• Consulte as regras e penalidades de cancelamento e reembolso.`,
  cancelamentos: `• Até 30 dias antes: devolução integral\n• De 29 a 15 dias: devolução de 50%\n• Menos de 15 dias: não reembolsável`
};

const state = {
  config: { base_usd: 145.00, sugestoes_transportes: [], sugestoes_tours: [], sugestoes_exp: [] },
  orcamentosDB: [],
  orcamento: emptyOrc(),
  transportesDB: [],
  experienciasDB: [],
  atracoesDB: [],
  rotasDB: []
};
window.state = state;

function emptyOrc() {
  return { id: null, orcStatus: 'Pendente', notionClienteId: null, nome: '', cliente: { nome: '', pessoas: '', dataOrcamento: '' }, valoresTour: { '4h': 45000, '6h': 65000, '8h': 85000, '10h': 105000, '12h': 125000 }, estadias: [], consultoria: { ativa: false, valor: 0, descricao: '' }, tours: [], transportes: [], experiencias: [], itensAdicionais: [], textos: {}, criadoEm: null, atualizadoEm: null };
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Mover o editor de cotações para dentro do novo layout 3-pane
  const orcEditor = document.getElementById('page-orcamento');
  const orcWrapper = document.getElementById('orcamentosEditorWrapper');
  if (orcEditor && orcWrapper) {
    orcWrapper.appendChild(orcEditor);
    orcEditor.style.display = 'block';
  }

  await loadConfig();
  await loadDB();
  setupNotion();
  await loadOrcamentos();
  setupNav();
  setupClientesTab();
  setupOrcamento();
  setupBase();
  setupConfig();
  setupPreview();
  setupSync();
  setupMenuCambio();
  updateResumo();
  document.getElementById('clienteDataOrcamento').value = today();
  
  // Auto-load clients on initial page load
  loadClientesTabela();
});

function today() { return new Date().toISOString().split('T')[0]; }
function nowISO() { return new Date().toISOString(); }

// ── RICH TEXT EDITOR (QUILL.JS) UTILS ─────────────────────────────────────────
window.quillEditors = {}; // Store instances globally if needed
function initRichText(elementOrId, placeholder = '') {
  const textarea = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (!textarea) return null;
  
  if (textarea.dataset.quillInitialized) return window.quillEditors[textarea.id || textarea.dataset.quillId];
  textarea.dataset.quillInitialized = 'true';
  const qId = textarea.id || 'quill_' + Math.random().toString(36).substr(2, 9);
  textarea.dataset.quillId = qId;

  // Create Quill container
  const container = document.createElement('div');
  textarea.parentNode.insertBefore(container, textarea.nextSibling);
  textarea.style.display = 'none';

  // Quill config
  const quill = new Quill(container, {
    theme: 'snow',
    placeholder: placeholder || textarea.getAttribute('placeholder') || '',
    modules: {
      toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['clean']
      ]
    }
  });

  // Load existing content (if plain text, it will be wrapped in <p> by Quill automatically, or we can use setContents)
  if (textarea.value) {
    quill.root.innerHTML = textarea.value;
  }

  // Sync Quill changes to hidden textarea so app logic remains unchanged
  quill.on('text-change', function() {
    textarea.value = quill.root.innerHTML;
    // Dispatch input event so that existing 'oninput' handlers trigger
    textarea.dispatchEvent(new Event('input'));
  });

  window.quillEditors[qId] = quill;
  return quill;
}

// ── CONFIG ────────────────────────────────────────────────────────────────────
async function loadConfig() {
  const res = await fetch('/api/config');
  state.config = await res.json();
  document.getElementById('cambioUSD').value = state.config.cambio_jpy_usd || 0.006280;
  document.getElementById('cambioBRL').value = state.config.cambio_jpy_brl || 0.031670;
  if (state.config.cambio_data_ref) {
    document.getElementById('cambioDataRef').textContent = 'Última atualização automática: ' + state.config.cambio_data_ref;
  }
  document.getElementById('sheetsId').value  = state.config.sheets_id || '';
  document.getElementById('sheetsScriptUrl').value = state.config.sheets_script_url || '';
  document.getElementById('abaTransportes').value = state.config.sheets_aba_transportes || 'Transportes';
  document.getElementById('abaExperiencias').value = state.config.sheets_aba_experiencias || 'Experiências';
  document.getElementById('abaAtracoes').value = state.config.sheets_aba_atracoes || 'Atracoes';
  const setText = (id, val) => {
    document.getElementById(id).value = val;
    if (window.quillEditors && window.quillEditors[id]) {
      window.quillEditors[id].root.innerHTML = val;
    }
  };

  setText('textoObservacoes', state.config.texto_observacoes || TEXTOS_DEFAULT.observacoes);
  setText('textoCondicoes', state.config.texto_condicoes || TEXTOS_DEFAULT.condicoes);
  setText('textoCancelamento', state.config.texto_cancelamento || TEXTOS_DEFAULT.cancelamentos);
  setText('sugestoesTours', state.config.sugestoes_tours || '');
  setText('sugestoesTransportes', state.config.sugestoes_transportes || '');
  setText('sugestoesExperiencias', state.config.sugestoes_experiencias || '');

  if (state.config.ultima_sincronizacao)
    document.getElementById('syncStatus').textContent = 'Sync: ' + fmtDate(state.config.ultima_sincronizacao);
}

async function loadDB() {
  const [tRes, eRes, aRes, rRes] = await Promise.all([
    fetch('/api/transportes'),
    fetch('/api/experiencias'),
    fetch('/api/atracoes'),
    fetch('/api/rotas-base')
  ]);
  state.transportesDB = await tRes.json();
  state.experienciasDB = await eRes.json();
  state.atracoesDB = await aRes.json();
  state.rotasDB = await rRes.json();
  renderTabelaTransportes();
  renderTabelaExperiencias();
  renderTabelaAtracoes();
  renderTabelaRotas();
}

// ── ORÇAMENTOS SALVOS ─────────────────────────────────────────────────────────
async function loadOrcamentos() {
  try {
    // Migração transparente de localStorage para o servidor
    const local = localStorage.getItem('heian_orcamentos');
    if (local && local !== '[]') {
      const dbLocal = JSON.parse(local);
      for (const o of dbLocal) {
        await fetch('/api/orcamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
      }
      localStorage.removeItem('heian_orcamentos');
      console.log('Migração de cotações locais concluída.');
    }
    
    const res = await fetch('/api/orcamentos?t=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();
    state.orcamentosDB = Array.isArray(data) ? data : [];
  } catch(e) {
    console.error('Erro ao carregar orçamentos:', e);
    state.orcamentosDB = [];
  }
  renderListaOrcamentos();
}

function saveOrcamentos() { 
  // Função legada mantida vazia para compatibilidade caso seja chamada em outro lugar
}

async function saveOrcamentoToCloud(orc) {
  try {
    const res = await fetch('/api/orcamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orc) });
    if (!res.ok) {
      alert('Erro ao salvar a cotação na nuvem! Verifique sua conexão ou tente novamente.');
      console.error('Falha no POST:', await res.text());
    }
  } catch(e) { 
    console.error('Erro salvar orçamento na nuvem', e); 
    alert('Erro de conexão ao salvar a cotação!');
  }
}

function salvarOrcamentoAtual() {
  const nome = document.getElementById('orcNome').value.trim() || ('Cotação ' + fmtDate(nowISO()));
  const orc = {
    ...state.orcamento,
    id: state.orcamento.id || Date.now(),
    nome,
    cliente: { nome: document.getElementById('clienteNome').value, adultos: document.getElementById('clienteAdultos').value, criancas: document.getElementById('clienteCriancas').value, dataOrcamento: document.getElementById('clienteDataOrcamento').value },
    consultoria: { ativa: document.getElementById('consultoriaToggle').checked, valor: parseFloat(document.getElementById('consultoriaValor').value) || 0, descricao: document.getElementById('consultoriaDesc').value },
    statusVenda: document.getElementById('orcStatus') ? document.getElementById('orcStatus').value : 'Pendente',
    atualizadoEm: nowISO(),
    criadoEm: state.orcamento.criadoEm || nowISO()
  };
  const idx = state.orcamentosDB.findIndex(o => o.id === orc.id);
  if (idx > -1) state.orcamentosDB[idx] = orc;
  else state.orcamentosDB.unshift(orc);
  state.orcamento = orc;
  
  saveOrcamentoToCloud(orc);
  
  renderListaOrcamentos();
  document.getElementById('orcTitulo').textContent = nome;
  showToast('Cotação salva!');
}

let _autoSaveTimer = null;
function autoSave() {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => {
    syncDOMToState();
    const nome = document.getElementById('orcNome').value.trim()
      || document.getElementById('clienteNome').value.trim()
      || 'Rascunho';
    const temConteudo = state.orcamento.tours.length || state.orcamento.transportes.length
      || state.orcamento.experiencias.length || state.orcamento.estadias.length
      || document.getElementById('clienteNome').value.trim();
    if (!temConteudo) return;

    const orc = {
      ...state.orcamento,
      id: state.orcamento.id || Date.now(),
      nome,
      cliente: {
        nome: document.getElementById('clienteNome').value,
        adultos: document.getElementById('clienteAdultos').value,
        criancas: document.getElementById('clienteCriancas').value,
        dataOrcamento: document.getElementById('clienteDataOrcamento').value
      },
      consultoria: {
        ativa: document.getElementById('consultoriaToggle').checked,
        valor: parseFloat(document.getElementById('consultoriaValor').value) || 0,
        descricao: document.getElementById('consultoriaDesc').value
      },
      statusVenda: document.getElementById('orcStatus') ? document.getElementById('orcStatus').value : 'Pendente',
      atualizadoEm: nowISO(),
      criadoEm: state.orcamento.criadoEm || nowISO(),
      roteiroVinculado: document.getElementById('orcRoteiroVinculado')?.value || '',
      orcRoteiroVinculado: document.getElementById('orcRoteiroVinculado')?.value || ''
    };
    const idx = state.orcamentosDB.findIndex(o => o.id === orc.id);
    if (idx > -1) state.orcamentosDB[idx] = orc;
    else state.orcamentosDB.unshift(orc);
    state.orcamento = orc;
    saveOrcamentoToCloud(orc);
    renderListaOrcamentos();
    const ind = document.getElementById('autoSaveIndicator');
    if (ind) { ind.textContent = 'Salvo automaticamente'; ind.style.opacity = '1'; setTimeout(()=>{ind.style.opacity='0.4';}, 1500); }
  }, 800);
}

function abrirOrcamento(id, directEdit = false) {
  if (typeof navToPage === 'function') navToPage(directEdit ? 'orcamento' : 'meus');
  localStorage.setItem('heian_last_orcamento_id', id);
  const orc = state.orcamentosDB.find(o => o.id === id);
  if (!orc) return;
  state.orcamento = JSON.parse(JSON.stringify(orc));
  if (!state.orcamento.itensAdicionais) state.orcamento.itensAdicionais = [];
  document.getElementById('orcNome').value = orc.nome || '';
  const notionCli = orc.notionClienteId && typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === orc.notionClienteId) : null;
  document.getElementById('clienteNome').value = notionCli ? notionCli.nome : (orc.cliente?.nome || '');
  document.getElementById('clienteAdultos').value = notionCli ? notionCli.adultos : (orc.cliente?.adultos || '2');
  document.getElementById('clienteCriancas').value = notionCli ? notionCli.criancas : (orc.cliente?.criancas || '0');
  
  const temCliente = !!orc.notionClienteId;
  const lockedStyle = temCliente ? 'background:#f1f5f9; cursor:not-allowed' : '';
  const btnEditarCot = document.getElementById('btnEditarClienteCotacao');
  if(btnEditarCot) btnEditarCot.innerHTML = temCliente ? '👤 Editar Cliente' : '💾 Salvar Cliente no Notion';
  ['clienteNome', 'clienteAdultos', 'clienteCriancas'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.readOnly = temCliente; el.style.cssText = lockedStyle; }
  });
  document.getElementById('clienteDataOrcamento').value = orc.cliente?.dataOrcamento || today();

  if (!state.orcamento.valoresTour) state.orcamento.valoresTour = {};
  const defs = { '4h': 45000, '6h': 65000, '8h': 85000, '10h': 105000, '12h': 125000 };
  ['4h','6h','8h','10h','12h'].forEach(k => {
    if (!state.orcamento.valoresTour[k] || state.orcamento.valoresTour[k] === 0) {
      state.orcamento.valoresTour[k] = defs[k];
    }
  });

  document.getElementById('baseTour4h').value = state.orcamento.valoresTour['4h'];
  document.getElementById('baseTour6h').value = state.orcamento.valoresTour['6h'];
  document.getElementById('baseTour8h').value = state.orcamento.valoresTour['8h'];
  document.getElementById('baseTour10h').value = state.orcamento.valoresTour['10h'];
  document.getElementById('baseTour12h').value = state.orcamento.valoresTour['12h'];
  
  if (document.getElementById('orcRoteiroVinculado')) {
    const sel = document.getElementById('orcRoteiroVinculado');
    const linked = orc.orcRoteiroVinculado || orc.roteiroVinculado || '';
    if (linked && !Array.from(sel.options).some(o => o.value === linked)) {
      sel.add(new Option(linked, linked));
    }
    sel.value = linked;
  }

  if (document.getElementById('orcStatus')) {
    document.getElementById('orcStatus').value = orc.statusVenda || 'Pendente';
  }
  document.getElementById('orcTitulo').textContent = orc.nome || 'Cotação';
  const consAtiva = orc.consultoria?.ativa || false;
  document.getElementById('consultoriaToggle').checked = consAtiva;
  document.getElementById('consultoriaFields').classList.toggle('hidden', !consAtiva);
  document.getElementById('consultoriaValor').value = orc.consultoria?.valor || '';
  document.getElementById('consultoriaDesc').value  = orc.consultoria?.descricao || '';
  if (document.getElementById('orcRoteiroVinculado')) {
    document.getElementById('orcRoteiroVinculado').value = orc.orcRoteiroVinculado || orc.roteiroVinculado || '';
  }
  
  const btnIr = document.getElementById('btnIrParaRoteiro');
  if (btnIr) {
    if (orc.orcRoteiroVinculado) {
      btnIr.style.display = 'inline-block';
      btnIr.onclick = () => {
        navToPage('roteiros');
        const sel = document.getElementById('selectRoteiroBase');
        if (sel) {
          sel.value = orc.orcRoteiroVinculado;
          sel.dispatchEvent(new Event('change'));
        }
      };
    } else {
      btnIr.style.display = 'none';
    }
  }

  preencherTextosForm(orc.textos || {});
  renderEstadiasReadOnlyForm(); renderToursForm(); renderTransportesForm(); renderExperienciasForm(); renderItensAdicionaisForm();
  updateResumo();
  document.getElementById('orcamentosEmptyState').style.display = 'none';
  
  if (directEdit) {
    document.getElementById('orcamentosPreviewWrapper').style.display = 'none';
    document.getElementById('orcamentosEditorWrapper').style.display = 'block';
  } else {
    document.getElementById('orcamentosEditorWrapper').style.display = 'none';
    document.getElementById('orcamentosPreviewWrapper').style.display = 'block';
    renderPreview();
  }
  
  // Atualiza visual selection na lista de forma performática
  const listContainer = document.getElementById('orcamentosLista');
  if (listContainer) {
    listContainer.querySelectorAll('.list-card').forEach(card => {
      if (card.dataset.id === String(id)) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }
  
  if (state.orcamento.notionClienteId && typeof syncClienteAtivo === 'function') {
      syncClienteAtivo(state.orcamento.notionClienteId);
  }
}

function novoOrcamento() {
  localStorage.removeItem('heian_last_orcamento_id');
  state.orcamento = emptyOrc();
  
  const btnIr = document.getElementById('btnIrParaRoteiro');
  if (btnIr) btnIr.style.display = 'none';

  document.getElementById('orcNome').value = '';
  document.getElementById('clienteNome').value = '';
  document.getElementById('clienteAdultos').value = '2';
  document.getElementById('clienteCriancas').value = '0';
  
  ['clienteNome', 'clienteAdultos', 'clienteCriancas'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.readOnly = false; el.style.cssText = ''; }
  });
  document.getElementById('clienteDataOrcamento').value = today();
  const btnEditarCot = document.getElementById('btnEditarClienteCotacao');
  if(btnEditarCot) btnEditarCot.innerHTML = '💾 Salvar Cliente no Notion';
  
  if (!state.orcamento.valoresTour) state.orcamento.valoresTour = {};
  const defs = { '4h': 45000, '6h': 65000, '8h': 85000, '10h': 105000, '12h': 125000 };
  ['4h','6h','8h','10h','12h'].forEach(k => {
    if (!state.orcamento.valoresTour[k] || state.orcamento.valoresTour[k] === 0) {
      state.orcamento.valoresTour[k] = defs[k];
    }
  });

  document.getElementById('baseTour4h').value = state.orcamento.valoresTour['4h'];
  document.getElementById('baseTour6h').value = state.orcamento.valoresTour['6h'];
  document.getElementById('baseTour8h').value = state.orcamento.valoresTour['8h'];
  document.getElementById('baseTour10h').value = state.orcamento.valoresTour['10h'];
  document.getElementById('baseTour12h').value = state.orcamento.valoresTour['12h'];
  
  document.getElementById('orcTitulo').textContent = 'Nova Cotação';
  document.getElementById('consultoriaToggle').checked = false;
  document.getElementById('consultoriaFields').classList.add('hidden');
  document.getElementById('consultoriaValor').value = '';
  document.getElementById('consultoriaDesc').value = '';
  if (document.getElementById('orcRoteiroVinculado')) {
    document.getElementById('orcRoteiroVinculado').value = '';
  }
  renderEstadiasReadOnlyForm(); renderToursForm(); renderTransportesForm(); renderExperienciasForm(); renderItensAdicionaisForm();
  updateResumo();
  navToPage('orcamento');
}

function renderListaOrcamentos(filterQuery = '') {
  const cont = document.getElementById('orcamentosLista');
  if (!state.orcamentosDB.length) { cont.innerHTML = '<div class="orc-empty">Nenhuma cotação salva ainda.</div>'; return; }
  cont.innerHTML = '<div class="orc-list">' + state.orcamentosDB.map(orc => {
    const totalTours = (orc.tours||[]).reduce((s,t)=>s+(t.valor||0),0);
    const totalTransp = (orc.transportes||[]).reduce((s,t)=>s+calcTotalTransporte(t),0);
    const totalExp = (orc.experiencias||[]).reduce((s,e)=>s+calcTotalExp(e),0);
    const totalItens = (orc.itensAdicionais||[]).reduce((s,i)=>s+(i.valor||0),0);
    const cons = orc.consultoria?.ativa ? (orc.consultoria.valor||0) : 0;
    const total = totalTours+totalTransp+totalExp+totalItens+cons;
    
    let txtPessoas = '';
    if (orc.cliente?.adultos) txtPessoas += `${orc.cliente.adultos} Ad`;
    if (orc.cliente?.criancas > 0) txtPessoas += `, ${orc.cliente.criancas} Cr`;
    if (orc.cliente?.pessoas) txtPessoas = orc.cliente.pessoas; // backward compatibility
    
    
    const isSelected = state.orcamento && state.orcamento.id === orc.id ? 'selected' : '';
    return `<div class="list-card ${isSelected}" 
                 data-id="${orc.id}"
                 onclick="abrirOrcamento(${orc.id}, false)" 
                 onmouseenter="previewOrcamento(${orc.id})">
      <div class="list-card-title-row" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
        <div class="list-card-title" style="color:var(--crimson); font-weight: 600; margin-bottom: 0;">${orc.nome||'Sem nome'}</div>
        <button class="btn-card-edit-minimalist" onclick="event.stopPropagation(); abrirOrcamento(${orc.id}, true)" title="Editar">
          ✏️
        </button>
      </div>
      <div class="list-card-subtitle" style="margin-top: 4px;">${orc.cliente?.nome||''} ${txtPessoas?'· '+txtPessoas:''}</div>
      <div class="list-card-meta">
        <span>${fmtDate(orc.atualizadoEm)}</span>
        <span>¥${fmt(total)}</span>
      </div>
    </div>`;
  }).join('') + '</div>';
}

function excluirOrcamento(id) {
  if (!confirm('Excluir este orçamento?')) return;
  state.orcamentosDB = state.orcamentosDB.filter(o => o.id !== id);
  renderListaOrcamentos();
  fetch(`/api/orcamentos/${id}`, { method: 'DELETE' }).catch(e => console.error('Erro excluir na nuvem', e));
}

// ── NAV & HISTORY API ──────────────────────────────────────────────────────────
function navToPage(pg) {
  let targetPg = pg;
  if (pg === 'orcamento') {
    targetPg = 'meus';
  }
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const navItem = document.querySelector(`[data-page="${pg}"]`);
  if (navItem) navItem.classList.add('active');
  const pageEl = document.getElementById('page-' + targetPg);
  if (pageEl) pageEl.classList.add('active');
  
  if (pg === 'orcamento') {
    document.getElementById('orcamentosEmptyState').style.display = 'none';
    document.getElementById('orcamentosPreviewWrapper').style.display = 'none';
    document.getElementById('orcamentosEditorWrapper').style.display = 'block';
  }
  
  if (targetPg === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
  if (targetPg === 'roteiros' && typeof fecharEditorRoteiro === 'function') fecharEditorRoteiro();
  if (targetPg === 'calendario' && typeof renderCalendario === 'function') renderCalendario();
  if (targetPg === 'colaboradores' && typeof setupColaboradoresTab === 'function') setupColaboradoresTab();
}

function setupMenuCambio() {
  const iJ = document.getElementById('menuCambioJPY');
  const iB = document.getElementById('menuCambioBRL');
  const iU = document.getElementById('menuCambioUSD');
  const btn = document.getElementById('btnRefreshCambioMenu');
  if (!iJ || !iB || !iU || !btn) return;
  
  const clear = () => { iJ.value = ''; iB.value = ''; iU.value = ''; };
  btn.addEventListener('click', clear);
  
  const getB = () => parseFloat(state.config.cambio_jpy_brl) || 0.031670;
  const getU = () => parseFloat(state.config.cambio_jpy_usd) || 0.006280;

  iJ.addEventListener('input', () => {
    const v = parseFloat(iJ.value);
    if (isNaN(v)) { iB.value = ''; iU.value = ''; return; }
    iB.value = (v * getB()).toFixed(2);
    iU.value = (v * getU()).toFixed(2);
  });
  
  iB.addEventListener('input', () => {
    const v = parseFloat(iB.value);
    const taxaB = getB();
    if (isNaN(v) || !taxaB) { iJ.value = ''; iU.value = ''; return; }
    const jpy = v / taxaB;
    iJ.value = jpy.toFixed(0);
    iU.value = (jpy * getU()).toFixed(2);
  });
  
  iU.addEventListener('input', () => {
    const v = parseFloat(iU.value);
    const taxaU = getU();
    if (isNaN(v) || !taxaU) { iJ.value = ''; iB.value = ''; return; }
    const jpy = v / taxaU;
    iJ.value = jpy.toFixed(0);
    iB.value = (jpy * getB()).toFixed(2);
  });

  const btnToggle = document.getElementById('btnToggleMenuCambioConfig');
  const panel = document.getElementById('menuCambioConfig');
  if (btnToggle && panel) {
    btnToggle.addEventListener('click', () => {
      if (panel.style.display === 'none') {
        panel.style.display = 'flex';
        document.getElementById('menuCambioRateBRL').value = state.config.cambio_jpy_brl || '';
        document.getElementById('menuCambioRateUSD').value = state.config.cambio_jpy_usd || '';
      } else {
        panel.style.display = 'none';
      }
    });
  }

  const btnFetch = document.getElementById('btnMenuCambioFetch');
  const btnSave = document.getElementById('btnMenuCambioSave');
  const status = document.getElementById('menuCambioStatus');

  if (btnFetch) {
    btnFetch.addEventListener('click', async () => {
      btnFetch.textContent = '...'; btnFetch.disabled = true; status.textContent = '';
      try {
        const res = await fetch('/api/cambio');
        const data = await res.json();
        if (data.ok) {
          document.getElementById('menuCambioRateBRL').value = data.cambio_jpy_brl.toFixed(6);
          document.getElementById('menuCambioRateUSD').value = data.cambio_jpy_usd.toFixed(6);
          const cUSD = document.getElementById('cambioUSD'); if(cUSD) cUSD.value = data.cambio_jpy_usd.toFixed(6);
          const cBRL = document.getElementById('cambioBRL'); if(cBRL) cBRL.value = data.cambio_jpy_brl.toFixed(6);
          
          const dataRef = new Date(data.data).toLocaleDateString('pt-BR');
          const dados = { cambio_jpy_usd: data.cambio_jpy_usd, cambio_jpy_brl: data.cambio_jpy_brl, cambio_data_ref: dataRef };
          await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});
          Object.assign(state.config, dados);
          const cRef = document.getElementById('cambioDataRef');
          if (cRef) cRef.textContent = 'Última atualização automática: ' + dataRef;
          
          status.textContent = 'Atualizado!';
          updateResumo();
          clear();
        } else {
          status.textContent = 'Erro ao buscar.';
        }
      } catch(e) { status.textContent = 'Erro de rede.'; }
      btnFetch.textContent = '🌍 Do Dia'; btnFetch.disabled = false;
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const vBRL = parseFloat(document.getElementById('menuCambioRateBRL').value);
      const vUSD = parseFloat(document.getElementById('menuCambioRateUSD').value);
      if (isNaN(vBRL) || isNaN(vUSD)) { status.textContent = 'Inválido'; return; }
      
      btnSave.textContent = '...'; btnSave.disabled = true;
      const dados = { cambio_jpy_usd: vUSD, cambio_jpy_brl: vBRL };
      try {
        await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});
        Object.assign(state.config, dados);
        const cUSD = document.getElementById('cambioUSD'); if(cUSD) cUSD.value = vUSD;
        const cBRL = document.getElementById('cambioBRL'); if(cBRL) cBRL.value = vBRL;
        status.textContent = 'Salvo!';
        updateResumo();
        clear();
      } catch(e) { status.textContent = 'Erro ao salvar.'; }
      btnSave.textContent = '💾 Salvar'; btnSave.disabled = false;
      setTimeout(() => { panel.style.display = 'none'; status.textContent = ''; }, 1500);
    });
  }
}

function setupNav() {
  document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', e => {
    e.preventDefault();
    const pg = item.dataset.page;
    history.pushState({ page: pg }, '', '#' + pg);
    if (pg === 'orcamento') {
      novoOrcamento();
      navToPage('orcamento');
    } else {
      navToPage(pg);
    }
  }));
  const btnNovoOrcList = document.getElementById('btnNovoOrcList');
  if (btnNovoOrcList) {
    btnNovoOrcList.addEventListener('click', () => {
      novoOrcamento();
      navToPage('orcamento');
      document.getElementById('orcamentosEmptyState').style.display = 'none';
      document.getElementById('orcamentosPreviewWrapper').style.display = 'none';
      document.getElementById('orcamentosEditorWrapper').style.display = 'block';
      renderListaOrcamentos();
    });
  }

  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.page) {
      if (e.state.page === 'orcamento') {
        novoOrcamento();
        navToPage('orcamento');
      } else {
        navToPage(e.state.page);
      }
    } else {
      navToPage('orcamento');
    }
  });

  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById('page-' + hash)) {
    history.replaceState({ page: hash }, '', '#' + hash);
    if (hash === 'orcamento') {
      const lastId = localStorage.getItem('heian_last_orcamento_id');
      if (lastId) {
        const idNum = parseInt(lastId, 10);
        setTimeout(() => {
          abrirOrcamento(idNum, true);
          navToPage('orcamento');
        }, 100); 
      } else {
        novoOrcamento();
        navToPage('orcamento');
      }
    } else navToPage(hash);
  } else {
    history.replaceState({ page: 'dashboard' }, '', '#dashboard');
    navToPage('dashboard');
  }
}

// ── ORÇAMENTO SETUP ───────────────────────────────────────────────────────────

// ── TEXTOS CUSTOMIZÁVEIS ──────────────────────────────────────────────────────
function toggleCardTextos() {
  const form = document.getElementById('textosCustomForm');
  const btn = document.getElementById('btnToggleTextos');
  const hidden = form.classList.toggle('hidden');
  btn.textContent = hidden ? 'Expandir' : 'Recolher';
}

function txVal(id, fallback) {
  const el = document.getElementById(id);
  return (el && el.value.trim()) ? el.value.trim() : fallback;
}

function preencherTextosForm(textos) {
  const t = textos || {};
  const campos = {
    tx_coverLabel: t.coverLabel || '', tx_coverSub: t.coverSub || '',
    tx_secEstadias: t.secEstadias || '', tx_secTransp: t.secTransp || '',
    tx_secTours: t.secTours || '', tx_secExp: t.secExp || '',
    tx_secResumo: t.secResumo || '', tx_lblTours: t.lblTours || '',
    tx_lblTransp: t.lblTransp || '', tx_lblExp: t.lblExp || '',
    tx_lblCons: t.lblCons || '', tx_lblTotal: t.lblTotal || '',
    tx_lblSinal: t.lblSinal || '', tx_secObs: t.secObs || '',
    tx_secCond: t.secCond || '', tx_secCanc: t.secCanc || ''
  };
  Object.entries(campos).forEach(([id, val]) => {
    const el = document.getElementById(id); if (el) el.value = val;
  });
}

function coletarTextos() {
  return {
    coverLabel: document.getElementById('tx_coverLabel')?.value.trim() || '',
    coverSub:   document.getElementById('tx_coverSub')?.value.trim() || '',
    secEstadias:document.getElementById('tx_secEstadias')?.value.trim() || '',
    secTransp:  document.getElementById('tx_secTransp')?.value.trim() || '',
    secTours:   document.getElementById('tx_secTours')?.value.trim() || '',
    secExp:     document.getElementById('tx_secExp')?.value.trim() || '',
    secResumo:  document.getElementById('tx_secResumo')?.value.trim() || '',
    lblTours:   document.getElementById('tx_lblTours')?.value.trim() || '',
    lblTransp:  document.getElementById('tx_lblTransp')?.value.trim() || '',
    lblExp:     document.getElementById('tx_lblExp')?.value.trim() || '',
    lblCons:    document.getElementById('tx_lblCons')?.value.trim() || '',
    lblTotal:   document.getElementById('tx_lblTotal')?.value.trim() || '',
    lblSinal:   document.getElementById('tx_lblSinal')?.value.trim() || '',
    secObs:     document.getElementById('tx_secObs')?.value.trim() || '',
    secCond:    document.getElementById('tx_secCond')?.value.trim() || '',
    secCanc:    document.getElementById('tx_secCanc')?.value.trim() || ''
  };
}

function setupOrcamento() {
  document.getElementById('btnAddEstadia')?.addEventListener('click', () => addEstadia());
  document.getElementById('btnAddTour')?.addEventListener('click', () => addTour());
  document.getElementById('btnAddTransporte')?.addEventListener('click', () => addTransporte());
  document.getElementById('btnAddExperiencia')?.addEventListener('click', () => addExperiencia());
  document.getElementById('btnAddItemAdicional')?.addEventListener('click', () => addItemAdicional());
  const _btnSalvar = document.getElementById('btnSalvarOrc');
  if (_btnSalvar) _btnSalvar.addEventListener('click', salvarOrcamentoAtual);
  document.getElementById('clienteAdultos')?.addEventListener('change', propagarPessoas);
  document.getElementById('clienteCriancas')?.addEventListener('change', propagarPessoas);
  document.getElementById('consultoriaToggle')?.addEventListener('change', e => {
    document.getElementById('consultoriaFields')?.classList.toggle('hidden', !e.target.checked);
    updateResumo();
  });
  document.getElementById('consultoriaValor')?.addEventListener('input', updateResumo);
  // Auto-save quando dados do cliente mudam
  ['orcNome','clienteNome','clienteAdultos','clienteCriancas','clienteDataOrcamento','consultoriaDesc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', autoSave);
  });
}

// ── ESTADIAS ──────────────────────────────────────────────────────────────────
function addEstadia() {
  state.orcamento.estadias.push({ id: Date.now(), cidade: '', dataInicio: '', dataFim: '', hotel: '' });
  renderEstadiasForm();
}

function updBaseTour(horas, val) {
  if (!state.orcamento.valoresTour) state.orcamento.valoresTour = { '4h': 45000, '6h': 65000, '8h': 85000, '10h': 105000, '12h': 125000 };
  const numVal = parseFloat(val) || 0;
  state.orcamento.valoresTour[horas] = numVal;
  
  let changed = false;
  state.orcamento.tours.forEach(t => {
    if (t.duracao === horas) {
      t.valor = numVal;
      changed = true;
    }
  });
  if (changed) {
    renderToursForm();
    updateResumo();
  }
  autoSave();
}

function renderEstadiasReadOnlyForm() {
  const cont = document.getElementById('estadiasReadOnlyList');
  if (!cont) return;
  if (!state.orcamento.estadias || state.orcamento.estadias.length === 0) {
    cont.innerHTML = '<p class="hint" style="margin:0;">Nenhuma estadia. Edite o cliente na aba "Clientes (Notion)" para adicionar estadias.</p>';
    return;
  }
  let html = '';
  state.orcamento.estadias.forEach((est, i) => {
    const dates = (est.dataInicio || est.dataFim) ? `${fmtDataBR(est.dataInicio)} – ${fmtDataBR(est.dataFim)}` : '';
    html += `<div style="margin-bottom: 8px;"><strong>Estadia ${i+1}:</strong> ${est.cidade} ${est.hotel ? '- '+est.hotel : ''} ${dates ? '('+dates+')' : ''}</div>`;
  });
  cont.innerHTML = html;
}

function renderEstadiasForm() {
  const cont = document.getElementById('estadiasList');
  cont.innerHTML = '';
  currentEditingEstadias.forEach((est, i) => {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div class="item-row-header">
        <span class="item-row-num">Estadia ${i+1}</span>
        <button class="btn-remove" onclick="rmEstadia(${est.id})">✕</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Cidade</label><input type="text" value="${est.cidade}" placeholder="Ex: Tokyo" oninput="updEstadia(${est.id},'cidade',this.value)"></div>
        <div class="field"><label>Data Início</label><input type="date" value="${est.dataInicio}" oninput="updEstadia(${est.id},'dataInicio',this.value)"></div>
        <div class="field"><label>Data Fim</label><input type="date" value="${est.dataFim}" oninput="updEstadia(${est.id},'dataFim',this.value)"></div>
        <div class="field"><label>Hotel</label><input type="text" value="${est.hotel}" placeholder="Ex: The Celestine Tokyo" oninput="updEstadia(${est.id},'hotel',this.value)"></div>
      </div>`;
    cont.appendChild(div);
  });
}
function rmEstadia(id) { currentEditingEstadias = currentEditingEstadias.filter(e => e.id !== id); renderEstadiasForm(); }
function updEstadia(id, f, v) { const e = currentEditingEstadias.find(x => x.id === id); if (e) e[f] = v; }

// ── TOURS ─────────────────────────────────────────────────────────────────────
// CORREÇÃO: sem re-render durante digitação — só atualiza estado e subtotal
function calcTotalTour(t) {
  let base = parseFloat(t.valor) || 0;
  if (t.descontoAtivo && t.desconto > 0) base = base - (base * (t.desconto / 100));
  return base;
}
function addTour() {
  const val6h = (state.orcamento.valoresTour && state.orcamento.valoresTour['6h']) || 65000;
  state.orcamento.tours.push({ id: Date.now(), data: '', descricao: '', pontos: '', duracao: '6h', valor: val6h, descontoAtivo: false, desconto: 5, observacao: '' });
  renderToursForm(); updateResumo();
}
function renderToursForm() {
  const cont = document.getElementById('toursList');
  cont.innerHTML = '';
  state.orcamento.tours.forEach((t, i) => {
    let valorFinal = parseFloat(t.valor) || 0;
    if (t.descontoAtivo && t.desconto > 0) {
      valorFinal = valorFinal - (valorFinal * (t.desconto / 100));
    }
    
    const div = document.createElement('div');
    div.className = 'item-row';
    div.dataset.itemId = t.id;
    div.innerHTML = `
      <div class="item-row-header">
        <span class="item-row-num">Tour ${i+1}</span>
        <span class="item-subtotal" id="subtotal-tour-${t.id}">¥${fmt(valorFinal)} · ${fmtUSD(valorFinal * getUSD())}</span>
        <button class="btn-remove" onclick="rmTour(${t.id})">✕</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Data</label>
          <input type="date" value="${t.data}" onchange="updTourField(${t.id},'data',this.value)"></div>
        <div class="field"><label>Descrição</label>
          <input type="text" value="${t.descricao}" placeholder="Ex: Tour em Tokyo" oninput="updTourField(${t.id},'descricao',this.value)"></div>
        <div class="field full-width"><label>Pontos Visitados (um por linha)</label>
          <textarea id="tour-pontos-${t.id}" rows="3" placeholder="Asakusa&#10;Ueno Park&#10;Yanaka Ginza" oninput="updTourField(${t.id},'pontos',this.value)">${t.pontos}</textarea></div>
        <div class="field"><label>Duração do Tour</label>
          <select onchange="updTourDuracao(${t.id}, this.value)">
            <option value="" ${!t.duracao ? 'selected' : ''}>-- Selecione --</option>
            <option value="4h" ${t.duracao==='4h' ? 'selected' : ''}>4 horas</option>
            <option value="6h" ${t.duracao==='6h' ? 'selected' : ''}>6 horas</option>
            <option value="8h" ${t.duracao==='8h' ? 'selected' : ''}>8 horas</option>
            <option value="10h" ${t.duracao==='10h' ? 'selected' : ''}>10 horas</option>
            <option value="12h" ${t.duracao==='12h' ? 'selected' : ''}>12 horas</option>
          </select>
        </div>
        <div class="field"><label>Valor do Tour ¥</label>
          <input type="number" id="tour-valor-${t.id}" value="${t.valor||''}" placeholder="Ex: 55000"
            oninput="updTourNum(${t.id},'valor',this.value)"
            onblur="finalizarNum(${t.id},'tour','valor',this.value)"></div>
        <div class="field">
          <label>Desconto Aplicado</label>
          <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
            <label class="toggle"><input type="checkbox" ${t.descontoAtivo?'checked':''} onchange="updTourToggleDesconto(${t.id},this.checked)"><span class="toggle-slider"></span></label>
            <input type="number" value="${t.desconto||''}" placeholder="%" min="0" max="100"
              style="width:80px;padding:8px 10px;border:1px solid var(--border-dk);border-radius:4px;font-family:var(--ff-num);font-size:13px;outline:none"
              ${t.descontoAtivo?'':'disabled'}
              oninput="updTourNum(${t.id},'desconto',this.value)">
            <span style="font-size:12px;color:var(--ink-lt)">%</span>
          </div>
        </div>
        <div class="field full-width"><label>Observações</label>
          <input type="text" id="obs-tour-${t.id}" value="${t.observacao}" placeholder="Ex: 8hrs com guia brasileiro · transporte público" oninput="updTourField(${t.id},'observacao',this.value)">
          ${renderSugestoesHtml(t.id, 'tour', state.config.sugestoes_tours)}</div>
      </div>`;
    cont.appendChild(div);
    // Initialize rich text for this tour's textarea
    initRichText(`tour-pontos-${t.id}`, 'Asakusa\nUeno Park\nYanaka Ginza');
  });
}

function updTourDuracao(id, duracao) {
  const t = state.orcamento.tours.find(x => x.id === id); if (!t) return;
  t.duracao = duracao;
  if (duracao && state.orcamento.valoresTour && state.orcamento.valoresTour[duracao]) {
    t.valor = state.orcamento.valoresTour[duracao];
  }
  renderToursForm();
  updateResumo();
}
function rmTour(id) { state.orcamento.tours = state.orcamento.tours.filter(t => t.id !== id); renderToursForm(); updateResumo(); }
function updTourField(id, f, v) {
  const t = state.orcamento.tours.find(x => x.id === id); if (!t) return;
  t[f] = v;
  updateResumo();
}
function updTourToggleDesconto(id, checked) {
  const t = state.orcamento.tours.find(x => x.id === id); if (!t) return;
  t.descontoAtivo = checked;
  // trigger recalculation visually in HTML if needed
  renderToursForm();
  updateResumo();
}
function updTourNum(id, f, rawVal) {
  // Atualiza estado sem re-render — deixa o usuário digitar livremente
  const t = state.orcamento.tours.find(x => x.id === id); if (!t) return;
  t[f] = parseFloat(rawVal) || 0;
  
  // Recalcula o total
  let valorFinal = parseFloat(t.valor) || 0;
  if (t.descontoAtivo && t.desconto > 0) {
    valorFinal = valorFinal - (valorFinal * (t.desconto / 100));
  }

  // Só atualiza o subtotal no header, sem re-renderizar o form
  const el = document.getElementById(`subtotal-tour-${id}`);
  if (el) el.textContent = `¥${fmt(valorFinal)} · ${fmtUSD(valorFinal * getUSD())}`;
  updateResumo();
}
function finalizarNum(id, tipo, f, rawVal) {
  // Ao sair do campo (blur), garante valor correto
  if (tipo === 'tour') {
    const t = state.orcamento.tours.find(x => x.id === id); if (!t) return;
    t[f] = parseFloat(rawVal) || 0;
  }
  updateResumo();
}

function addTransporte() {
  const ad = parseInt(document.getElementById('clienteAdultos')?.value) || 2;
  const cr = parseInt(document.getElementById('clienteCriancas')?.value) || 0;
  state.orcamento.transportes.push({ 
    id: Date.now(), data: '', descricao: '', 
    preco: 0, precoInfantil: 0, 
    adultos: ad, criancas: cr, 
    taxaAtiva: false, taxaTipo: 'grupo', taxaValor: 3000, observacao: '', _dbId: null 
  });
  renderTransportesForm(); updateResumo();
}
function calcTotalTransporte(t) {
  const adultos = t.adultos || 0;
  const criancas = t.criancas || 0;
  const descLow = t.descricao ? t.descricao.toLowerCase() : '';
  const isTransfer = descLow.includes('transfer') || descLow.includes('privado') || descLow.includes('privativo');
  
  let base = 0;
  if (isTransfer) {
    base = t.preco || 0;
  } else {
    base = (t.preco || 0) * adultos + (t.precoInfantil || 0) * criancas;
  }
  
  let totalPessoas = adultos + criancas;
  if (t.taxaAtiva) {
    base += t.taxaTipo === 'grupo' ? (t.taxaValor || 3000) : (t.taxaValor || 3000) * (totalPessoas > 0 ? totalPessoas : 1);
  }
  return base;
}
function renderTransportesForm() {
  const cont = document.getElementById('transportesList');
  cont.innerHTML = '';
  
  const groupedDB = [];
  const mapGroup = new Map();
  state.transportesDB.forEach(tr => {
    const key = `${tr.trecho}|${tr.tipo}|${tr.linha}|${tr.categoria}`;
    if (!mapGroup.has(key)) {
      mapGroup.set(key, { ...tr, precos: {} });
      groupedDB.push(mapGroup.get(key));
    }
    const g = mapGroup.get(key);
    if ((tr.idade || 'adulto').toLowerCase().includes('infantil')) {
      g.precos.infantil = tr.preco_jpy;
      g._dbIdInfantil = tr.id;
    } else {
      g.precos.adulto = tr.preco_jpy;
      g._dbIdAdulto = tr.id;
    }
  });

  state.orcamento.transportes.forEach((t, i) => {
    const total = calcTotalTransporte(t);
    const totalPessoas = (t.adultos||0) + (t.criancas||0);
    
    const opts = groupedDB.map(g => {
      const pAd = g.precos.adulto || 0;
      const pInf = g.precos.infantil || 0;
      const isSelected = t._dbId && (t._dbId === g._dbIdAdulto || t._dbId === g._dbIdInfantil || t._dbId === g.id);
      return `<option value="${g.id}" ${isSelected ? 'selected' : ''}>` +
      `${g.trecho} | ${g.tipo} | ${g.linha} | ${g.categoria} ${g.tempo ? '(⏱ ' + g.tempo + ') ' : ''}— Ad: ¥${fmt(pAd)} / Inf: ¥${fmt(pInf)}</option>`;
    }).join('');
    
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div class="item-row-header">
        <span class="item-row-num">Transporte ${i+1}</span>
        <span class="item-subtotal" id="subtotal-transp-${t.id}">¥${fmt(total)} · ${fmtUSD(total*getUSD())}</span>
        <button class="btn-remove" onclick="rmTransporte(${t.id})">✕</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Data</label>
          <input type="date" value="${t.data}" onchange="updTranspField(${t.id},'data',this.value)"></div>
        <div class="field"><label>Selecionar da base</label>
          <select onchange="preencherTransporte(${t.id},this.value)">
            <option value="">— digitar manualmente —</option>${opts}
          </select></div>
        <div class="field full-width"><label>Descrição</label>
          <input type="text" value="${t.descricao}" placeholder="Ex: Asakusa Station → Tobu Nikko | Spacia X | Reservado*"
            oninput="updTranspField(${t.id},'descricao',this.value)"></div>
            
        <div class="field"><label>Valor Adulto ¥</label>
          <input type="number" value="${t.preco||0}"
            oninput="updTranspNum(${t.id},'preco',this.value)"
            onblur="updTranspRefresh(${t.id},'preco',this.value)"></div>
        <div class="field"><label>Nº Adultos</label>
          <input type="number" value="${t.adultos||0}" min="0"
            oninput="updTranspNum(${t.id},'adultos',this.value)"
            onblur="updTranspRefresh(${t.id},'adultos',this.value)"></div>
            
        <div class="field"><label>Valor Infantil ¥</label>
          <input type="number" value="${t.precoInfantil||0}"
            oninput="updTranspNum(${t.id},'precoInfantil',this.value)"
            onblur="updTranspRefresh(${t.id},'precoInfantil',this.value)"></div>
        <div class="field"><label>Nº Crianças</label>
          <input type="number" value="${t.criancas||0}" min="0"
            oninput="updTranspNum(${t.id},'criancas',this.value)"
            onblur="updTranspRefresh(${t.id},'criancas',this.value)"></div>
            
        <div class="field full-width">
          <label>Taxa Adicional</label>
          <div class="taxa-row" style="margin-top:6px">
            <label class="toggle" style="flex-shrink:0">
              <input type="checkbox" ${t.taxaAtiva?'checked':''} onchange="updTranspToggleTaxa(${t.id},this.checked)">
              <span class="toggle-slider"></span>
            </label>
            <select ${t.taxaAtiva?'':'style="opacity:0.4;pointer-events:none"'} onchange="updTranspRefresh(${t.id},'taxaTipo',this.value)">
              <option value="grupo" ${t.taxaTipo==='grupo'?'selected':''}>Por grupo</option>
              <option value="pessoa" ${t.taxaTipo==='pessoa'?'selected':''}>Por pessoa</option>
            </select>
            <input type="number" value="${t.taxaValor||0}" style="width:110px${t.taxaAtiva?'':';opacity:0.4;pointer-events:none'}"
              oninput="updTranspNum(${t.id},'taxaValor',this.value)"
              onblur="updTranspRefresh(${t.id},'taxaValor',this.value)">
            <span class="taxa-label" style="color:var(--ink-mid)" id="taxa-label-transp-${t.id}"></span>
          </div>
        </div>
        <div class="field full-width"><label>Observações</label>
          <input type="text" id="obs-transporte-${t.id}" value="${t.observacao||''}" placeholder="Ex: Apenas reserva do assento. Tarifa básica paga na hora."
            oninput="updTranspField(${t.id},'observacao',this.value)">
          ${renderSugestoesHtml(t.id, 'transporte', state.config.sugestoes_transportes)}</div>
      </div>
    `;
    cont.appendChild(div);
  });
}
function rmTransporte(id) { state.orcamento.transportes = state.orcamento.transportes.filter(t => t.id !== id); renderTransportesForm(); updateResumo(); }
function updTranspField(id, f, v) { const t = state.orcamento.transportes.find(x=>x.id===id); if(t){ t[f]=v; updateResumo(); } }
function updTranspNum(id, f, rawVal) {
  const t = state.orcamento.transportes.find(x=>x.id===id); if(!t) return;
  t[f] = parseFloat(rawVal)||0;
  const total = calcTotalTransporte(t);
  const el = document.getElementById(`subtotal-transp-${id}`);
  if(el) el.textContent = `¥${fmt(total)} · ${fmtUSD(total*getUSD())}`;
  const taxaEl = document.getElementById(`taxa-label-transp-${id}`);
  const totalPessoas = (t.adultos||0) + (t.criancas||0);
  if(taxaEl) taxaEl.textContent = t.taxaAtiva ? (`= ¥${fmt(t.taxaTipo==='grupo'?t.taxaValor:t.taxaValor * (totalPessoas > 0 ? totalPessoas : 1))}`) : '';
  updateResumo();
}
function updTranspRefresh(id, f, v) {
  const t = state.orcamento.transportes.find(x=>x.id===id); if(!t) return;
  t[f] = (f==='taxaTipo' || f==='precoTipo') ? v : (parseFloat(v)||0);
  renderTransportesForm(); updateResumo();
}
function updTranspToggleTaxa(id, checked) {
  const t = state.orcamento.transportes.find(x=>x.id===id); if(!t) return;
  t.taxaAtiva = checked; renderTransportesForm(); updateResumo();
}
function preencherTransporte(id, dbId) {
  const t = state.orcamento.transportes.find(x=>x.id===id);
  const db = state.transportesDB.find(x=>x.id==dbId);
  if(t&&db){
    t._dbId = db.id;
    t.descricao = `${db.trecho} | ${db.tipo} | ${db.linha} | ${db.categoria}`;
    
    let preco = db.preco_jpy || 0;
    let precoInfantil = 0;
    
    const matches = state.transportesDB.filter(x => x.trecho === db.trecho && x.tipo === db.tipo && x.linha === db.linha && x.categoria === db.categoria);
    matches.forEach(m => {
      if ((m.idade || '').toLowerCase().includes('infantil')) {
        precoInfantil = m.preco_jpy || 0;
      } else if ((m.idade || '').toLowerCase().includes('adulto')) {
        preco = m.preco_jpy || 0;
        t._dbId = m.id;
      }
    });
    
    t.preco = preco;
    t.precoInfantil = precoInfantil;
    t.observacao = db.observacao || '';
  }
  else if(t) t._dbId=null;
  renderTransportesForm(); updateResumo();
}

// ── EXPERIÊNCIAS ──────────────────────────────────────────────────────────────
function addExperiencia() {
  state.orcamento.experiencias.push({ id: Date.now(), data: '', nome: '', preco: 0, pessoas: 2, taxaAtiva: false, taxaTipo: 'grupo', taxaValor: 3000, observacao: '', _dbId: null });
  renderExperienciasForm(); updateResumo();
}
function calcTotalExp(e) {
  let base = (e.preco||0) * (e.precoTipo === 'grupo' ? 1 : (e.pessoas||1));
  if (e.taxaAtiva) base += e.taxaTipo==='grupo' ? (e.taxaValor||3000) : (e.taxaValor||3000)*(e.pessoas||1);
  return base;
}
function renderExperienciasForm() {
  const cont = document.getElementById('experienciasList');
  cont.innerHTML = '';
  state.orcamento.experiencias.forEach((e, i) => {
    const total = calcTotalExp(e);
    const taxaVal = e.taxaAtiva ? (e.taxaTipo==='grupo' ? e.taxaValor : e.taxaValor*e.pessoas) : 0;
    const opts = state.experienciasDB.map(ex =>
      `<option value="${ex.id}" ${e._dbId==ex.id?'selected':''}>${ex.nome} — ¥${fmt(ex.preco_jpy)}</option>`
    ).join('');
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div class="item-row-header">
        <span class="item-row-num">Experiência ${i+1}</span>
        <span class="item-subtotal" id="subtotal-exp-${e.id}">¥${fmt(e.preco)} × ${e.pessoas}${e.taxaAtiva?` + taxa`:''}  =  ¥${fmt(total)} · ${fmtUSD(total*getUSD())}</span>
        <button class="btn-remove" onclick="rmExp(${e.id})">✕</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Data</label>
          <input type="date" value="${e.data}" onchange="updExpField(${e.id},'data',this.value)"></div>
        <div class="field"><label>Selecionar da base</label>
          <select onchange="preencherExp(${e.id},this.value)">
            <option value="">— digitar manualmente —</option>${opts}
          </select></div>
        <div class="field full-width"><label>Nome / Descrição</label>
          <input type="text" value="${e.nome}" placeholder="Ex: Cerimônia do Chá - Kyoto"
            oninput="updExpField(${e.id},'nome',this.value)"></div>
        <div class="field"><label>Valor Unitário ¥</label>
          <input type="number" value="${e.preco||''}"
            oninput="updExpNum(${e.id},'preco',this.value)"
            onblur="updExpRefresh(${e.id},'preco',this.value)"></div>
        <div class="field"><label>Nº Pessoas</label>
          <input type="number" value="${e.pessoas}" min="1"
            oninput="updExpNum(${e.id},'pessoas',this.value)"
            onblur="updExpRefresh(${e.id},'pessoas',this.value)"></div>
        <div class="field full-width">
          <label>Taxa Adicional</label>
          <div class="taxa-row" style="margin-top:6px">
            <label class="toggle" style="flex-shrink:0">
              <input type="checkbox" ${e.taxaAtiva?'checked':''} onchange="updExpToggleTaxa(${e.id},this.checked)">
              <span class="toggle-slider"></span>
            </label>
            <select ${e.taxaAtiva?'':'style="opacity:0.4;pointer-events:none"'} onchange="updExpRefresh(${e.id},'taxaTipo',this.value)">
              <option value="grupo" ${e.taxaTipo==='grupo'?'selected':''}>Por grupo</option>
              <option value="pessoa" ${e.taxaTipo==='pessoa'?'selected':''}>Por pessoa</option>
            </select>
            <input type="number" value="${e.taxaValor}" style="width:110px${e.taxaAtiva?'':';opacity:0.4;pointer-events:none'}"
              oninput="updExpNum(${e.id},'taxaValor',this.value)"
              onblur="updExpRefresh(${e.id},'taxaValor',this.value)">
            <span class="taxa-label" style="color:var(--ink-mid)" id="taxa-label-exp-${e.id}"></span>
          </div>
        </div>
        <div class="field full-width"><label>Observações</label>
          <input type="text" id="obs-experiencia-${e.id}" value="${e.observacao}" placeholder="Ex: Ingresso emitido eletronicamente. Não reembolsável." oninput="updExpField(${e.id},'observacao',this.value)">
          ${renderSugestoesHtml(e.id, 'experiencia', state.config.sugestoes_experiencias)}</div>
      </div>`;
    cont.appendChild(div);
  });
}
function rmExp(id) { state.orcamento.experiencias = state.orcamento.experiencias.filter(e => e.id !== id); renderExperienciasForm(); updateResumo(); }
function updExpField(id, f, v) { const e = state.orcamento.experiencias.find(x=>x.id===id); if(e){ e[f]=v; updateResumo(); } }
function updExpNum(id, f, rawVal) {
  const e = state.orcamento.experiencias.find(x=>x.id===id); if(!e) return;
  e[f] = parseFloat(rawVal)||0;
  const total = calcTotalExp(e);
  const el = document.getElementById(`subtotal-exp-${e.id}`);
  if(el) el.textContent = `¥${fmt(e.preco)} × ${e.pessoas}${e.taxaAtiva?` + taxa`:''} = ¥${fmt(total)} · ${fmtUSD(total*getUSD())}`;
  const taxaEl = document.getElementById(`taxa-label-exp-${id}`);
  if(taxaEl) taxaEl.textContent = e.taxaAtiva ? (`= ¥${fmt(e.taxaTipo==='grupo'?e.taxaValor:e.taxaValor*e.pessoas)}`) : '';
  updateResumo();
}
function updExpRefresh(id, f, v) {
  const e = state.orcamento.experiencias.find(x=>x.id===id); if(!e) return;
  e[f] = (f==='taxaTipo' || f==='precoTipo') ? v : (parseFloat(v)||0);
  renderExperienciasForm(); updateResumo();
}
function updExpToggleTaxa(id, checked) {
  const e = state.orcamento.experiencias.find(x=>x.id===id); if(!e) return;
  e.taxaAtiva = checked; renderExperienciasForm(); updateResumo();
}
function preencherExp(id, dbId) {
  const e = state.orcamento.experiencias.find(x=>x.id===id);
  const db = state.experienciasDB.find(x=>x.id==dbId);
  if(e&&db){ e._dbId=db.id; e.nome=db.nome; e.preco=db.preco_jpy; e.observacao=db.observacao||''; }
  else if(e) e._dbId=null;
  renderExperienciasForm(); updateResumo();
}

// ── PROPAGAR PESSOAS ─────────────────────────────────────────────────────────
function propagarPessoas() {
  const ad = parseInt(document.getElementById('clienteAdultos')?.value) || 0;
  const cr = parseInt(document.getElementById('clienteCriancas')?.value) || 0;
  const num = ad + cr;
  if (!num || isNaN(num)) return;
  state.orcamento.transportes.forEach(t => { t.adultos = ad; t.criancas = cr; });
  state.orcamento.experiencias.forEach(e => { e.pessoas = num; });
  renderTransportesForm();
  renderExperienciasForm();
  updateResumo();
}

// ── ITENS ADICIONAIS ──────────────────────────────────────────────────────────
function addItemAdicional() {
  if (!state.orcamento.itensAdicionais) state.orcamento.itensAdicionais = [];
  state.orcamento.itensAdicionais.push({ id: Date.now(), descricao: '', valor: 0 });
  renderItensAdicionaisForm();
  updateResumo();
}

function renderItensAdicionaisForm() {
  const cont = document.getElementById('itensAdicionaisList');
  if (!cont) return;
  cont.innerHTML = '';
  const itens = state.orcamento.itensAdicionais || [];
  itens.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div class="item-row-header">
        <span class="item-row-num">Item Adicional ${i+1}</span>
        <span class="item-subtotal" id="subtotal-item-adicional-${item.id}">¥${fmt(item.valor)} · ${fmtUSD(item.valor * getUSD())}</span>
        <button class="btn-remove" onclick="rmItemAdicional(${item.id})">✕</button>
      </div>
      <div class="form-grid">
        <div class="field full-width"><label>Descrição</label>
          <input type="text" value="${item.descricao}" placeholder="Ex: Serviço de guia noturno adicional ou taxas extras" oninput="updItemAdicionalField(${item.id},'descricao',this.value)"></div>
        <div class="field"><label>Valor ¥</label>
          <input type="number" value="${item.valor||''}" placeholder="Ex: 15000"
            oninput="updItemAdicionalNum(${item.id},'valor',this.value)"
            onblur="updItemAdicionalRefresh(${item.id},'valor',this.value)"></div>
      </div>`;
    cont.appendChild(div);
  });
}

function rmItemAdicional(id) {
  state.orcamento.itensAdicionais = (state.orcamento.itensAdicionais || []).filter(item => item.id !== id);
  renderItensAdicionaisForm();
  updateResumo();
}

function updItemAdicionalField(id, f, v) {
  const item = (state.orcamento.itensAdicionais || []).find(x => x.id === id);
  if (item) {
    item[f] = v;
    updateResumo();
  }
}

function updItemAdicionalNum(id, f, rawVal) {
  const item = (state.orcamento.itensAdicionais || []).find(x => x.id === id);
  if (!item) return;
  item[f] = parseFloat(rawVal) || 0;
  const el = document.getElementById(`subtotal-item-adicional-${id}`);
  if (el) el.textContent = `¥${fmt(item.valor)} · ${fmtUSD(item.valor * getUSD())}`;
  updateResumo();
}

function updItemAdicionalRefresh(id, f, v) {
  const item = (state.orcamento.itensAdicionais || []).find(x => x.id === id);
  if (!item) return;
  item[f] = parseFloat(v) || 0;
  renderItensAdicionaisForm();
  updateResumo();
}

// ── CÁLCULOS ──────────────────────────────────────────────────────────────────
function getUSD() { return parseFloat(state.config.cambio_jpy_usd)||0.006280; }
function getConsultoriaVal() {
  const tog = document.getElementById('consultoriaToggle');
  return tog?.checked ? (parseFloat(document.getElementById('consultoriaValor')?.value)||0) : 0;
}

function updateResumo() {
  autoSave();
  const tT = (state.orcamento.tours||[]).reduce((sum, t) => sum + calcTotalTour(t), 0);
  const tTr = state.orcamento.transportes.reduce((s,t)=>s+calcTotalTransporte(t),0);
  const tEx = state.orcamento.experiencias.reduce((s,e)=>s+calcTotalExp(e),0);
  const tItens = (state.orcamento.itensAdicionais||[]).reduce((s,i)=>s+(i.valor||0),0);
  const cons = getConsultoriaVal();
  const total = tT+tTr+tEx+tItens+cons;
  const sinal = tT*0.30;
  const usd = getUSD();
  const tx = state.orcamento.textos || {};
  const lblCons = tx.lblCons || document.getElementById('tx_lblCons')?.value.trim() || 'Roteirização e Suporte';
  document.getElementById('resumoGrid').innerHTML = `
    <div class="resumo-item"><div class="resumo-label">Total Tours</div><div class="resumo-valor">¥${fmt(tT)}</div><div class="resumo-sub">${fmtUSD(tT*usd)}</div></div>
    <div class="resumo-item"><div class="resumo-label">Total Transportes</div><div class="resumo-valor">¥${fmt(tTr)}</div><div class="resumo-sub">${fmtUSD(tTr*usd)}</div></div>
    <div class="resumo-item"><div class="resumo-label">Total Experiências</div><div class="resumo-valor">¥${fmt(tEx)}</div><div class="resumo-sub">${fmtUSD(tEx*usd)}</div></div>
    ${tItens>0?`<div class="resumo-item"><div class="resumo-label">Itens Adicionais</div><div class="resumo-valor">¥${fmt(tItens)}</div><div class="resumo-sub">${fmtUSD(tItens*usd)}</div></div>`:''}
    ${cons>0?`<div class="resumo-item"><div class="resumo-label">${lblCons}</div><div class="resumo-valor">¥${fmt(cons)}</div><div class="resumo-sub">${fmtUSD(cons*usd)}</div></div>`:''}
    <div class="resumo-item destaque"><div class="resumo-label">Total Geral</div><div class="resumo-valor">¥${fmt(total)}</div><div class="resumo-sub">${fmtUSD(total*usd)}</div></div>
    <div class="resumo-item gold"><div class="resumo-label">Sinal 30% — Tours</div><div class="resumo-valor">¥${fmt(sinal)}</div><div class="resumo-sub">${fmtUSD(sinal*usd)}</div></div>`;
}

// ── BASE DE DADOS ─────────────────────────────────────────────────────────────
function setupBase() {
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab)?.classList.add('active');
  }));
  document.getElementById('searchTransporte')?.addEventListener('input', e => renderTabelaTransportes(e.target.value));
  document.getElementById('searchExperiencia')?.addEventListener('input', e => renderTabelaExperiencias(e.target.value));
  document.getElementById('searchAtracao')?.addEventListener('input', e => renderTabelaAtracoes(e.target.value));
  if(document.getElementById('searchRota')) document.getElementById('searchRota').addEventListener('input', e => renderTabelaRotas(e.target.value));
  document.getElementById('btnNovoTransporte')?.addEventListener('click', () => abrirModalTransporte());
  document.getElementById('btnNovaExperiencia')?.addEventListener('click', () => abrirModalExperiencia());
  document.getElementById('btnNovaAtracao')?.addEventListener('click', () => abrirModalAtracao());
}
function renderTabelaTransportes(filtro) {
  if (filtro === undefined) {
    const el = document.getElementById('searchTransporte');
    filtro = el ? el.value : '';
  }
  const tbody = document.querySelector('#tabelaTransportes tbody');
  if(!tbody) return;
  const lista = filtro ? state.transportesDB.filter(t=>[t.trecho,t.tipo,t.linha,t.categoria].join(' ').toLowerCase().includes(filtro.toLowerCase())) : state.transportesDB;
  tbody.innerHTML = lista.map(t=>`<tr><td>${t.trecho}</td><td>${t.idade||''}</td><td>${t.tipo}</td><td>${t.linha}</td><td>${t.categoria}</td><td class="preco-cell">¥${fmt(t.preco_jpy)}</td><td>${t.tempo||'—'}</td><td><button class="btn-icon" onclick="abrirModalTransporte(${t.id})">✎</button> <button class="btn-icon" onclick="deletarTransporte(${t.id})">✕</button></td></tr>`).join('');
}
function renderTabelaExperiencias(filtro) {
  if (filtro === undefined) {
    const el = document.getElementById('searchExperiencia');
    filtro = el ? el.value : '';
  }
  const tbody = document.querySelector('#tabelaExperiencias tbody');
  if(!tbody) return;
  const lista = filtro ? state.experienciasDB.filter(e=>e.nome.toLowerCase().includes(filtro.toLowerCase())) : state.experienciasDB;
  tbody.innerHTML = lista.map(e=>`<tr><td>${e.nome}</td><td>${e.tipo}</td><td class="preco-cell">¥${fmt(e.preco_jpy)}</td><td>${e.observacao||'—'}</td><td><button class="btn-icon" onclick="abrirModalExperiencia(${e.id})">✎</button> <button class="btn-icon" onclick="deletarExperiencia(${e.id})">✕</button></td></tr>`).join('');
}
function abrirModalTransporte(id) {
  const item = id ? state.transportesDB.find(t=>t.id==id) : {};
  document.getElementById('modalContent').innerHTML = `
    <h3 class="modal-title">${id?'Editar':'Novo'} Transporte</h3>
    <div class="form-grid">
      <div class="field full-width"><label>Trecho</label><input id="m_trecho" value="${item.trecho||''}"></div>
      <div class="field"><label>Idade</label><input id="m_idade" value="${item.idade||''}"></div>
      <div class="field"><label>Tipo</label><input id="m_tipo" value="${item.tipo||''}"></div>
      <div class="field"><label>Linha</label><input id="m_linha" value="${item.linha||''}"></div>
      <div class="field"><label>Categoria</label><input id="m_categoria" value="${item.categoria||''}"></div>
      <div class="field"><label>Preço ¥</label><input id="m_preco" type="number" value="${item.preco_jpy||0}"></div>
      <div class="field"><label>Tempo</label><input id="m_tempo" value="${item.tempo||''}"></div>
      <div class="field full-width"><label>Observações</label><input id="m_obs" value="${item.observacao||''}"></div>
      <div class="field full-width"><label>Link</label><input id="m_link" value="${item.link||''}"></div>
    </div>
    <div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-primary" onclick="salvarTransporte(${id||'null'})">Salvar</button></div>`;
  openModal();
}
async function salvarTransporte(id) {
  const dados={trecho:v('m_trecho'),idade:v('m_idade'),tipo:v('m_tipo'),linha:v('m_linha'),categoria:v('m_categoria'),preco_jpy:parseFloat(v('m_preco'))||0,tempo:v('m_tempo'),observacao:v('m_obs'),link:v('m_link')};
  if(id){await fetch(`/api/transportes/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});const i=state.transportesDB.find(t=>t.id==id);if(i)Object.assign(i,dados);}
  else{const n=await fetch('/api/transportes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)}).then(r=>r.json());state.transportesDB.push(n);}
  await loadDB();closeModal();
}
async function deletarTransporte(id){if(!confirm('Remover?'))return;await fetch(`/api/transportes/${id}`,{method:'DELETE'});state.transportesDB=state.transportesDB.filter(t=>t.id!=id);renderTabelaTransportes();}
function abrirModalExperiencia(id) {
  const item = id ? state.experienciasDB.find(e=>e.id==id) : {};
  document.getElementById('modalContent').innerHTML = `
    <h3 class="modal-title">${id?'Editar':'Nova'} Experiência</h3>
    <div class="form-grid">
      <div class="field full-width"><label>Nome</label><input id="m_nome" value="${item.nome||''}"></div>
      <div class="field"><label>Tipo</label><input id="m_tipo" value="${item.tipo||'Ingresso'}"></div>
      <div class="field"><label>Preço ¥</label><input id="m_preco" type="number" value="${item.preco_jpy||0}"></div>
      <div class="field full-width"><label>Observações</label><input id="m_obs" value="${item.observacao||''}"></div>
      <div class="field full-width"><label>Link</label><input id="m_link" value="${item.link||''}"></div>
    </div>
    <div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-primary" onclick="salvarExperiencia(${id||'null'})">Salvar</button></div>`;
  openModal();
}
async function salvarExperiencia(id){
  const dados={nome:v('m_nome'),tipo:v('m_tipo'),preco_jpy:parseFloat(v('m_preco'))||0,observacao:v('m_obs'),link:v('m_link')};
  if(id){await fetch(`/api/experiencias/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});const i=state.experienciasDB.find(e=>e.id==id);if(i)Object.assign(i,dados);}
  else{const n=await fetch('/api/experiencias',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)}).then(r=>r.json());state.experienciasDB.push(n);}
  await loadDB();closeModal();
}
async function deletarExperiencia(id){if(!confirm('Remover?'))return;await fetch(`/api/experiencias/${id}`,{method:'DELETE'});state.experienciasDB=state.experienciasDB.filter(e=>e.id!=id);renderTabelaExperiencias();}

function renderTabelaAtracoes(filtro) {
  if (filtro === undefined) {
    const el = document.getElementById('searchAtracao');
    filtro = el ? el.value : '';
  }
  const tbody = document.querySelector('#tabelaAtracoes tbody');
  if(!tbody) return;
  const lista = filtro ? state.atracoesDB.filter(a=>[a['Nome da Atração'],a['Bairro'],a['Cidade']].join(' ').toLowerCase().includes(filtro.toLowerCase())) : state.atracoesDB;
  tbody.innerHTML = lista.map(a=>`<tr><td>${a['Cidade']||''}</td><td>${a['Bairro']||''}</td><td>${a['Nome da Atração']}</td><td>${a['Preço (Ingresso)']||'—'}</td><td><button class="btn-icon" onclick="abrirModalAtracao(${a.id})">✎</button> <button class="btn-icon" onclick="deletarAtracao(${a.id})">✕</button></td></tr>`).join('');
}
function abrirModalAtracao(id) {
  const item = id ? state.atracoesDB.find(a=>a.id==id) : {};
  document.getElementById('modalContent').innerHTML = `
    <h3 class="modal-title">${id?'Editar':'Nova'} Atração</h3>
    <div class="form-grid">
      <div class="field"><label>Cidade</label><input id="m_a_cidade" value="${item['Cidade']||''}"></div>
      <div class="field"><label>Bairro</label><input id="m_a_bairro" value="${item['Bairro']||''}"></div>
      <div class="field full-width"><label>Nome da Atração</label><input id="m_a_nome" value="${item['Nome da Atração']||''}"></div>
      <div class="field full-width"><label>Preço (Texto livre)</label><input id="m_a_preco" value="${item['Preço (Ingresso)']||''}"></div>
      <div class="field full-width"><label>Descrição Detalhada</label><textarea id="m_a_desc" rows="4">${item['Descrição Detalhada']||''}</textarea></div>
    </div>
    <div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-primary" onclick="salvarAtracao(${id||'null'})">Salvar</button></div>`;
  openModal();
  
  // Clean up any stray HTML tags if the user accidentally saved with Quill previously
  const descEl = document.getElementById('m_a_desc');
  if (descEl.value) {
    descEl.value = descEl.value.replace(/<[^>]*>?/gm, '').trim();
  }
}
async function salvarAtracao(id){
  const dados={'Cidade':v('m_a_cidade'),'Bairro':v('m_a_bairro'),'Nome da Atração':v('m_a_nome'),'Preço (Ingresso)':v('m_a_preco'),'Descrição Detalhada':v('m_a_desc').trim()};
  if(id){await fetch(`/api/atracoes/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});const i=state.atracoesDB.find(a=>a.id==id);if(i)Object.assign(i,dados);}
  else{const n=await fetch('/api/atracoes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)}).then(r=>r.json());state.atracoesDB.push(n);}
  await loadDB();closeModal();
  // Se estivermos na aba de roteiros, atualiza lá também
  if (typeof carregarBases === 'function') await carregarBases();
}
async function deletarAtracao(id){
  if(!confirm('Remover atração?'))return;
  await fetch(`/api/atracoes/${id}`,{method:'DELETE'});
  state.atracoesDB=state.atracoesDB.filter(a=>a.id!=id);
  renderTabelaAtracoes();
  if (typeof carregarBases === 'function') await carregarBases();
}

// ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────────
function setupConfig() {
  // Initialize Rich Text Editors for Config Textareas
  initRichText('textoObservacoes', 'Observações Padrão...');
  initRichText('textoCondicoes', 'Condições Padrão...');
  initRichText('textoCancelamento', 'Políticas de Cancelamento...');
  initRichText('sugestoesTours', 'Sugestões de Tours...');
  initRichText('sugestoesTransportes', 'Sugestões de Transportes...');
  initRichText('sugestoesExperiencias', 'Sugestões de Experiências...');

  document.getElementById('btnSalvarCambio').addEventListener('click', async () => {
    const dados={cambio_jpy_usd:parseFloat(document.getElementById('cambioUSD').value),cambio_jpy_brl:parseFloat(document.getElementById('cambioBRL').value)};
    await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});
    Object.assign(state.config,dados);updateResumo();showToast('Câmbio salvo!');
  });
  document.getElementById('btnCambioAuto').addEventListener('click', async () => {
    const btn = document.getElementById('btnCambioAuto');
    const status = document.getElementById('cambioAutoStatus');
    btn.textContent = '↻ Buscando...'; btn.disabled = true; status.textContent = '';
    try {
      const res = await fetch('/api/cambio');
      const data = await res.json();
      if (data.ok) {
        document.getElementById('cambioUSD').value = data.cambio_jpy_usd.toFixed(6);
        document.getElementById('cambioBRL').value = data.cambio_jpy_brl.toFixed(6);
        const dataRef = new Date(data.data).toLocaleDateString('pt-BR');
        const dados = { cambio_jpy_usd: data.cambio_jpy_usd, cambio_jpy_brl: data.cambio_jpy_brl, cambio_data_ref: dataRef };
        await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});
        Object.assign(state.config, dados);
        document.getElementById('cambioDataRef').textContent = 'Última atualização automática: ' + dataRef;
        status.textContent = '✓ Atualizado';
        updateResumo();
        showToast('Câmbio do dia aplicado!');
      } else { status.textContent = '✗ ' + data.error; }
    } catch(e) { status.textContent = '✗ Sem conexão'; }
    btn.textContent = '↻ Buscar Câmbio do Dia'; btn.disabled = false;
  });
  document.getElementById('btnSalvarSheets').addEventListener('click', async () => {
    const dados={
      sheets_id:document.getElementById('sheetsId').value.trim(),
      sheets_script_url:document.getElementById('sheetsScriptUrl').value.trim(),
      sheets_aba_transportes:document.getElementById('abaTransportes').value.trim(),
      sheets_aba_experiencias:document.getElementById('abaExperiencias').value.trim(),
      sheets_aba_atracoes:document.getElementById('abaAtracoes').value.trim()
    };
    await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});
    Object.assign(state.config,dados);showToast('Configurações salvas!');
  });
  document.getElementById('btnSalvarTextos').addEventListener('click', async () => {
    const dados={texto_observacoes:document.getElementById('textoObservacoes').value,texto_condicoes:document.getElementById('textoCondicoes').value,texto_cancelamento:document.getElementById('textoCancelamento').value};
    await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});
    Object.assign(state.config,dados);showToast('Textos salvos!');
  });
  document.getElementById('btnSalvarSugestoes').addEventListener('click', async () => {
    const dados = {
      sugestoes_tours: document.getElementById('sugestoesTours').value,
      sugestoes_transportes: document.getElementById('sugestoesTransportes').value,
      sugestoes_experiencias: document.getElementById('sugestoesExperiencias').value
    };
    await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    Object.assign(state.config, dados);
    renderToursForm();
    renderTransportesForm();
    renderExperienciasForm();
    showToast('Mensagens rápidas salvas!');
  });
}

// ── SYNC ──────────────────────────────────────────────────────────────────────
function setupSync() {
  document.getElementById('btnSync').addEventListener('click', async () => {
    const btn=document.getElementById('btnSync');
    btn.textContent='↻ Sincronizando...';btn.disabled=true;
    try{const res=await fetch('/api/sync',{method:'POST'});const data=await res.json();
      if(data.ok){
        document.getElementById('syncStatus').textContent='Sync: '+fmtDate(data.ultima_sincronizacao);
        await loadDB(); window.dbTransportesCache = null; window.dbExperienciasCache = null; showToast(`Base atualizada! ${data.nTransp||0} transportes, ${data.nExp||0} experiências, ${data.nAtracoes||0} atrações.`);
      }
      else alert('Erro: '+data.error);
    }catch{alert('Erro ao sincronizar.');}
    btn.textContent='↻ Sincronizar Sheets';btn.disabled=false;
  });
}

// ── SYNC DOM → STATE ─────────────────────────────────────────────────────────
function syncDOMToState() {
  // Textos customizáveis
  state.orcamento.textos = coletarTextos();

  // Tours: captura valores dos inputs numéricos ativos
  state.orcamento.tours.forEach(t => {
    const valEl = document.querySelector(`input[oninput*="updTourNum(${t.id},'valor'"]`);
    if (valEl) t.valor = parseFloat(valEl.value) || 0;
    const duracaoEl = document.querySelector(`input[oninput*="updTourField(${t.id},'duracao'"]`);
    if (duracaoEl) t.duracao = duracaoEl.value;
    const descEl = document.querySelector(`input[oninput*="updTourField(${t.id},'descricao'"]`);
    if (descEl) t.descricao = descEl.value;
    const pontosEl = document.querySelector(`textarea[oninput*="updTourField(${t.id},'pontos'"]`);
    if (pontosEl) t.pontos = pontosEl.value;
    const obsEl = document.querySelector(`input[oninput*="updTourField(${t.id},'observacao'"]`);
    if (obsEl) t.observacao = obsEl.value;
  });
  // Transportes
  state.orcamento.transportes.forEach(t => {
    const precoEl = document.querySelector(`input[oninput*="updTranspNum(${t.id},'preco'"]`);
    if (precoEl) t.preco = parseFloat(precoEl.value) || 0;
    const pessoasEl = document.querySelector(`input[oninput*="updTranspNum(${t.id},'pessoas'"]`);
    if (pessoasEl) t.pessoas = parseFloat(pessoasEl.value) || 1;
    const descEl = document.querySelector(`input[oninput*="updTranspField(${t.id},'descricao'"]`);
    if (descEl) t.descricao = descEl.value;
    const obsEl = document.querySelector(`input[oninput*="updTranspField(${t.id},'observacao'"]`);
    if (obsEl) t.observacao = obsEl.value;
  });
  // Experiências
  state.orcamento.experiencias.forEach(e => {
    const precoEl = document.querySelector(`input[oninput*="updExpNum(${e.id},'preco'"]`);
    if (precoEl) e.preco = parseFloat(precoEl.value) || 0;
    const pessoasEl = document.querySelector(`input[oninput*="updExpNum(${e.id},'pessoas'"]`);
    if (pessoasEl) e.pessoas = parseFloat(pessoasEl.value) || 1;
    const nomeEl = document.querySelector(`input[oninput*="updExpField(${e.id},'nome'"]`);
    if (nomeEl) e.nome = nomeEl.value;
  });
  // Itens Adicionais
  (state.orcamento.itensAdicionais || []).forEach(item => {
    const valorEl = document.querySelector(`input[oninput*="updItemAdicionalNum(${item.id},'valor'"]`);
    if (valorEl) item.valor = parseFloat(valorEl.value) || 0;
    const descEl = document.querySelector(`input[oninput*="updItemAdicionalField(${item.id},'descricao'"]`);
    if (descEl) item.descricao = descEl.value;
  });
  // Campos do cliente
  state.orcamento.cliente = {
    nome: document.getElementById('clienteNome').value,
    adultos: document.getElementById('clienteAdultos').value, criancas: document.getElementById('clienteCriancas').value,
    dataOrcamento: document.getElementById('clienteDataOrcamento').value
  };
  state.orcamento.consultoria = {
    ativa: document.getElementById('consultoriaToggle').checked,
    valor: parseFloat(document.getElementById('consultoriaValor').value) || 0,
    descricao: document.getElementById('consultoriaDesc').value
  };
}

// ── PREVIEW / PDF ─────────────────────────────────────────────────────────────
function setupPreview() {
  document.getElementById('btnPreview').addEventListener('click', ()=>{
    renderPreview();
    const wrapper = document.getElementById('orcamentosEditorWrapper');
    if (wrapper && wrapper.style.display === 'block') {
      wrapper.style.display = 'none';
      document.getElementById('orcamentosPreviewWrapper').style.display = 'block';
    } else {
      document.getElementById('previewOverlay').classList.remove('hidden');
    }
  });
  document.getElementById('btnPrint').addEventListener('click', ()=>{
    renderPreview();
    document.getElementById('previewOverlay').classList.remove('hidden');
    setTimeout(()=>{
      triggerPrint();
    }, 400);
  });
  document.getElementById('btnClosePreview').addEventListener('click', () => {
    document.getElementById('previewOverlay').classList.add('hidden');
    document.body.style.overflow = '';
  });
  document.getElementById('btnPrintFromPreview').addEventListener('click', ()=>{
    triggerPrint();
  });
}

function triggerPrint() {
  const nomeOrc = document.getElementById('orcNome')?.value || document.getElementById('clienteNome')?.value || 'sem nome';
  const cleanNome = ('Cotação ' + nomeOrc).replace(/[^a-zA-Z0-9À-ÿ _-]/g,'');
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

  if (isMobile) {
    const previewContainer = document.getElementById('previewContainer');
    if (!previewContainer) {
      showToast('Erro ao obter pré-visualização.');
      return;
    }
    const previewHtml = previewContainer.innerHTML;
    
    // Abrir uma janela/aba dedicada para impressão em dispositivos móveis
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Por favor, permita pop-ups para gerar o PDF.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${cleanNome}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="${window.location.origin}/css/style.css?v=premium_vis4">
        <style>
          /* Estilo premium da barra explicativa */
          .mobile-print-bar {
            background: #2C1A1D;
            color: #fff;
            padding: 16px 20px;
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            position: sticky;
            top: 0;
            left: 0;
            right: 0;
            z-index: 100000;
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: center;
            border-bottom: 2px solid #C4A35A;
          }
          .mobile-print-bar h3 {
            margin: 0;
            color: #E8D5A3;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
          }
          .mobile-print-bar p {
            margin: 0;
            font-size: 12px;
            color: #D3C3B3;
            text-align: center;
            line-height: 1.5;
          }
          .mobile-print-actions {
            display: flex;
            gap: 10px;
            width: 100%;
            max-width: 400px;
          }
          .mobile-print-btn {
            flex: 1;
            background: #6B1F2A;
            color: #fff;
            border: 1px solid #C4A35A;
            padding: 10px 16px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            text-align: center;
            transition: all 0.2s;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          }
          .mobile-print-btn.btn-close {
            background: rgba(255,255,255,0.1);
            border-color: rgba(255,255,255,0.2);
          }
          .mobile-print-btn:active {
            transform: scale(0.98);
            opacity: 0.9;
          }

          /* Estilos de visualização na tela do celular para permitir scroll nativo completo */
          html, body {
            overflow: auto !important;
            height: auto !important;
            min-height: 100% !important;
            background: #E8E4DE !important;
            margin: 0;
            padding: 0;
            -webkit-overflow-scrolling: touch;
          }
          #previewOverlay {
            display: block !important;
            position: relative !important;
            z-index: 1 !important;
            background: transparent !important;
            height: auto !important;
            overflow: visible !important;
            inset: auto !important;
            flex-direction: row !important;
          }
          #previewContainer {
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            padding: 16px 12px !important;
            background: transparent !important;
            justify-content: normal !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
          }

          /* Oculta a barra explicativa no print e garante quebra de páginas em múltiplos folhas no celular */
          @media print {
            .mobile-print-bar {
              display: none !important;
            }
            body > * {
              display: none !important;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
              overflow: visible !important;
              height: auto !important;
            }
            #previewOverlay {
              display: block !important;
              position: relative !important; /* Permite a quebra de página */
              top: auto !important;
              left: auto !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              background: white !important;
              z-index: auto !important;
              inset: auto !important;
            }
            #previewContainer {
              display: block !important;
              position: relative !important;
              padding: 0 !important;
              margin: 0 !important;
              overflow: visible !important;
              height: auto !important;
              min-height: auto !important;
              background: white !important;
              width: 100% !important;
              max-width: 100% !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="mobile-print-bar">
          <h3>Como gerar o PDF no Celular</h3>
          <p>
            1. Toque no botão <b>"Imprimir / Salvar"</b> abaixo.<br>
            2. Se a tela de impressão não abrir ou abrir em branco, use a opção de <b>Compartilhar</b> do navegador (Safari ou Chrome) e escolha <b>"Salvar em Arquivos"</b>, <b>"Exportar como PDF"</b> ou <b>"Imprimir"</b>.
          </p>
          <div class="mobile-print-actions">
            <button class="mobile-print-btn btn-close" onclick="window.close()">✕ Fechar</button>
            <button class="mobile-print-btn" onclick="window.print()">🖨 Imprimir / Salvar</button>
          </div>
        </div>
        <div id="previewOverlay" class="preview-overlay" style="display: block !important; position: static !important; background: white !important; height: auto !important; overflow: visible !important;">
          <div id="previewContainer" class="preview-container">
            ${previewHtml}
          </div>
        </div>
        <script>
          // Espera as fontes e estilos carregarem por completo para disparar o print nativo automaticamente
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 600);
          };
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  } else {
    // Desktop original
    const oldTitle = document.title;
    document.title = cleanNome;
    showPrintTip();
    setTimeout(() => window.print(), 100);
    setTimeout(() => { document.title = oldTitle; }, 1000);
  }
}

function renderPreview() {
  const o = state.orcamento;
  const usd = getUSD();
  
  // Só faz a sincronização de DOM se o editor estiver visível
  const editorVisivel = document.getElementById('orcamentosEditorWrapper') && document.getElementById('orcamentosEditorWrapper').style.display === 'block';
  if (editorVisivel) {
    syncDOMToState();
  }

  const nomeCliente = editorVisivel ? (document.getElementById('clienteNome').value || 'Cliente') : (o.cliente?.nome || 'Cliente');
  const ad = editorVisivel ? (parseInt(document.getElementById('clienteAdultos')?.value)||0) : (parseInt(o.cliente?.adultos)||0);
  const cr = editorVisivel ? (parseInt(document.getElementById('clienteCriancas')?.value)||0) : (parseInt(o.cliente?.criancas)||0);
  let txtPessoas = '';
  if(ad) txtPessoas += `${ad} Ad`;
  if(cr) txtPessoas += `, ${cr} Cr`;
  const periodo = txtPessoas;
  const dataOrc     = editorVisivel ? (document.getElementById('clienteDataOrcamento').value || today()) : (o.cliente?.dataOrcamento || today());
  const consAtiva   = editorVisivel ? document.getElementById('consultoriaToggle').checked : (o.consultoria?.ativa || false);
  const consValor   = editorVisivel ? (parseFloat(document.getElementById('consultoriaValor').value)||0) : (o.consultoria?.valor || 0);
  const consDesc    = editorVisivel ? (document.getElementById('consultoriaDesc').value || 'Roteirização e suporte completo') : (o.consultoria?.descricao || 'Roteirização e suporte completo');
  const orcNome     = editorVisivel ? (document.getElementById('orcNome').value || nomeCliente) : (o.nome || nomeCliente);

  const tT  = (o.tours || []).reduce((s,t)=>s+calcTotalTour(t),0);
  const tTr = (o.transportes || []).reduce((s,t)=>s+calcTotalTransporte(t),0);
  const tEx = (o.experiencias || []).reduce((s,e)=>s+calcTotalExp(e),0);
  const tItens = (o.itensAdicionais||[]).reduce((s,i)=>s+(i.valor||0),0);
  const cons = consAtiva ? consValor : 0;
  const total = tT+tTr+tEx+tItens+cons;
  const sinal = tT*0.30;
  const saldo = tT*0.70;

  const estadiasHTML = (o.estadias || []).length > 0
    ? `<div class="pdf-estadias-grid">${(o.estadias || []).map(e=>{
        const di=e.dataInicio?fmtDataBR(e.dataInicio):''; const df=e.dataFim?fmtDataBR(e.dataFim):'';
        const per=di&&df?`${di} – ${df}`:di||df||'';
        return `<div class="pdf-estadia-item"><div class="pdf-estadia-cidade">${e.cidade||'—'}</div>${per?`<div class="pdf-estadia-datas">${per}</div>`:''} ${e.hotel?`<div class="pdf-estadia-hotel">${e.hotel}</div>`:''}</div>`;
      }).join('')}</div>`
    : '<p style="color:#9A8A78;font-size:13px;font-style:italic">Nenhuma estadia adicionada.</p>';

  const transpRows = (o.transportes || []).map(t=>{
    const total=calcTotalTransporte(t);
    const partes=t.descricao?t.descricao.split('|').map(s=>s.trim()):[];
    const trecho=partes[0]||t.descricao||'—'; const sub=partes.slice(1).join(' · ');
    const taxaLabel=!t.taxaAtiva?'—':`¥${fmt(t.taxaValor)} (${t.taxaTipo==='grupo'?'por grupo':'por pessoa'})`;
    
    let unitHtml = `¥${fmt(t.preco||0)}`;
    let pessHtml = `${t.adultos||0}`;
    if ((t.criancas||0) > 0) {
      unitHtml = `<span style="font-size:9px;color:var(--ink-mid)">Ad:</span> ¥${fmt(t.preco||0)}<br><span style="font-size:9px;color:var(--ink-mid)">Inf:</span> ¥${fmt(t.precoInfantil||0)}`;
      pessHtml = `<span style="font-size:9px;color:var(--ink-mid)">Ad:</span> ${t.adultos||0}<br><span style="font-size:9px;color:var(--ink-mid)">Inf:</span> ${t.criancas||0}`;
    }
    
    return `<tr><td>${t.data?fmtDataBR(t.data):'—'}</td><td><div class="pdf-desc-trecho">${trecho}</div>${sub?`<div class="pdf-desc-sub">${sub}</div>`:''} ${t.observacao?`<div class="pdf-desc-obs">${t.observacao}</div>`:''}</td><td class="num">${unitHtml}</td><td class="num">${pessHtml}</td><td>${taxaLabel}</td><td class="num">¥${fmt(total)}</td><td class="num">${fmtUSD(total*usd)}</td></tr>`;
  }).join('');

  const tourRows = (o.tours || []).map(t=>{
    const formatHTMLForPDF = (str) => {
      if (!str) return '';
      if (/<[a-z][\s\S]*>/i.test(str)) return str; // Already HTML
      return str.split('\n').filter(Boolean).map(p => `<span class="pdf-ponto-box">${p}</span>`).join('');
    };
    const pontos = formatHTMLForPDF(t.pontos);
    const duracaoLabel = t.duracao ? ` · ${t.duracao}` : '';
          const finalValor = calcTotalTour(t);
      const isDesc = t.descontoAtivo && t.desconto > 0;
      const valorHTML = isDesc ? `<span style="text-decoration:line-through; font-size:10px; color:#999; display:block">¥${fmt(t.valor)}</span>¥${fmt(finalValor)}` : `¥${fmt(t.valor)}`;
      return `<tr><td>${t.data?fmtDataBR(t.data):'—'}</td><td><div class="pdf-desc-trecho">${t.descricao||'—'}${duracaoLabel}</div>${pontos?`<div class="pdf-pontos-wrap">${pontos}</div>`:''} ${t.observacao?`<div class="pdf-desc-obs">${t.observacao}</div>`:''}</td><td class="num">${valorHTML}</td><td>${isDesc?t.desconto+'%':'—'}</td></tr>`;
    }).join('');

  const expRows = (o.experiencias || []).map(e=>{
    const total=calcTotalExp(e);
    const taxaLabel=!e.taxaAtiva?'—':`¥${fmt(e.taxaValor)} (${e.taxaTipo==='grupo'?'por grupo':'por pessoa'})`;
    return `<tr><td>${e.data?fmtDataBR(e.data):'—'}</td><td><span class="pdf-exp-nome">${e.nome||'—'}</span>${e.observacao?`<div class="pdf-desc-obs">${e.observacao}</div>`:''}</td><td class="num">¥${fmt(e.preco)}</td><td class="num">${e.pessoas}</td><td>${taxaLabel}</td><td class="num">¥${fmt(total)}</td><td class="num">${fmtUSD(total*usd)}</td></tr>`;
  }).join('');

  const itensRows = (o.itensAdicionais || []).map(item => {
    return `<tr><td><span class="pdf-exp-nome">${item.descricao || '—'}</span></td><td class="num">¥${fmt(item.valor)}</td><td class="num">${fmtUSD(item.valor * usd)}</td></tr>`;
  }).join('');

  const formatTextoHTML = (str, defaultVal) => {
    const val = str || defaultVal;
    if (/<[a-z][\s\S]*>/i.test(val)) return val;
    return val.split('\n').map(l=>l?`<p>${l}</p>`:'').join('');
  };
  const textoObs  = formatTextoHTML(state.config.texto_observacoes, TEXTOS_DEFAULT.observacoes);
  const textoCond = formatTextoHTML(state.config.texto_condicoes, TEXTOS_DEFAULT.condicoes);
  const textoCanc = formatTextoHTML(state.config.texto_cancelamento, TEXTOS_DEFAULT.cancelamentos);
  const tx = o.textos || {};
  const T = {
    coverLabel: tx.coverLabel || 'COTAÇÃO DE VIAGEM',
    coverSub:   tx.coverSub   || '',
    secEstadias:tx.secEstadias|| 'Estadias',
    secTransp:  tx.secTransp  || 'Transporte',
    secTours:   tx.secTours   || 'Tours',
    secExp:     tx.secExp     || 'Experiências',
    secResumo:  tx.secResumo  || 'Resumo Financeiro',
    lblTours:   tx.lblTours   || 'Total Tours',
    lblTransp:  tx.lblTransp  || 'Total Transportes',
    lblExp:     tx.lblExp     || 'Total Experiências',
    lblCons:    tx.lblCons    || 'Roteirização e Suporte',
    lblTotal:   tx.lblTotal   || 'Total Geral',
    lblSinal:   tx.lblSinal   || 'Sinal 30% — Tours',
    secObs:     tx.secObs     || 'Observações Importantes',
    secCond:    tx.secCond    || 'Condições de Pagamento',
    secCanc:    tx.secCanc    || 'Políticas de Cancelamento'
  };

  // Logo em base64 para funcionar no print
  const logoSrc = "data:image/png;base64,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";

  const html = `
  <div class="pdf-doc">
    <div class="pdf-cover">
      <img src="${logoSrc}" class="pdf-cover-logo" alt="Heian Tour" onerror="this.style.display='none'">
      <div class="pdf-cover-divider"></div>
      <div class="pdf-cover-label">Cotação de Serviços</div>
      <div class="pdf-cover-title">${nomeCliente}</div>
      <div class="pdf-cover-meta">
        ${periodo?`<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Grupo</div><div class="pdf-cover-meta-value">${periodo}</div></div>`:''}
        <div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Data</div><div class="pdf-cover-meta-value">${fmtDataBR(dataOrc)}</div></div>
      </div>
    </div>

    <div class="pdf-body">
      <div class="pdf-section">
        <div class="pdf-section-header"><div class="pdf-section-dot"></div><div class="pdf-section-title">${T.secEstadias}</div></div>
        ${estadiasHTML}
      </div>

      ${o.transportes.length>0?`<div class="pdf-section">
        <div class="pdf-section-header"><div class="pdf-section-dot"></div><div class="pdf-section-title">${T.secTransp}</div></div>
        <table class="pdf-table"><thead><tr><th style="width:9%">Data</th><th style="width:36%">Descrição</th><th class="num" style="width:11%">V. Unit. ¥</th><th class="num" style="width:6%">Pess.</th><th style="width:14%">Taxa Adicional</th><th class="num" style="width:12%">Total ¥</th><th class="num" style="width:12%">US$</th></tr></thead>
        <tbody>${transpRows}<tr class="pdf-total-row"><td colspan="5">Total dos transportes contratados</td><td class="num">¥${fmt(tTr)}</td><td class="num">${fmtUSD(tTr*usd)}</td></tr></tbody></table>
      </div>`:''}

      ${o.tours.length>0?`<div class="pdf-section">
        <div class="pdf-section-header"><div class="pdf-section-dot"></div><div class="pdf-section-title">${T.secTours}</div></div>
        <table class="pdf-table"><thead><tr><th style="width:9%">Data</th><th style="width:56%">Descrição</th><th class="num" style="width:16%">Valor ¥</th><th style="width:9%">Desconto</th></tr></thead>
        <tbody>${tourRows}<tr class="pdf-total-row"><td colspan="2">Total dos tours contratados</td><td class="num">¥${fmt(tT)}</td><td class="num">${fmtUSD(tT*usd)}</td></tr>
        <tr class="pdf-total-row"><td colspan="2">Sinal 30% — tours (para reserva das datas)</td><td class="num">¥${fmt(sinal)}</td><td class="num">${fmtUSD(sinal*usd)}</td></tr></tbody></table>
      </div>`:''}

      ${o.experiencias.length>0?`<div class="pdf-section">
        <div class="pdf-section-header"><div class="pdf-section-dot"></div><div class="pdf-section-title">${T.secExp}</div></div>
        <table class="pdf-table"><thead><tr><th style="width:9%">Data</th><th style="width:36%">Experiência</th><th class="num" style="width:11%">V. Unit. ¥</th><th class="num" style="width:6%">Pess.</th><th style="width:14%">Taxa Adicional</th><th class="num" style="width:12%">Total ¥</th><th class="num" style="width:12%">US$</th></tr></thead>
        <tbody>${expRows}<tr class="pdf-total-row"><td colspan="5">Total das experiências (pagamento integral)</td><td class="num">¥${fmt(tEx)}</td><td class="num">${fmtUSD(tEx*usd)}</td></tr></tbody></table>
      </div>`:''}

      ${(o.itensAdicionais||[]).length>0?`<div class="pdf-section">
        <div class="pdf-section-header"><div class="pdf-section-dot"></div><div class="pdf-section-title">Itens Adicionais</div></div>
        <table class="pdf-table"><thead><tr><th style="width:65%">Descrição</th><th class="num" style="width:17%">Valor ¥</th><th class="num" style="width:18%">US$</th></tr></thead>
        <tbody>${itensRows}<tr class="pdf-total-row"><td>Total dos itens adicionais</td><td class="num">¥${fmt(tItens)}</td><td class="num">${fmtUSD(tItens*usd)}</td></tr></tbody></table>
      </div>`:''}

      ${consAtiva&&consValor>0?`<div class="pdf-section">
        <div class="pdf-section-header"><div class="pdf-section-dot"></div><div class="pdf-section-title">${T.lblCons}</div></div>
        <table class="pdf-table"><thead><tr><th style="width:65%">Descrição</th><th class="num">Valor ¥</th><th class="num">US$</th></tr></thead>
        <tbody><tr><td>${consDesc}</td><td class="num">¥${fmt(consValor)}</td><td class="num">${fmtUSD(consValor*usd)}</td></tr></tbody></table>
      </div>`:''}

      <div class="pdf-section">
        <div class="pdf-resumo">
          <div class="pdf-resumo-header">${T.secResumo}</div>
          <div class="pdf-resumo-body">
            ${tT>0?`<div class="pdf-resumo-row subtotal"><span>Total de tours</span><span class="pdf-resumo-valor">¥${fmt(tT)} &nbsp;·&nbsp; ${fmtUSD(tT*usd)}</span></div>`:''}
            ${tTr>0?`<div class="pdf-resumo-row subtotal"><span>Total de transportes</span><span class="pdf-resumo-valor">¥${fmt(tTr)} &nbsp;·&nbsp; ${fmtUSD(tTr*usd)}</span></div>`:''}
            ${tEx>0?`<div class="pdf-resumo-row subtotal"><span>Total de experiências</span><span class="pdf-resumo-valor">¥${fmt(tEx)} &nbsp;·&nbsp; ${fmtUSD(tEx*usd)}</span></div>`:''}
            ${tItens>0?`<div class="pdf-resumo-row subtotal"><span>Total de itens adicionais</span><span class="pdf-resumo-valor">¥${fmt(tItens)} &nbsp;·&nbsp; ${fmtUSD(tItens*usd)}</span></div>`:''}
            ${cons>0?`<div class="pdf-resumo-row subtotal"><span>${T.lblCons}</span><span class="pdf-resumo-valor">¥${fmt(cons)} &nbsp;·&nbsp; ${fmtUSD(cons*usd)}</span></div>`:''}
            <div class="pdf-resumo-row total"><span>Valor total dos serviços contratados</span><span class="pdf-resumo-valor">¥${fmt(total)} &nbsp;·&nbsp; ${fmtUSD(total*usd)}</span></div>
            <div class="pdf-resumo-row sinal"><span>Sinal a pagar agora (30% dos tours)</span><span class="pdf-resumo-valor">¥${fmt(sinal)} &nbsp;·&nbsp; ${fmtUSD(sinal*usd)}</span></div>
            <div class="pdf-resumo-row pagamento"><span>Saldo restante dos tours (70%) — pagar na semana da viagem</span><span class="pdf-resumo-valor">¥${fmt(saldo)} &nbsp;·&nbsp; ${fmtUSD(saldo*usd)}</span></div>
            ${tTr>0?`<div class="pdf-resumo-row pagamento"><span>Transportes — pagamento integral (40–30 dias antes)</span><span class="pdf-resumo-valor">¥${fmt(tTr)} &nbsp;·&nbsp; ${fmtUSD(tTr*usd)}</span></div>`:''}
            ${tEx>0?`<div class="pdf-resumo-row pagamento"><span>Experiências — pagamento integral (40–30 dias antes)</span><span class="pdf-resumo-valor">¥${fmt(tEx)} &nbsp;·&nbsp; ${fmtUSD(tEx*usd)}</span></div>`:''}
            ${tItens>0?`<div class="pdf-resumo-row pagamento"><span>Itens adicionais — pagamento integral (40–30 dias antes)</span><span class="pdf-resumo-valor">¥${fmt(tItens)} &nbsp;·&nbsp; ${fmtUSD(tItens*usd)}</span></div>`:''}
          </div>
        </div>
      </div>

      <div class="pdf-footer" style="page-break-before:avoid">
        <div class="pdf-footer-divider"></div>
        <div class="pdf-footer-section"><div class="pdf-footer-title">Observações Importantes</div><div class="pdf-footer-text">${textoObs}</div></div>
        <div class="pdf-footer-section"><div class="pdf-footer-title">Condições de Pagamento</div><div class="pdf-footer-text">${textoCond}</div></div>
        <div class="pdf-footer-section"><div class="pdf-footer-title">Políticas de Adiamento e Cancelamento</div><div class="pdf-footer-text">${textoCanc}</div></div>
        <div class="pdf-colophon">
          <div class="pdf-colophon-brand">HEIAN <span>TOUR</span></div>
          <div class="pdf-colophon-date">Cotação gerada em ${fmtDataBR(dataOrc)}</div>
        </div>
      </div>
    </div>
  </div>`;
  
  const contOverlay = document.getElementById('previewContainer');
  if (contOverlay) contOverlay.innerHTML = html;
  
  const contInline = document.getElementById('previewContainerInline');
  if (contInline) contInline.innerHTML = html;
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function openModal() { document.getElementById('modalOverlay').classList.remove('hidden'); document.getElementById('modalClose').onclick=closeModal; document.getElementById('modalOverlay').onclick=e=>{if(e.target===document.getElementById('modalOverlay'))closeModal();}; }
function closeModal() { document.getElementById('modalOverlay').classList.add('hidden'); }

// ── FORMATAÇÃO ────────────────────────────────────────────────────────────────
function fmt(n) { return Math.round(n||0).toLocaleString('pt-BR'); }
function fmtUSD(n) { return (n||0).toLocaleString('en-US',{style:'currency',currency:'USD'}); }
function v(id) { return document.getElementById(id)?.value||''; }
function fmtDataBR(str) { if(!str) return '—'; const [y,m,d]=str.split('-'); return `${d}/${m}/${y}`; }
function fmtDate(iso) { if(!iso) return '—'; return new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function showPrintTip() {
  const old = document.getElementById('printTip');
  if (old) old.remove();
  const tip = document.createElement('div');
  tip.id = 'printTip';
  tip.innerHTML = `<b>Dica de impressão:</b><br>No diálogo → <b>Mais configurações</b>:<br>
    • Desmarque <b>"Cabeçalhos e rodapés"</b><br>
    • Marque <b>"Gráficos de fundo"</b> para manter as cores`;
  Object.assign(tip.style, {
    position:'fixed', bottom:'80px', right:'28px', background:'#2C1A1D', color:'white',
    padding:'14px 18px', borderRadius:'8px', fontSize:'12px', fontFamily:'Jost,sans-serif',
    lineHeight:'1.8', zIndex:9999, maxWidth:'340px', boxShadow:'0 4px 20px rgba(0,0,0,0.4)',
    border:'1px solid rgba(196,163,90,0.3)'
  });
  document.body.appendChild(tip);
  setTimeout(() => { tip.style.transition='opacity 0.4s'; tip.style.opacity='0'; setTimeout(()=>tip.remove(),400); }, 7000);
}

function showToast(msg) {
  const t=document.createElement('div'); t.textContent=msg;
  Object.assign(t.style,{position:'fixed',bottom:'28px',right:'28px',background:'#6B1F2A',color:'white',padding:'12px 22px',borderRadius:'6px',fontSize:'13px',fontFamily:'Jost,sans-serif',letterSpacing:'0.04em',zIndex:9999,boxShadow:'0 4px 20px rgba(0,0,0,0.25)',transition:'opacity 0.4s'});
  document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),400);},2200);
}

// ── MENSAGENS RÁPIDAS (OBSERVAÇÕES HÍBRIDAS) ───────────────────────────────────
function renderSugestoesHtml(id, tipo, sugestoesTexto) {
  if (!sugestoesTexto) return '';
  const sugestoes = sugestoesTexto.split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  if (sugestoes.length === 0) return '';

  const dropdownHtml = `
    <div class="sugestoes-dropdown" id="dropdown-${tipo}-${id}">
      ${sugestoes.map(sug => {
        const sugEscaped = escapeHtml(sug);
        return `<button type="button" class="sugestoes-dropdown-item" data-texto="${sugEscaped}" onclick="aplicarSugestao(${id}, '${tipo}', this)">${sugEscaped}</button>`;
      }).join('')}
    </div>
  `;

  return `
    <div class="sugestoes-wrap">
      <button type="button" class="btn-sugestao-menu" onclick="toggleSugestoesDropdown(${id}, '${tipo}', event)">📋 Biblioteca</button>
      ${dropdownHtml}
    </div>
  `;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function aplicarSugestao(id, tipo, el) {
  const texto = el.dataset.texto;
  const input = document.getElementById(`obs-${tipo}-${id}`);
  if (input) {
    let valorAtual = input.value.trim();
    if (valorAtual) {
      if (valorAtual.includes(texto)) return;
      input.value = valorAtual + ' · ' + texto;
    } else {
      input.value = texto;
    }
    
    if (tipo === 'tour') {
      updTourField(id, 'observacao', input.value);
    } else if (tipo === 'transporte') {
      updTranspField(id, 'observacao', input.value);
    } else if (tipo === 'experiencia') {
      updExpField(id, 'observacao', input.value);
    }
  }
}

function toggleSugestoesDropdown(id, tipo, event) {
  event.stopPropagation();
  document.querySelectorAll('.sugestoes-dropdown').forEach(dd => {
    if (dd.id !== `dropdown-${tipo}-${id}`) {
      dd.classList.remove('show');
    }
  });

  const dropdown = document.getElementById(`dropdown-${tipo}-${id}`);
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
}

// Fechamento de dropdowns ao clicar fora
document.addEventListener('click', () => {
  document.querySelectorAll('.sugestoes-dropdown').forEach(dd => {
    dd.classList.remove('show');
  });
});

// ── ROTEIRO VINCULADO ────────────────────────────────────────────────────────
window.preencherSelectRoteiroVinculado = function(selectVal = '') {
  const sel = document.getElementById('orcRoteiroVinculado');
  if (!sel) return;
  sel.innerHTML = '<option value="">Nenhum roteiro vinculado</option>';
  // dbRotas é populado no roteiros.js
  if (typeof dbRotas !== 'undefined') {
    Object.keys(dbRotas).forEach(r => {
      const opt = document.createElement('option');
      opt.value = r; opt.textContent = r;
      sel.appendChild(opt);
    });
  }
  if (selectVal) sel.value = selectVal;
};

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(preencherSelectRoteiroVinculado, 1000); // Aguarda dbRotas carregar

  document.getElementById('btnGerarRoteiroEstadias')?.addEventListener('click', async () => {
    if (!state.orcamento.estadias || state.orcamento.estadias.length === 0) {
      return alert('Adicione pelo menos uma estadia para gerar o roteiro.');
    }

    const defaultName = document.getElementById('orcNome').value || (document.getElementById('clienteNome').value ? 'Roteiro ' + document.getElementById('clienteNome').value : 'Novo Roteiro');
    const nomeRoteiro = prompt('Digite um nome para este roteiro (será salvo na base):', defaultName);
    if (!nomeRoteiro) return;

    const btn = document.getElementById('btnGerarRoteiroEstadias');
    btn.textContent = 'Gerando...'; btn.disabled = true;

    // Constrói os dias com base nas noites
    let diasList = [];
    state.orcamento.estadias.forEach(est => {
      let noites = 1;
      if (est.dataInicio && est.dataFim) {
        const d1 = new Date(est.dataInicio);
        const d2 = new Date(est.dataFim);
        noites = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        if (noites < 1 || isNaN(noites)) noites = 1;
      }
      for (let i = 0; i < noites; i++) {
        diasList.push({
          cidade: est.cidade || '',
          nomeDaRota: '',
          atracoesDoDia: []
        });
      }
    });

    // Constrói objeto novo Roteiro
    const novoRoteiroObj = {
      cliente: {
        nome: document.getElementById('clienteNome').value,
        adultos: document.getElementById('clienteAdultos').value || '2',
        criancas: document.getElementById('clienteCriancas').value || '0',
        dataOrcamento: document.getElementById('clienteDataOrcamento').value,
        notionClienteId: state.orcamento ? state.orcamento.notionClienteId : ''
      },
      dias: diasList
    };

    try {
      const res = await fetch(`/api/roteiros/${encodeURIComponent(nomeRoteiro)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoRoteiroObj)
      });

      if (res.ok) {
        // Atualizar memória se o roteiros.js já tiver carregado
        if (typeof dbRotas !== 'undefined') {
          dbRotas[nomeRoteiro] = novoRoteiroObj;
        }
        
        // Atualizar selects de roteiro (da cotação e da aba roteiros)
        preencherSelectRoteiroVinculado(nomeRoteiro);
        if (typeof preencherSelectRoteiros === 'function') {
          preencherSelectRoteiros(nomeRoteiro);
        }
        
        alert('Roteiro criado com sucesso!\nVocê pode editá-lo indo em "Visualizador de Roteiros" no menu lateral.');
        
        // Dispara autoSave para gravar o vínculo no localStorage da cotação
        if (typeof autoSave === 'function') autoSave();
      } else {
        alert('Erro ao criar roteiro no servidor.');
      }
    } catch (e) {
      alert('Erro de conexão ao criar roteiro.');
    }
    
    btn.textContent = 'Gerar Esqueleto via Estadias'; btn.disabled = false;
  });
  
  document.getElementById('orcRoteiroVinculado')?.addEventListener('change', (e) => {
    const rNome = e.target.value;
    if (rNome && typeof dbRotas !== 'undefined' && dbRotas[rNome]) {
      const rot = dbRotas[rNome];
      if (rot.cliente) {
        // Puxa dados pro orçamento se estiverem vazios
        if (!document.getElementById('clienteNome').value) document.getElementById('clienteNome').value = rot.cliente.nome || '';
        if (document.getElementById('clienteAdultos').value === '2' && rot.cliente.adultos) document.getElementById('clienteAdultos').value = rot.cliente.adultos;
        if (document.getElementById('clienteCriancas').value === '0' && rot.cliente.criancas) document.getElementById('clienteCriancas').value = rot.cliente.criancas;
      }
    }
    if (typeof autoSave === 'function') autoSave();
  });
});



// ── ROTAS (ABA ADMIN) ────────────────────────────────────────────────────────
function renderTabelaRotas(filtro) {
  if (filtro === undefined) {
    const el = document.getElementById('searchRota');
    filtro = el ? el.value : '';
  }
  const tbody = document.querySelector('#tabelaRotas tbody');
  if(!tbody) return;
  const lista = filtro ? state.rotasDB.filter(r => [r.cidade, r.nomeDaRota].join(' ').toLowerCase().includes(filtro.toLowerCase())) : state.rotasDB;
  tbody.innerHTML = lista.map(r => `<tr>
    <td>${r.cidade || ''}</td>
    <td>${r.nomeDaRota || ''}</td>
    <td>${(r.atracoesDoDia || []).join(', ')}</td>
          <td>
        <button class="btn-icon" onclick="editarRota(${r.id})">✏️</button>
        <button class="btn-icon" onclick="deletarRota(${r.id})">❌</button>
      </td>
  </tr>`).join('');
}


function abrirModalRota(r = null) {
  const isEdit = !!r;
  const id = r ? r.id : '';
  const cidade = r ? (r.cidade || '') : '';
  const nomeDaRota = r ? (r.nomeDaRota || '') : '';
  const atracoes = r ? (r.atracoesDoDia || []) : [];

  // Obter cidades únicas
  const cidadesSet = new Set();
  if (state.atracoesDB) {
    state.atracoesDB.forEach(a => {
      if (a.Cidade) cidadesSet.add(a.Cidade.trim());
    });
  }
  if (cidade) cidadesSet.add(cidade); // Garante que a cidade atual apareça mesmo se não tiver atração
  const cidadesOpts = Array.from(cidadesSet).sort();

  const optionsHTML = '<option value="">-- Selecione uma Cidade --</option>' + 
    cidadesOpts.map(c => `<option value="${c}" ${c === cidade ? 'selected' : ''}>${c}</option>`).join('');

  const html = `
    <h2 style="margin-bottom:16px">${isEdit ? 'Editar Rota' : 'Nova Rota'}</h2>
    <div class="form-grid">
      <div class="field">
        <label>Cidade</label>
        <select id="modalRotCidade" onchange="window.renderModalRotasUI()">
          ${optionsHTML}
        </select>
      </div>
      <div class="field"><label>Nome da Rota (Sequência)</label><input type="text" id="modalRotNome" value="${nomeDaRota}" placeholder="Ex: Tokyo Clássico"></div>
    </div>
    
    <div class="field" style="margin-top: 16px;">
      <label>Atrações Selecionadas na Rota (Arraste para reordenar, clique no 'x' para remover)</label>
      <div id="modalRotSelected" class="modal-rot-selected" style="min-height: 48px; padding: 12px; border: 1px dashed var(--gold); border-radius: 6px; background: rgba(196,163,90,0.05); display: flex; flex-wrap: wrap; gap: 8px;">
      </div>
    </div>

    <div class="field" style="margin-top: 16px;">
            <div class="field" style="margin-top: 16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
          <label style="margin:0">Atrações Disponíveis (Clique para adicionar)</label>
          <input type="text" id="modalRotSearch" placeholder="🔍 Buscar..." oninput="window.renderModalRotasUI()" style="width:250px; padding:4px 8px; font-size:13px; border:1px solid #ccc; border-radius:4px;">
        </div>
        <div id="modalRotAvailable" style="max-height: 200px; overflow-y: auto; padding: 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-alt); display: flex; flex-wrap: wrap; gap: 8px;">
      </div>
    </div>
    
    <div style="display:flex;justify-content:flex-end;margin-top:24px">
      <button class="btn-primary" onclick="salvarRotaModal(${id ? `'${id}'` : 'null'})">Salvar no Sheets</button>
    </div>
  `;
  document.getElementById('modalContent').innerHTML = html;
  
  // Expor a função globalmente para o onchange do select
  window._tempAtracoesSelecionadas = [...atracoes]; // guardar para marcar
  window.renderModalRotasUI();

  openModal();
}

window.renderModalRotasUI = function() {
  const cidadeSelect = document.getElementById('modalRotCidade');
  const selContainer = document.getElementById('modalRotSelected');
  const availContainer = document.getElementById('modalRotAvailable');
  if (!cidadeSelect || !selContainer || !availContainer) return;

  const cidade = cidadeSelect.value;
  if (!cidade) {
    selContainer.innerHTML = '';
    availContainer.innerHTML = '<span style="color:var(--ink-lt); font-size:12px;">Selecione uma cidade primeiro.</span>';
    return;
  }

  const atracoesDaCidade = state.atracoesDB.filter(a => (a.Cidade || '').trim() === cidade).map(a => a['Nome da Atração']).filter(Boolean);
  
  selContainer.innerHTML = '';
  if (window._tempAtracoesSelecionadas.length === 0) {
    selContainer.innerHTML = '<span style="color:var(--ink-lt); font-size:12px; margin:auto">Nenhuma atração selecionada.</span>';
  } else {
    window._tempAtracoesSelecionadas.forEach((nome, i) => {
      const chip = document.createElement('div');
      chip.className = 'chip-atracao';
      chip.style.display = 'inline-flex';
      chip.style.alignItems = 'center';
      chip.style.gap = '8px';
      chip.draggable = true;
      chip.innerHTML = `<span>${nome}</span><span onclick="window.removerAtracaoModal(${i})" style="color:var(--crimson); cursor:pointer; font-weight:bold; padding-left:4px">&times;</span>`;
      
      chip.addEventListener('dragstart', (e) => { window._dragModalIdx = i; e.dataTransfer.effectAllowed = 'move'; chip.style.opacity = '0.5'; });
      chip.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      chip.addEventListener('drop', (e) => {
        e.preventDefault();
        chip.style.opacity = '1';
        if (window._dragModalIdx === undefined || window._dragModalIdx === i) return;
        const arr = window._tempAtracoesSelecionadas;
        const item = arr.splice(window._dragModalIdx, 1)[0];
        arr.splice(i, 0, item);
        window._dragModalIdx = undefined;
        renderModalRotasUI();
      });
      chip.addEventListener('dragend', () => { chip.style.opacity = '1'; });
      selContainer.appendChild(chip);
    });
  }
  
  availContainer.innerHTML = '';
  const busca = (document.getElementById('modalRotSearch')?.value || '').trim().toLowerCase();
    const disponiveis = atracoesDaCidade.filter(a => !window._tempAtracoesSelecionadas.includes(a) && a.toLowerCase().includes(busca));
  if (disponiveis.length === 0) {
    availContainer.innerHTML = '<span style="color:var(--ink-lt); font-size:12px;">Todas as atrações da cidade já foram adicionadas.</span>';
  } else {
    disponiveis.forEach(nome => {
      const chip = document.createElement('div');
      chip.className = 'chip-atracao';
      chip.style.background = 'var(--cream)';
      chip.style.color = 'var(--ink-mid)';
      chip.style.border = '1px dashed var(--border-dk)';
      chip.textContent = '+ ' + nome;
      chip.onclick = () => {
        window._tempAtracoesSelecionadas.push(nome);
        renderModalRotasUI();
      };
      availContainer.appendChild(chip);
    });
  }
};

window.removerAtracaoModal = function(idx) {
  window._tempAtracoesSelecionadas.splice(idx, 1);
  renderModalRotasUI();
};

if(document.getElementById('btnNovaRota')) {
  document.getElementById('btnNovaRota').addEventListener('click', () => abrirModalRota());
}

async function salvarRotaModal(id) {
  const cidade = document.getElementById('modalRotCidade').value.trim();
  const nomeDaRota = document.getElementById('modalRotNome').value.trim();
  
  // Pegar todas as atrações marcadas
  const atracoesDoDia = window._tempAtracoesSelecionadas || [];

  if (!cidade || !nomeDaRota) return alert('Cidade e Nome são obrigatórios!');
  
  const payload = { cidade, nomeDaRota, atracoesDoDia };
  
  try {
    const url = id ? `/api/rotas-base/${id}` : '/api/rotas-base';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Erro ao salvar Rota');
    
    closeModal();
    loadDB();
    showToast('Rota salva no App e enviada ao Sheets!');
  } catch (err) {
    alert('Erro ao salvar: ' + err.message);
  }
}

window.editarRota = function(id) {
    const r = state.rotasDB.find(x => x.id == id);
    if (r) abrirModalRota(r);
};

window.deletarRota = async function(id) {
    if(!confirm('Remover esta Rota Base do App e da Planilha?')) return;
    try {
      const res = await fetch(`/api/rotas-base/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao deletar Rota Base');
      state.rotasDB = state.rotasDB.filter(x => x.id != id);
      renderTabelaRotas();
      showToast('Rota deletada com sucesso!');
    } catch (err) {
      alert(err.message);
    }
};

// ── NOTION SETUP ────────────────────────────────────────────────────────────
let notionClients = [];
window.notionClients = notionClients;

function setupNotion() {
  const btn = document.getElementById('btnImportNotion');
  const selectWrapper = document.getElementById('notionSelectWrapper');
  const select = document.getElementById('notionClienteSelect');

  if (!btn || !select) return;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (selectWrapper.style.display === 'none') {
      selectWrapper.style.display = 'block';
      if (notionClients.length === 0) {
        select.innerHTML = '<option>Carregando clientes...</option>';
        try {
          const res = await fetch('/api/notion/clientes?t=' + Date.now(), { cache: 'no-store' });
          if (!res.ok) throw new Error('Erro na API');
          notionClients = await res.json(); window.notionClients = notionClients;
        } catch (e) {
          console.error(e);
          select.innerHTML = '<option>Erro ao carregar do Notion</option>';
          return;
        }
      }
      let html = '<option value="">Selecione um cliente...</option>';
      notionClients.forEach(c => {
        html += `<option value="${c.id}">${c.nome} (${c.status || 'Sem status'})</option>`;
      });
      select.innerHTML = html;
    } else {
      selectWrapper.style.display = 'none';
    }
  });

  select.addEventListener('change', async (e) => {
    const id = e.target.value;
    if (!id) return;
    const c = notionClients.find(x => x.id === id);
    if (c) {
      const existingOrcs = state.orcamentosDB.filter(o => o.notionClienteId === c.id || (o.cliente && o.cliente.nome === c.nome));
      if (existingOrcs.length > 0) {
        const msg = `Já existe(m) ${existingOrcs.length} cotação(ões) para o cliente "${c.nome}".\nDeseja criar uma NOVA cotação mesmo assim?\n\n(Clique em Cancelar para abortar e abrir a existente pela lista de Cotações)`;
        if (!confirm(msg)) {
          selectWrapper.style.display = 'none';
          select.value = '';
          return;
        }
      }
      state.orcamento.notionClienteId = c.id;
      document.getElementById('orcNome').value = `Cotação - ${c.nome}`;
      document.getElementById('clienteNome').value = c.nome;
      document.getElementById('clienteAdultos').value = c.adultos || 2;
      document.getElementById('clienteCriancas').value = c.criancas || 0;

      // Puxa estadias salvas localmente ou faz o parse automático
      try {
        const resLocal = await fetch('/api/clientes/local/' + c.id + '?t=' + Date.now(), { cache: 'no-store' });
        const cLocal = await resLocal.json();
        let fetchedEstadias = [];
        if (cLocal && cLocal.estadias && cLocal.estadias.length > 0) {
          fetchedEstadias = cLocal.estadias;
        } else if (c.hotel) {
          c.hotel.split('\n').filter(l => l.trim()).forEach(line => {
            let cidade = ''; let hotel = line.trim(); let dataInicio = ''; let dataFim = '';
            const dateMatch = line.match(/\b\d{2}\/\d{2}\b/);
            if (dateMatch) {
              const strDates = line.substring(dateMatch.index);
              const dParts = strDates.split(' a ').map(s => s.trim());
              const year = new Date().getFullYear();
              if (dParts[0]) { const p = dParts[0].split('/'); dataInicio = year + '-' + p[1] + '-' + p[0]; }
              if (dParts[1]) { const p = dParts[1].split('/'); dataFim = year + '-' + p[1] + '-' + p[0]; }
              hotel = line.substring(0, dateMatch.index).trim();
            }
            const dashIndex = hotel.indexOf(' - ');
            if (dashIndex > -1) { cidade = hotel.substring(0, dashIndex).trim(); hotel = hotel.substring(dashIndex + 3).trim(); }
            fetchedEstadias.push({ id: Date.now() + Math.random(), cidade, dataInicio, dataFim, hotel });
          });
        }
        state.orcamento.estadias = fetchedEstadias;
        if(typeof renderEstadiasList === 'function') renderEstadiasList();
      } catch(e) { console.error('Erro ao processar estadias', e) }

      try { updateStateFromUI(); } catch(e) { console.error('updateStateFromUI failed:', e) }
      selectWrapper.style.display = 'none';
      select.value = '';
      const bEdit = document.getElementById('btnEditarClienteCotacao'); if(bEdit) bEdit.innerHTML = '👤 Editar Cliente';
      alert('Dados do cliente ' + c.nome + ' importados do Notion com sucesso!');
    }
  });
}

// ── CLIENTES NOTION (TAB) ───────────────────────────────────────────────────
let currentEditingClienteId = null;
let currentEditingEstadias = [];
let currentEditingViajantes = [];
let currentEditingEmails = [];
let editFotoPerfilBase64 = "";

window.previewEditFotoPerfil = function(input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 250 * 1024) {
    alert("A imagem selecionada é muito grande. Por favor, escolha uma imagem de até 250KB.");
    input.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    editFotoPerfilBase64 = e.target.result;
    const container = document.getElementById('mcFotoPerfilPreview');
    if (container) {
      container.innerHTML = `<img src="${editFotoPerfilBase64}" style="width:100%; height:100%; object-fit:cover;">`;
    }
    const btnRemover = document.getElementById('mcBtnRemoverFoto');
    if (btnRemover) btnRemover.style.display = 'inline-block';
  };
  reader.readAsDataURL(file);
};

window.removerEditFotoPerfil = function() {
  editFotoPerfilBase64 = "";
  const fileInput = document.getElementById('mcFotoPerfilFile');
  if (fileInput) fileInput.value = "";
  const container = document.getElementById('mcFotoPerfilPreview');
  if (container) {
    const nome = document.getElementById('mcNome').value || "Cliente";
    container.innerHTML = window.obterAvatarFallbackHTML(nome);
  }
  const btnRemover = document.getElementById('mcBtnRemoverFoto');
  if (btnRemover) btnRemover.style.display = 'none';
};

window.obterAvatarFallbackHTML = function(nome) {
  const iniciais = obterIniciaisNome(nome);
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const bg = `hsl(${hue}, 45%, 50%)`;
  return `<div class="client-avatar-fallback" style="background-color: ${bg}; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff;">${iniciais}</div>`;
};

function obterIniciaisNome(nome) {
  if (!nome) return "HT";
  const partes = nome.trim().split(/\s+/);
  if (partes.length >= 2) {
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }
  return partes[0].substring(0, 2).toUpperCase();
}

function setupClientesTab() {
  const btnRefresh = document.getElementById('btnRefreshClientes');
  const btnNovo = document.getElementById('btnNovoCliente');
  const btnSalvar = document.getElementById('btnSalvarClienteModal');
  
  if(btnRefresh) btnRefresh.addEventListener('click', loadClientesTabela);
  if(btnNovo) btnNovo.addEventListener('click', () => {
    if (typeof navToPage === 'function') navToPage('clientes');
    abrirClienteModal();
  });
  if(btnSalvar) btnSalvar.addEventListener('click', salvarClienteNotion);
  const btnAdd = document.getElementById('btnAddEstadia');
  if(btnAdd) btnAdd.addEventListener('click', () => {
    currentEditingEstadias.push({ id: Date.now(), cidade: '', dataInicio: '', dataFim: '', hotel: '' });
    renderEstadiasForm();
  });

  // Viajantes
  const btnAddViajante = document.getElementById('btnAddViajante');
  if(btnAddViajante) btnAddViajante.addEventListener('click', () => {
    currentEditingViajantes.push({ id: Date.now(), nome: '', sobrenome: '', idade: '' });
    renderViajantesForm();
  });

  // Emails
  const btnAddEmail = document.getElementById('btnAddEmail');
  if(btnAddEmail) btnAddEmail.addEventListener('click', () => {
    currentEditingEmails.push({ id: Date.now(), email: '' });
    renderEmailsForm();
  });

  // Load clients when clicking the menu item
  document.querySelector('.nav-item[data-page="clientes"]')?.addEventListener('click', () => {
    if (notionClients.length === 0) loadClientesTabela();
    else renderClientesTabela();
  });
}

// ── VIAJANTES (Formulário dinâmico) ─────────────────────────────────────────
function renderViajantesForm() {
  const cont = document.getElementById('viajantesList');
  if(!cont) return;
  cont.innerHTML = '';
  currentEditingViajantes.forEach((v, i) => {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div class="item-row-header">
        <span class="item-row-num">Viajante ${i+1}</span>
        <button class="btn-remove" onclick="rmViajante(${v.id})">✕</button>
      </div>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr 80px;">
        <div class="field"><label>Nome</label><input type="text" value="${v.nome}" placeholder="Nome" oninput="updViajante(${v.id},'nome',this.value)"></div>
        <div class="field"><label>Sobrenome</label><input type="text" value="${v.sobrenome}" placeholder="Sobrenome" oninput="updViajante(${v.id},'sobrenome',this.value)"></div>
        <div class="field"><label>Idade</label><input type="number" value="${v.idade}" placeholder="0" min="0" max="120" oninput="updViajante(${v.id},'idade',this.value)"></div>
      </div>`;
    cont.appendChild(div);
  });
  updateViajantesResumo();
}

function updateViajantesResumo() {
  const el = document.getElementById('mcViajantesResumo');
  if (!el) return;
  if (currentEditingViajantes.length === 0) { el.textContent = ''; return; }
  let adultos = 0, criancas = 0;
  currentEditingViajantes.forEach(v => {
    const idade = parseInt(v.idade);
    if (isNaN(idade) || idade >= 12) adultos++;
    else criancas++;
  });
  let txt = `${currentEditingViajantes.length} viajante(s)`;
  if (adultos > 0) txt += ` · ${adultos} adulto(s)`;
  if (criancas > 0) txt += ` · ${criancas} criança(s)`;
  el.textContent = txt;
}

window.rmViajante = function(id) { currentEditingViajantes = currentEditingViajantes.filter(v => v.id !== id); renderViajantesForm(); };
window.updViajante = function(id, f, v) { const e = currentEditingViajantes.find(x => x.id === id); if (e) { e[f] = v; if(f === 'idade') updateViajantesResumo(); } };

// ── EMAILS (Formulário dinâmico) ─────────────────────────────────────────────
function renderEmailsForm() {
  const cont = document.getElementById('emailsList');
  if(!cont) return;
  cont.innerHTML = '';
  currentEditingEmails.forEach((em, i) => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex; gap:8px; align-items:center; margin-bottom:6px;';
    const label = i === 0 ? 'E-mail principal (responsável)' : `E-mail ${i+1}`;
    div.innerHTML = `
      <div class="field" style="flex:1; margin-bottom:0;"><label style="font-size:10px;">${label}</label><input type="email" value="${em.email}" placeholder="email@exemplo.com" oninput="updEmail(${em.id},this.value)"></div>
      <button class="btn-remove" onclick="rmEmail(${em.id})" style="margin-top:14px;">✕</button>`;
    cont.appendChild(div);
  });
}

window.rmEmail = function(id) { currentEditingEmails = currentEditingEmails.filter(e => e.id !== id); renderEmailsForm(); };
window.updEmail = function(id, v) { const e = currentEditingEmails.find(x => x.id === id); if (e) e.email = v; };

async function loadClientesTabela() {
  const tbody = document.querySelector('#clientesTable tbody');
  if(tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Atualizando do Notion...</td></tr>';
  
  try {
    const res = await fetch('/api/notion/clientes?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Erro na API');
    notionClients = await res.json(); window.notionClients = notionClients;
    renderClientesTabela();
    if (typeof renderDashboard === 'function') renderDashboard();
  } catch(e) {
    console.error(e);
    if(tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: red;">Erro ao carregar clientes do Notion.</td></tr>';
  }
}

function renderClientesTabela() {
  const listContainer = document.getElementById('tabelaClientesList');
  if(!listContainer) return;
  
  const selectFiltro = document.getElementById('filtroMesAnoClientes');
  if (selectFiltro && (selectFiltro.options.length <= 1 || selectFiltro.dataset.loadedCount != notionClients.length)) {
    selectFiltro.dataset.loadedCount = notionClients.length;
    const selectedValue = selectFiltro.value;
    
    const getMesAnoStr = (dateStr) => {
      if (!dateStr) return null;
      const parts = dateStr.split('-');
      if (parts.length < 2) return null;
      const year = parts[0];
      const monthIdx = parseInt(parts[1]) - 1;
      const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      if (monthIdx < 0 || monthIdx > 11) return null;
      return `${months[monthIdx]}/${year}`;
    };
    
    const periodos = [];
    const chavesPeriodos = new Set();
    notionClients.forEach(c => {
      if (c.dataInicio) {
        const parts = c.dataInicio.split('-');
        if (parts.length >= 2) {
          const key = `${parts[0]}-${parts[1]}`;
          if (!chavesPeriodos.has(key)) {
            chavesPeriodos.add(key);
            periodos.push({ key, label: getMesAnoStr(c.dataInicio) });
          }
        }
      }
    });
    
    periodos.sort((a, b) => a.key.localeCompare(b.key));
    
    selectFiltro.innerHTML = '<option value="">Todos os meses</option>';
    periodos.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.key;
      opt.textContent = p.label;
      selectFiltro.appendChild(opt);
    });
    
    selectFiltro.value = selectedValue;
    if (selectFiltro.value !== selectedValue) {
      selectFiltro.value = "";
    }
  }
  
  const termoNome = (document.getElementById('pesquisaClientesList')?.value || '').toLowerCase();
  const filtroMesAno = selectFiltro ? selectFiltro.value : '';
  
  const clientesFiltrados = notionClients.filter(c => {
    const matchNome = (c.nome || '').toLowerCase().includes(termoNome) || (c.email || '').toLowerCase().includes(termoNome);
    
    let matchMesAno = true;
    if (filtroMesAno) {
      if (c.dataInicio) {
        matchMesAno = c.dataInicio.startsWith(filtroMesAno);
      } else {
        matchMesAno = false;
      }
    }
    
    return matchNome && matchMesAno;
  });

  listContainer.innerHTML = '';

  if(clientesFiltrados.length === 0) {
    listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color:#999;">Nenhum cliente encontrado.</div>';
    return;
  }
  
  clientesFiltrados.forEach(c => {
    let statusColor = '#9c8248'; // aberto
    if(c.status === 'Fechado') statusColor = '#6B1F2A';
    else if(c.status === 'Cancelado') statusColor = '#806A6D';
    
    const isSelected = window.clienteAtualVisualizado === c.id ? 'selected' : '';

    const card = document.createElement('div');
    card.className = 'list-card ' + isSelected;
    card.dataset.id = c.id;
    card.onclick = () => abrirDetalhesCliente(c.id);
    card.onmouseenter = () => hoverCliente(c.id);
    
    let datasViagem = 'Sem data';
    if (c.dataInicio && c.dataFim) {
      datasViagem = `📅 ${fmtDataBR(c.dataInicio)} a ${fmtDataBR(c.dataFim)}`;
    } else if (c.dataInicio) {
      datasViagem = `📅 ${fmtDataBR(c.dataInicio)}`;
    }

    let passageiros = '';
    if (c.viajantes) {
      const lines = c.viajantes.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        let ad = 0, cr = 0;
        lines.forEach(line => {
          const match = line.match(/\((\d+)\)$/);
          if (match) {
            const idade = parseInt(match[1]);
            if (idade < 12) cr++;
            else ad++;
          } else {
            ad++; // padrão
          }
        });
        passageiros = `${lines.length} viajante(s)`;
        if (ad > 0 || cr > 0) {
          const parts = [];
          if (ad > 0) parts.push(`${ad} Ad`);
          if (cr > 0) parts.push(`${cr} Cr`);
          passageiros += ` (${parts.join(', ')})`;
        }
        passageiros = `👥 ${passageiros}`;
      }
    }
    
    if (!passageiros) {
      let ad = parseInt(c.adultos) || 0;
      let cr = parseInt(c.criancas) || 0;
      if (ad > 0 || cr > 0) {
        const parts = [];
        if (ad > 0) parts.push(`${ad} Ad`);
        if (cr > 0) parts.push(`${cr} Cr`);
        passageiros = `👥 ${parts.join(', ')}`;
      } else {
        passageiros = '👥 Sem passageiros';
      }
    }

    card.innerHTML = `
      <div class="list-card-title-row" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
        <div class="list-card-title" style="color:var(--crimson); font-weight: 600; margin-bottom: 0;">${c.nome}</div>
        <button class="btn-card-edit-minimalist" onclick="event.stopPropagation(); editarClienteCard('${c.id}')" title="Editar">
          ✏️
        </button>
      </div>
      <div class="list-card-subtitle" style="margin-top: 4px; font-size: 11px; color: var(--ink-lt); display: flex; gap: 8px; flex-wrap: wrap;">
        <span>${datasViagem}</span>
        <span>·</span>
        <span>${passageiros}</span>
      </div>
      <div class="list-card-meta" style="margin-top: 8px; font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color:${statusColor}; font-weight:600; background: rgba(196,163,90,0.08); padding: 2px 6px; border-radius: 4px;">${c.status || 'Novo'}</span>
      </div>
    `;
    listContainer.appendChild(card);
  });
}
function abrirClienteModal(cliente = null) {
  
  document.getElementById('clientesEmptyState').style.display = 'none';
  document.getElementById('clientesDetailWrapper').style.display = 'block';
  document.getElementById('clientesPreviewContainer').style.display = 'none';
  document.getElementById('clientesEditorContainer').style.display = 'block';

  // Configurar input dinâmico de iniciais ao digitar
  const mcNomeInput = document.getElementById('mcNome');
  if (mcNomeInput) {
    mcNomeInput.oninput = () => {
      if (!editFotoPerfilBase64) {
        const previewCont = document.getElementById('mcFotoPerfilPreview');
        if (previewCont) {
          previewCont.innerHTML = window.obterAvatarFallbackHTML(mcNomeInput.value);
        }
      }
    };
  }

  if(cliente) {
    currentEditingClienteId = cliente.id;
    document.getElementById('modalClienteTitle').innerText = 'Editar Cliente';
    document.getElementById('mcNome').value = cliente.nome || '';
    document.getElementById('mcStatus').value = cliente.status || 'Início/call de dúvidas';
    document.getElementById('mcDataInicio').value = cliente.dataInicio || '';
    document.getElementById('mcDataFim').value = cliente.dataFim || '';

    // Voo separado (num + hora)
    const elChegadaNum = document.getElementById('mcVooChegadaNum');
    const elChegadaHora = document.getElementById('mcVooChegadaHora');
    const elPartidaNum = document.getElementById('mcVooPartidaNum');
    const elPartidaHora = document.getElementById('mcVooPartidaHora');
    if (elChegadaNum) elChegadaNum.value = cliente.vooChegadaNum || '';
    if (elChegadaHora) elChegadaHora.value = cliente.vooChegadaHora || '';
    if (elPartidaNum) elPartidaNum.value = cliente.vooPartidaNum || '';
    if (elPartidaHora) elPartidaHora.value = cliente.vooPartidaHora || '';

    // Fallback: se não tem campos separados mas tem o campo legado combinado
    if (!cliente.vooChegadaNum && cliente.vooChegada) {
      if (cliente.vooChegada.includes('|')) {
        const parts = cliente.vooChegada.split('|').map(s => s.trim());
        if (elChegadaNum) elChegadaNum.value = parts[0] || '';
        if (elChegadaHora) elChegadaHora.value = parts[1] || '';
      } else {
        if (elChegadaNum) elChegadaNum.value = cliente.vooChegada;
      }
    }
    if (!cliente.vooPartidaNum && cliente.vooPartida) {
      if (cliente.vooPartida.includes('|')) {
        const parts = cliente.vooPartida.split('|').map(s => s.trim());
        if (elPartidaNum) elPartidaNum.value = parts[0] || '';
        if (elPartidaHora) elPartidaHora.value = parts[1] || '';
      } else {
        if (elPartidaNum) elPartidaNum.value = cliente.vooPartida;
      }
    }

    fetch(`/api/clientes/local/${cliente.id}`).then(r=>r.json()).then(d => {
      currentEditingEstadias = d.estadias || [];
      if (currentEditingEstadias.length === 0 && cliente.hotel) {
        cliente.hotel.split('\n').filter(l => l.trim()).forEach(line => {
          let cidade = ''; let hotel = line.trim(); let dataInicio = ''; let dataFim = '';
          const dateMatch = line.match(/\((\d{2}\/\d{2}\/\d{4})\s*(?:a|-|até)\s*(\d{2}\/\d{2}\/\d{4})\)/);
          if (dateMatch) {
            const parseDate = d => { const p = d.split('/'); return p[2]+'-'+p[1]+'-'+p[0]; };
            dataInicio = parseDate(dateMatch[1]); dataFim = parseDate(dateMatch[2]);
            hotel = line.substring(0, dateMatch.index).trim();
          }
          const dashIndex = hotel.indexOf(' - ');
          if (dashIndex > -1) { cidade = hotel.substring(0, dashIndex).trim(); hotel = hotel.substring(dashIndex + 3).trim(); }
          currentEditingEstadias.push({ id: Date.now() + Math.random(), cidade, dataInicio, dataFim, hotel });
        });
      }
      renderEstadiasForm();

      // Viajantes: tentar local primeiro, fallback do Notion
      currentEditingViajantes = d.viajantes || [];
      if (currentEditingViajantes.length === 0 && cliente.viajantes) {
        cliente.viajantes.split('\n').filter(l => l.trim()).forEach(line => {
          const text = line.trim();
          const ageMatch = text.match(/\((\d+)\)$/);
          let idade = '';
          let namePart = text;
          if (ageMatch) {
            idade = ageMatch[1];
            namePart = text.substring(0, ageMatch.index).trim();
          }
          const parts = namePart.split(/\s+/);
          const sobrenome = parts.length > 1 ? parts.pop() : '';
          currentEditingViajantes.push({ id: Date.now() + Math.random(), nome: parts.join(' '), sobrenome, idade });
        });
      }
      renderViajantesForm();

      // Emails: tentar local primeiro, fallback do Notion
      currentEditingEmails = d.emails || [];
      if (currentEditingEmails.length === 0 && cliente.email) {
        cliente.email.split('\n').filter(l => l.trim()).forEach(line => {
          currentEditingEmails.push({ id: Date.now() + Math.random(), email: line.trim() });
        });
      }
      renderEmailsForm();

      // Foto de perfil
      editFotoPerfilBase64 = d.fotoPerfil || "";
      const previewCont = document.getElementById('mcFotoPerfilPreview');
      const btnRemover = document.getElementById('mcBtnRemoverFoto');
      if (previewCont) {
        if (editFotoPerfilBase64) {
          previewCont.innerHTML = `<img src="${editFotoPerfilBase64}" style="width:100%; height:100%; object-fit:cover;">`;
          if (btnRemover) btnRemover.style.display = 'inline-block';
        } else {
          previewCont.innerHTML = window.obterAvatarFallbackHTML(cliente.nome || "");
          if (btnRemover) btnRemover.style.display = 'none';
        }
      }

      formatHubButtons();
    }).catch(e => { 
      console.error(e); 
      currentEditingEstadias = []; 
      currentEditingViajantes = [];
      currentEditingEmails = [];
      editFotoPerfilBase64 = "";
      if (cliente.hotel) {
        cliente.hotel.split('\n').filter(l => l.trim()).forEach(line => {
          let cidade = ''; let hotel = line.trim(); let dataInicio = ''; let dataFim = '';
          const dateMatch = line.match(/\((\d{2}\/\d{2}\/\d{4})\s*(?:a|-|até)\s*(\d{2}\/\d{2}\/\d{4})\)/);
          if (dateMatch) {
            const parseDate = d => { const p = d.split('/'); return p[2]+'-'+p[1]+'-'+p[0]; };
            dataInicio = parseDate(dateMatch[1]); dataFim = parseDate(dateMatch[2]);
            hotel = line.substring(0, dateMatch.index).trim();
          }
          const dashIndex = hotel.indexOf(' - ');
          if (dashIndex > -1) { cidade = hotel.substring(0, dashIndex).trim(); hotel = hotel.substring(dashIndex + 3).trim(); }
          currentEditingEstadias.push({ id: Date.now() + Math.random(), cidade, dataInicio, dataFim, hotel });
        });
      }
      if (cliente.viajantes) {
        cliente.viajantes.split('\n').filter(l => l.trim()).forEach(line => {
          const text = line.trim();
          const ageMatch = text.match(/\((\d+)\)$/);
          let idade = '';
          let namePart = text;
          if (ageMatch) {
            idade = ageMatch[1];
            namePart = text.substring(0, ageMatch.index).trim();
          }
          const parts = namePart.split(/\s+/);
          const sobrenome = parts.length > 1 ? parts.pop() : '';
          currentEditingViajantes.push({ id: Date.now() + Math.random(), nome: parts.join(' '), sobrenome, idade });
        });
      }
      if (cliente.email) {
        cliente.email.split('\n').filter(l => l.trim()).forEach(line => {
          currentEditingEmails.push({ id: Date.now() + Math.random(), email: line.trim() });
        });
      }
      renderEstadiasForm();
      renderViajantesForm();
      renderEmailsForm();

      const previewCont = document.getElementById('mcFotoPerfilPreview');
      if (previewCont) {
        previewCont.innerHTML = window.obterAvatarFallbackHTML(cliente.nome || "");
      }
      const btnRemover = document.getElementById('mcBtnRemoverFoto');
      if (btnRemover) btnRemover.style.display = 'none';
    });
  } else {
    currentEditingClienteId = null;
    editFotoPerfilBase64 = "";
    document.getElementById('modalClienteTitle').innerText = 'Novo Cliente';
    document.getElementById('mcNome').value = '';
    document.getElementById('mcStatus').value = 'Início/call de dúvidas';
    document.getElementById('mcDataInicio').value = '';
    document.getElementById('mcDataFim').value = '';
    const elChegadaNum = document.getElementById('mcVooChegadaNum');
    const elChegadaHora = document.getElementById('mcVooChegadaHora');
    const elPartidaNum = document.getElementById('mcVooPartidaNum');
    const elPartidaHora = document.getElementById('mcVooPartidaHora');
    if (elChegadaNum) elChegadaNum.value = '';
    if (elChegadaHora) elChegadaHora.value = '';
    if (elPartidaNum) elPartidaNum.value = '';
    if (elPartidaHora) elPartidaHora.value = '';
    currentEditingEstadias = [];
    currentEditingViajantes = [];
    currentEditingEmails = [];
    renderEstadiasForm();
    renderViajantesForm();
    renderEmailsForm();

    const previewCont = document.getElementById('mcFotoPerfilPreview');
    if (previewCont) {
      previewCont.innerHTML = `<span>HT</span>`;
    }
    const btnRemover = document.getElementById('mcBtnRemoverFoto');
    if (btnRemover) btnRemover.style.display = 'none';

    formatHubButtons();
  }
}

window.closeClienteModal = function() {
  if (window.clienteAtualVisualizado) {
    document.getElementById('clientesPreviewContainer').style.display = 'block';
    document.getElementById('clientesEditorContainer').style.display = 'none';
    abrirDetalhesCliente(window.clienteAtualVisualizado);
  } else {
    document.getElementById('clientesEmptyState').style.display = 'block';
    document.getElementById('clientesDetailWrapper').style.display = 'none';
  }
}

window.editarClienteNotion = async function(id) {
    if (!notionClients || notionClients.length === 0) {
      try {
        const res = await fetch('/api/notion/clientes?t=' + Date.now(), { cache: 'no-store' });
        notionClients = await res.json(); window.notionClients = notionClients;
      } catch (e) {
        console.error('Erro ao carregar clientes do Notion:', e);
      }
    }
    const c = notionClients.find(x => x.id === id);
    if(c) abrirClienteModal(c);
    else alert('Cliente não encontrado no Notion.');
  }

async function salvarClienteNotion() {
  // Calcular adultos/crianças a partir dos viajantes
  let adultos = 0, criancas = 0;
  currentEditingViajantes.forEach(v => {
    const idade = parseInt(v.idade);
    if (isNaN(idade) || idade >= 12) adultos++;
    else criancas++;
  });
  // Se não há viajantes, default adultos=2
  if (currentEditingViajantes.length === 0) { adultos = 2; criancas = 0; }

  const vooChegadaNum = (document.getElementById('mcVooChegadaNum')?.value || '').trim();
  const vooChegadaHora = (document.getElementById('mcVooChegadaHora')?.value || '').trim();
  const vooPartidaNum = (document.getElementById('mcVooPartidaNum')?.value || '').trim();
  const vooPartidaHora = (document.getElementById('mcVooPartidaHora')?.value || '').trim();

  // Serializar viajantes para Notion: "Nome Sobrenome (Idade)" por linha
  const viajantesStr = currentEditingViajantes.map(v => {
    let txt = v.nome || '';
    if (v.sobrenome) txt += ' ' + v.sobrenome;
    if (v.idade) txt += ` (${v.idade})`;
    return txt.trim();
  }).filter(Boolean).join('\n');

  // Serializar emails para Notion: um por linha
  const emailsStr = currentEditingEmails.map(e => e.email).filter(Boolean).join('\n');

  const payload = {
    nome: document.getElementById('mcNome').value.trim(),
    status: document.getElementById('mcStatus').value,
    adultos,
    criancas,
    vooChegadaNum,
    vooChegadaHora,
    vooPartidaNum,
    vooPartidaHora,
    dataInicio: document.getElementById('mcDataInicio').value,
    dataFim: document.getElementById('mcDataFim').value,
    viajantes: viajantesStr,
    email: emailsStr
  };
  
  if(!payload.nome) return alert('Nome é obrigatório');
  
  const btn = document.getElementById('btnSalvarClienteModal');
  btn.innerText = 'Salvando no Notion...';
  btn.disabled = true;
  
  try {
    const url = currentEditingClienteId ? `/api/notion/clientes/${currentEditingClienteId}` : '/api/notion/clientes';
    const method = currentEditingClienteId ? 'PATCH' : 'POST';
    
    const hoteisStr = currentEditingEstadias.map(e => {
      let txt = e.cidade || 'S/N';
      if (e.hotel) txt += ` - ${e.hotel}`;
      
      let d1 = e.dataInicio ? e.dataInicio.split('-').reverse().join('/') : '';
      let d2 = e.dataFim ? e.dataFim.split('-').reverse().join('/') : '';
      let dates = (d1 && d2) ? ` (${d1} a ${d2})` : (d1 || d2 ? ` (${d1||d2})` : '');
      
      return txt + dates;
    }).join('\n');
    if (hoteisStr) payload.hotel = hoteisStr;

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errInfo = await res.json();
      throw new Error(errInfo.message || 'Falha ao comunicar com Notion API');
    }

    const data = await res.json();
    const cliId = currentEditingClienteId || data.id;
    
    await fetch('/api/clientes/local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: cliId,
        estadias: currentEditingEstadias,
        viajantes: currentEditingViajantes,
        emails: currentEditingEmails,
        fotoPerfil: editFotoPerfilBase64
      })
    });
    
    window.clienteAtualVisualizado = cliId;
    await loadClientesTabela(); // Recarrega a lista
    
    // Mostra o preview atualizado diretamente
    abrirDetalhesCliente(cliId);
    
    if (typeof syncClienteAtivo === 'function') {
        await syncClienteAtivo(cliId);
    }

    alert('Cliente salvo no Notion com sucesso!');
  } catch(e) {
    console.error(e);
    alert('Erro ao salvar no Notion: ' + e.message);
  } finally {
    btn.innerText = 'Salvar no Notion';
    btn.disabled = false;
  }
}

window.syncHoteisNotion = async function() {
  if (!state.orcamento.notionClienteId) {
    alert('Esta cotação não está vinculada a um cliente do Notion. Selecione o cliente em "Importar do Notion" acima.');
    return;
  }
  
  if (state.orcamento.estadias.length === 0) {
    alert('Nenhuma estadia adicionada na cotação.');
    return;
  }

  const btn = document.getElementById('btnSyncHoteisNotion');
  const oldText = btn.innerText;
  btn.innerText = 'Enviando...';
  btn.disabled = true;

  try {
    const hoteisStr = state.orcamento.estadias.map(e => {
      let txt = e.cidade;
      if (e.hotel) txt += ` - ${e.hotel}`;
      return txt;
    }).join('\n');

    const res = await fetch(`/api/notion/clientes/${state.orcamento.notionClienteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotel: hoteisStr })
    });

    if (!res.ok) throw new Error('Falha na API Notion');
    alert('Hotéis atualizados com sucesso no Notion!');
  } catch (err) {
    console.error(err);
    alert('Erro ao sincronizar: ' + err.message);
  } finally {
    btn.innerText = oldText;
    btn.disabled = false;
  }
};

document.getElementById('btnSyncHoteisNotion')?.addEventListener('click', window.syncHoteisNotion);


// ── HUB DO CLIENTE (ATALHOS) ────────────────────────────────────────────────────────

function formatHubButtons() {
  const btnCotacao = document.getElementById('btnAcessoCotacao');
  const btnRoteiro = document.getElementById('btnAcessoRoteiro');
  if (!btnCotacao || !btnRoteiro) return;
  
  if (!currentEditingClienteId) {
    btnCotacao.style.display = 'none';
    btnRoteiro.style.display = 'none';
    return;
  }
  
  btnCotacao.style.display = 'block';
  btnRoteiro.style.display = 'block';
  
  const cliente = typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === currentEditingClienteId) : null;
  const clienteNome = cliente ? cliente.nome : '';

  let roteiroNome = null;
  if (typeof dbRotas !== 'undefined' && clienteNome) {
    for (const [k, v] of Object.entries(dbRotas)) {
      if (v.cliente && v.cliente.nome === clienteNome) {
        roteiroNome = k;
        break;
      }
    }
  }

  // Buscar orcamento
  const orc = state.orcamentosDB.find(o => o.notionClienteId === currentEditingClienteId);

  // LOGIC FOR COTAÇÃO
  if (orc) {
    btnCotacao.innerText = 'Abrir Cotação';
    btnCotacao.onclick = () => { closeClienteModal(); abrirOrcamento(orc.id); navToPage('orcamento'); };
  } else {
    btnCotacao.innerText = 'Gerar Cotação';
    btnCotacao.onclick = () => { 
      closeClienteModal(); 
      novoOrcamento();
      state.orcamento.notionClienteId = currentEditingClienteId;
      const nome = document.getElementById('mcNome').value || '';
      document.getElementById('orcNome').value = nome;
      document.getElementById('clienteNome').value = nome;
      document.getElementById('clienteAdultos').value = document.getElementById('mcAdultos').value || '2';
      document.getElementById('clienteCriancas').value = document.getElementById('mcCriancas').value || '0';
      state.orcamento.cliente.nome = nome;
      
      state.orcamento.estadias = JSON.parse(JSON.stringify(currentEditingEstadias));
      renderEstadiasReadOnlyForm();
      navToPage('orcamento'); 
    };
  }

  // LOGIC FOR ROTEIRO
  const rotNomeLinkado = (orc && orc.orcRoteiroVinculado) ? orc.orcRoteiroVinculado : roteiroNome;
  
  if (rotNomeLinkado) {
    btnRoteiro.innerText = 'Abrir Roteiro';
    btnRoteiro.onclick = () => { 
      closeClienteModal(); 
      if (orc) abrirOrcamento(orc.id); 
      document.getElementById('orcRoteiroVinculado').value = rotNomeLinkado; 
      navToPage('roteiros'); 
      
      setTimeout(() => {
        if (typeof preencherSelectRoteiros === 'function') preencherSelectRoteiros(rotNomeLinkado);
        const selRoteiro = document.getElementById('selectRoteiroBase');
        if (selRoteiro) {
          selRoteiro.value = rotNomeLinkado;
          const btnEd = document.getElementById('btnEditarRoteiro');
          const btnEx = document.getElementById('btnExcluirRoteiro');
          if (btnEd) {
            btnEd.style.display = 'inline-block';
            btnEd.click();
          }
          if (btnEx) btnEx.style.display = 'inline-block';
        }
      }, 300);
    };
  } else {
    btnRoteiro.innerText = 'Gerar Roteiro';
    btnRoteiro.onclick = async () => {
      closeClienteModal(); 
      novoOrcamento();
      state.orcamento.notionClienteId = currentEditingClienteId;
      const nome = document.getElementById('mcNome').value || '';
      document.getElementById('orcNome').value = nome;
      document.getElementById('clienteNome').value = nome;
      document.getElementById('clienteAdultos').value = document.getElementById('mcAdultos').value || '2';
      document.getElementById('clienteCriancas').value = document.getElementById('mcCriancas').value || '0';
      state.orcamento.cliente.nome = nome;
      state.orcamento.estadias = JSON.parse(JSON.stringify(currentEditingEstadias));
      renderEstadiasReadOnlyForm();
      
      if (typeof salvarOrcamentoAtual === 'function') salvarOrcamentoAtual();

      const nomeRoteiro = 'Roteiro - ' + (nome || 'Novo');
      
      let diasList = [];
      const safeNome = document.getElementById('mcNome') ? document.getElementById('mcNome').value : '';
      const safeAdultos = document.getElementById('mcAdultos') ? document.getElementById('mcAdultos').value : '2';
      const safeCriancas = document.getElementById('mcCriancas') ? document.getElementById('mcCriancas').value : '0';
      const safeDataInicio = document.getElementById('mcDataInicio') ? document.getElementById('mcDataInicio').value : '';
      const safeDataFim = document.getElementById('mcDataFim') ? document.getElementById('mcDataFim').value : '';
      const safeVooChegada = document.getElementById('mcVooChegada') ? document.getElementById('mcVooChegada').value : '';
      const safeVooPartida = document.getElementById('mcVooPartida') ? document.getElementById('mcVooPartida').value : '';
      
      const novoRoteiroObj = {
        cliente: {
          nome: safeNome,
          adultos: safeAdultos,
          criancas: safeCriancas,
          notionClienteId: currentEditingClienteId,
          dataOrcamento: new Date().toISOString().split('T')[0],
          dataInicio: safeDataInicio,
          dataFim: safeDataFim,
          vooChegada: safeVooChegada,
          vooPartida: safeVooPartida,
          estadias: typeof currentEditingEstadias !== 'undefined' ? JSON.parse(JSON.stringify(currentEditingEstadias)) : []
        },
        dias: diasList
      };
      
      try {
        const resp = await fetch('/api/roteiros/' + encodeURIComponent(nomeRoteiro), {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(novoRoteiroObj)
        });
        if (resp.ok) {
          if (typeof dbRotas !== 'undefined') dbRotas[nomeRoteiro] = novoRoteiroObj;
          document.getElementById('orcRoteiroVinculado').value = nomeRoteiro;
          state.orcamento.orcRoteiroVinculado = nomeRoteiro;
          if (typeof salvarOrcamentoAtual === 'function') salvarOrcamentoAtual();
          
          navToPage('roteiros');
          setTimeout(() => {
            if (typeof preencherSelectRoteiros === 'function') preencherSelectRoteiros(nomeRoteiro);
            const selRoteiro = document.getElementById('selectRoteiroBase');
            if (selRoteiro) {
               selRoteiro.value = nomeRoteiro;
               const btnEd = document.getElementById('btnEditarRoteiro');
               const btnEx = document.getElementById('btnExcluirRoteiro');
               if (btnEd) {
                 btnEd.style.display = 'inline-block';
                 btnEd.click();
               }
               if (btnEx) btnEx.style.display = 'inline-block';
            }
          }, 300);
        } else {
          alert('Erro ao criar roteiro autônomo.');
        }
      } catch(e) {
        console.error(e);
      }
    };
  }
}

window.abrirVisaoGeralCliente = function(clientId) {
try {
  const cliente = notionClients.find(c => c.id === clientId);
  if (!cliente) return;
  
  const orc = state.orcamentosDB.find(o => o.notionClienteId === clientId);
  
  let roteiroInfo = null;
  if (typeof dbRotas !== 'undefined') {
    for (const [k, v] of Object.entries(dbRotas)) {
      if (v.cliente && v.cliente.nome === cliente.nome) {
        roteiroInfo = { nome: k, data: v };
        break;
      }
    }
  }
  
  if (!orc && !roteiroInfo) {
    alert('Nenhum Roteiro ou Cotação encontrado para este cliente ainda.');
    return;
  }
  
  // Injeta o botão de alternância no header do preview
  let btnToggle = document.getElementById('btnTogglePreviewView');
  if (!btnToggle) {
    btnToggle = document.createElement('button');
    btnToggle.id = 'btnTogglePreviewView';
    btnToggle.className = 'btn-secondary';
    btnToggle.style.marginRight = '10px';
    btnToggle.style.color = '#fff';
    btnToggle.style.borderColor = 'rgba(255,255,255,0.4)';
    const headerDiv = document.querySelector('#previewOverlay .preview-toolbar div');
    headerDiv.insertBefore(btnToggle, document.getElementById('btnPrintFromPreview'));
  }
  
  if (orc && roteiroInfo) {
    btnToggle.style.display = 'inline-block';
    btnToggle.dataset.view = roteiroInfo ? 'roteiro' : 'cotacao';
    btnToggle.innerHTML = roteiroInfo ? '🔄 Mudar para Cotação' : '🔄 Mudar para Roteiro';
    
    btnToggle.onclick = function() {
      if (this.dataset.view === 'roteiro') {
        this.dataset.view = 'cotacao';
        this.innerHTML = '🔄 Mudar para Roteiro';
        // Populate DOM before preview to prevent syncDOMToState from wiping it out
        state.orcamento = JSON.parse(JSON.stringify(orc));
        document.getElementById('orcNome').value = orc.nome || '';
        document.getElementById('clienteNome').value = orc.cliente?.nome || '';
        document.getElementById('clienteAdultos').value = orc.cliente?.adultos || '2';
        document.getElementById('clienteCriancas').value = orc.cliente?.criancas || '0';
        document.getElementById('clienteDataOrcamento').value = orc.cliente?.dataOrcamento || '';
        if (typeof preencherTextosForm === 'function') preencherTextosForm(orc.textos || {});
        renderPreview(); 
      } else {
        this.dataset.view = 'roteiro';
        this.innerHTML = '🔄 Mudar para Cotação';
        roteiroOriginalNome = roteiroInfo.nome;
        roteiroEmEdicao = JSON.parse(JSON.stringify(roteiroInfo.data));
        document.getElementById('editRoteiroNome').value = roteiroInfo.nome;
        const btn = document.getElementById('btnPrevisualizarRoteiro');
        if(btn) btn.click();
      }
    };
  } else {
    btnToggle.style.display = 'none';
  }
  
  // Abre o que existir primeiro (dá preferencia pro roteiro)
  if (roteiroInfo) {
    roteiroOriginalNome = roteiroInfo.nome;
    roteiroEmEdicao = JSON.parse(JSON.stringify(roteiroInfo.data));
    document.getElementById('editRoteiroNome').value = roteiroInfo.nome;
    const btn = document.getElementById('btnPrevisualizarRoteiro');
    if(btn) btn.click();
  } else {
    // Populate DOM before preview
    state.orcamento = JSON.parse(JSON.stringify(orc));
    document.getElementById('orcNome').value = orc.nome || '';
    document.getElementById('clienteNome').value = orc.cliente?.nome || '';
    document.getElementById('clienteAdultos').value = orc.cliente?.adultos || '2';
    document.getElementById('clienteCriancas').value = orc.cliente?.criancas || '0';
    document.getElementById('clienteDataOrcamento').value = orc.cliente?.dataOrcamento || '';
    if (typeof preencherTextosForm === 'function') preencherTextosForm(orc.textos || {});
    renderPreview();
    document.getElementById('previewOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
} catch (err) {
  alert('DEBUG ERRO: ' + err.message + '\n' + err.stack);
  console.error(err);
}
};


// --- MOBILE MENU TOGGLE ---
document.addEventListener('DOMContentLoaded', () => {
  const mobileBtn = document.getElementById('mobileMenuToggle');
  const sidebar = document.querySelector('.sidebar');
  if(mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    
    // Close when clicking nav items on mobile
    const navItems = sidebar.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        if(window.innerWidth <= 768) {
          sidebar.classList.remove('open');
        }
      });
    });
  }
});


window.handleAcaoClienteCotacao = async function() {
  if (state.orcamento && state.orcamento.notionClienteId) {
    editarClienteNotion(state.orcamento.notionClienteId);
  } else {
    // Modo "Salvar Cliente no Notion"
    const nome = document.getElementById('clienteNome').value.trim();
    if (!nome) return alert('Preencha pelo menos o Nome do Cliente para salvar no Notion.');
    
    const btn = document.getElementById('btnEditarClienteCotacao');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '⏳ Salvando...';
    btn.disabled = true;

    try {
      const payload = {
        nome: nome,
        adultos: document.getElementById('clienteAdultos').value,
        criancas: document.getElementById('clienteCriancas').value,
        dataInicio: document.getElementById('clienteDataOrcamento').value || '',
        dataFim: '',
        status: 'Lead',
        vooChegada: '',
        vooPartida: ''
      };

      const res = await fetch('/api/notion/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Falha ao salvar no Notion');
      
      const newClient = await res.json();
      state.orcamento.notionClienteId = newClient.id;
      
      // Salva localmente as estadias vazias se houver
      await fetch('/api/clientes/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newClient.id, estadias: state.orcamento.estadias || [] })
      });

      // Recarrega NotionClients
      notionClients = await fetch('/api/notion/clientes?t=' + Date.now(), { cache: 'no-store' }).then(r=>r.json()); window.notionClients = notionClients;

      btn.innerHTML = '👤 Editar Cliente';
      btn.disabled = false;
      
      // Trava os campos e salva
      ['clienteNome', 'clienteAdultos', 'clienteCriancas'].forEach(id => {
        const el = document.getElementById(id);
        if(el) { el.readOnly = true; el.style = 'background:#f1f5f9; cursor:not-allowed'; }
      });
      
      document.getElementById('notionSelectWrapper').style.display = 'none';
      salvarOrcamentoAtual();
      
      alert('Cliente criado no Notion e vinculado com sucesso!');

    } catch (e) {
      console.error(e);
      alert('Erro ao salvar cliente no Notion.');
      btn.innerHTML = oldHtml;
      btn.disabled = false;
    }
  }
};

window.editarCotacaoAtual = function() {
  // Se tiver um overlay antigo escondemos
  const overlay = document.getElementById('previewOverlay');
  if(overlay) { overlay.classList.add('hidden'); document.body.style.overflow = ''; }
  
  document.getElementById('orcamentosPreviewWrapper').style.display = 'none';
  document.getElementById('orcamentosEditorWrapper').style.display = 'block';
};

window.excluirCotacaoAtual = async function() {
  if (!state.orcamento || !state.orcamento.id) return;
  if (!confirm('Tem certeza que deseja excluir esta cotação?')) return;
  
  try {
    // Attempt to delete from the server if it exists
    await fetch(`/api/orcamentos/${state.orcamento.id}`, { method: 'DELETE' }).catch(() => {});
  } catch(e) {}
  
  state.orcamentosDB = state.orcamentosDB.filter(o => o.id !== state.orcamento.id);
  saveOrcamentos(); 
  renderListaOrcamentos();
  
  document.getElementById('orcamentosPreviewWrapper').style.display = 'none';
  document.getElementById('orcamentosEditorWrapper').style.display = 'none';
  document.getElementById('orcamentosEmptyState').style.display = 'block';
  
  const overlay = document.getElementById('previewOverlay');
  if(overlay) { overlay.classList.add('hidden'); document.body.style.overflow = ''; }
  
  state.orcamento = null;
};

window.previewOrcamento = function(id) {
  // Só atualiza o preview se estivermos vendo um preview, nao se estivermos editando!
  if (document.getElementById('orcamentosEditorWrapper').style.display === 'block') {
    return;
  }
  // Se ja esta selecionado, nao faz nada
  if (state.orcamento && state.orcamento.id === id) return;
  
  // Carrega e renderiza o preview sutilmente
  const orc = state.orcamentosDB.find(o => o.id === id);
  if (!orc) return;
  state.orcamento = JSON.parse(JSON.stringify(orc));
  
  document.getElementById('orcamentosEmptyState').style.display = 'none';
  document.getElementById('orcamentosEditorWrapper').style.display = 'none';
  document.getElementById('orcamentosPreviewWrapper').style.display = 'block';
  
  renderPreview();
  
  // Atualiza visual selection na lista de forma performática
  const listContainer = document.getElementById('orcamentosLista');
  if (listContainer) {
    listContainer.querySelectorAll('.list-card').forEach(card => {
      if (card.dataset.id === String(id)) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }
};

window.filterOrcamentosList = function() {
  const q = document.getElementById('pesquisaOrcamentosList').value.toLowerCase();
  renderListaOrcamentos(q);
};

window.abrirDetalhesCliente = function(id, isHover = false) {
  if (typeof notionClients === 'undefined') return;
  const c = notionClients.find(x => x.id === id);
  if (!c) return;
  
  window.clienteAtualVisualizado = id;
  
  // Atualiza classe selected de forma performática
  const listContainer = document.getElementById('tabelaClientesList');
  if (listContainer) {
    listContainer.querySelectorAll('.list-card').forEach(card => {
      if (card.dataset.id === id) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }
  
  const emptyState = document.getElementById('clientesEmptyState');
  if (emptyState) emptyState.style.display = 'none';
  const detailWrapper = document.getElementById('clientesDetailWrapper');
  if (detailWrapper) detailWrapper.style.display = 'block';
  
  document.getElementById('clientesPreviewContainer').style.display = 'block';
  document.getElementById('clientesEditorContainer').style.display = 'none';
  
  fetch(`/api/clientes/local/${c.id}`).then(r=>r.json()).then(d => {
    const estadias = d.estadias || [];
    const viajantes = d.viajantes || [];
    const emails = d.emails || [];
    renderPreviewCliente(c, estadias, viajantes, emails, d.fotoPerfil || "");
  }).catch(e => {
    console.error(e);
    const estadias = [];
    if (c.hotel) {
      c.hotel.split('\n').filter(l => l.trim()).forEach(line => {
        let cidade = ''; let hotel = line.trim(); let dataInicio = ''; let dataFim = '';
        const dateMatch = line.match(/\((\d{2}\/\d{2}\/\d{4})\s*(?:a|-|até)\s*(\d{2}\/\d{2}\/\d{4})\)/);
        if (dateMatch) {
          const parseDate = d => { const p = d.split('/'); return p[2]+'-'+p[1]+'-'+p[0]; };
          dataInicio = parseDate(dateMatch[1]); dataFim = parseDate(dateMatch[2]);
          hotel = line.substring(0, dateMatch.index).trim();
        }
        const dashIndex = hotel.indexOf(' - ');
        if (dashIndex > -1) { cidade = hotel.substring(0, dashIndex).trim(); hotel = hotel.substring(dashIndex + 3).trim(); }
        estadias.push({ id: Date.now() + Math.random(), cidade, dataInicio, dataFim, hotel });
      });
    }
    renderPreviewCliente(c, estadias, [], [], "");
  });
};

window.hoverCliente = function(id) {
  if (window.clienteAtualVisualizado === id) return;
  abrirDetalhesCliente(id, true);
};

window.editarClienteCard = function(id) {
  if (typeof notionClients === 'undefined') return;
  const c = notionClients.find(x => x.id === id);
  if (!c) return;

  window.clienteAtualVisualizado = id;
  renderClientesTabela();

  document.getElementById('clientesPreviewContainer').style.display = 'none';
  document.getElementById('clientesEditorContainer').style.display = 'block';

  abrirClienteModal(c);
};

window.renderPreviewCliente = function(cliente, estadias = [], viajantes = [], emails = [], fotoPerfil = "") {
  const container = document.getElementById('clientesPreviewContainer');
  if (!container) return;

  let statusColor = '#9c8248';
  if (cliente.status === 'Fechado' || cliente.status === 'Negociação Aprovada' || cliente.status === 'Finalizados') {
    statusColor = '#6B1F2A';
  } else if (cliente.status === 'Cancelado') {
    statusColor = '#806A6D';
  }

  // Serializar coleções locais para a alternância rápida de abas
  const estadiasStr = encodeURIComponent(JSON.stringify(estadias));
  const viajantesStr = encodeURIComponent(JSON.stringify(viajantes));
  const emailsStr = encodeURIComponent(JSON.stringify(emails));

  // Renderizar o cabeçalho estático (Dynamics 365 Style)
  let avatarHTML = "";
  if (fotoPerfil) {
    avatarHTML = `<div class="client-avatar-container"><img src="${fotoPerfil}"></div>`;
  } else {
    avatarHTML = `<div class="client-avatar-container">${window.obterAvatarFallbackHTML(cliente.nome || "")}</div>`;
  }

  container.innerHTML = `
    <div class="client-detail-header">
      <div class="client-profile-summary">
        ${avatarHTML}
        <div class="client-info-meta">
          <h2>${cliente.nome || 'Cliente sem nome'}</h2>
          <span class="client-status-badge" style="color: ${statusColor}; background: rgba(196, 163, 90, 0.08); border: 1px solid rgba(196, 163, 90, 0.2);">
            ${cliente.status || 'Novo'}
          </span>
        </div>
      </div>
      <div class="client-actions-bar">
        <button class="btn-secondary" onclick="window.location.href='mailto:${emails && emails[0] ? emails[0].email : (cliente.email || '')}'" title="Enviar E-mail" ${!(emails && emails[0] || cliente.email) ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
          ✉️ E-mail
        </button>
        <button class="btn-secondary" onclick="if('${cliente.telefone || ''}') window.open('https://wa.me/${(cliente.telefone || '').replace(/\\D/g,'')}', '_blank');" title="WhatsApp" ${!cliente.telefone ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
          💬 WhatsApp
        </button>
        <button class="btn-secondary" onclick="navToPage('dashboard'); if(typeof selecionarClienteDashboard === 'function') selecionarClienteDashboard('${cliente.id}'); closeClienteModal();" title="Dashboard do Cliente">
          📊 Dashboard
        </button>
        <button class="btn-primary" onclick="editarClienteCard('${cliente.id}')">
          ✏️ Editar Cliente
        </button>
      </div>
    </div>

    <!-- Barra de Navegação de Abas -->
    <div class="tabs-client-nav">
      <button class="tab-client-btn active" data-tab="dados" onclick="window.switchClientTab('dados', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')">Dados do Cliente</button>
      <button class="tab-client-btn" data-tab="roteiros" onclick="window.switchClientTab('roteiros', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')">Roteiros</button>
      <button class="tab-client-btn" data-tab="cotacoes" onclick="window.switchClientTab('cotacoes', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')">Cotações</button>
    </div>

    <!-- Conteúdo da Aba Ativa -->
    <div id="clientTabContent" class="tab-client-content"></div>
  `;

  // Renderizar a primeira aba por padrão
  renderAbaDadosCliente(cliente, estadias, viajantes, emails);
};

window.switchClientTab = function(tabName, clienteId, estadiasJson, viajantesJson, emailsJson) {
  const nav = document.querySelector('.tabs-client-nav');
  if (nav) {
    nav.querySelectorAll('.tab-client-btn').forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  const cliente = typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === clienteId) : null;
  if (!cliente) return;

  const estadias = JSON.parse(decodeURIComponent(estadiasJson));
  const viajantes = JSON.parse(decodeURIComponent(viajantesJson));
  const emails = JSON.parse(decodeURIComponent(emailsJson));

  if (tabName === 'dados') {
    renderAbaDadosCliente(cliente, estadias, viajantes, emails);
  } else if (tabName === 'roteiros') {
    renderAbaRoteiros(cliente);
  } else if (tabName === 'cotacoes') {
    renderAbaCotacoes(cliente);
  }
};

function renderAbaDadosCliente(cliente, estadias, viajantes, emails) {
  const contentDiv = document.getElementById('clientTabContent');
  if (!contentDiv) return;

  let datasViagem = 'Sem data definida';
  if (cliente.dataInicio && cliente.dataFim) {
    datasViagem = `${fmtDataBR(cliente.dataInicio)} a ${fmtDataBR(cliente.dataFim)}`;
  } else if (cliente.dataInicio) {
    datasViagem = `${fmtDataBR(cliente.dataInicio)}`;
  }

  let passageiros = '';
  if (viajantes && viajantes.length > 0) {
    let ad = 0, cr = 0;
    viajantes.forEach(v => {
      const idade = parseInt(v.idade);
      if (isNaN(idade) || idade >= 12) ad++;
      else cr++;
    });
    passageiros = `${viajantes.length} viajante(s)`;
    if (ad > 0) passageiros += ` · ${ad} adulto(s)`;
    if (cr > 0) passageiros += ` · ${cr} criança(s)`;
  } else {
    const ad = parseInt(cliente.adultos) || 0;
    const cr = parseInt(cliente.criancas) || 0;
    if (ad > 0) passageiros += `${ad} Adulto(s)`;
    if (cr > 0) passageiros += `, ${cr} Criança(s)`;
    if (!passageiros) passageiros = 'Nenhum passageiro informado';
  }

  let vooChegadaStr = 'Não informado';
  if (cliente.vooChegadaNum || cliente.vooChegadaHora) {
    vooChegadaStr = [cliente.vooChegadaNum, cliente.vooChegadaHora].filter(Boolean).join(' · ');
  } else if (cliente.vooChegada) {
    vooChegadaStr = cliente.vooChegada;
  }
  let vooPartidaStr = 'Não informado';
  if (cliente.vooPartidaNum || cliente.vooPartidaHora) {
    vooPartidaStr = [cliente.vooPartidaNum, cliente.vooPartidaHora].filter(Boolean).join(' · ');
  } else if (cliente.vooPartida) {
    vooPartidaStr = cliente.vooPartida;
  }

  let viajantesHTML = '';
  if (viajantes && viajantes.length > 0) {
    viajantesHTML = `<div style="display:flex; flex-direction:column; gap:6px;">` +
      viajantes.map(v => {
        const nomeCompleto = [v.nome, v.sobrenome].filter(Boolean).join(' ') || 'Sem nome';
        const tipo = (parseInt(v.idade) < 12 && !isNaN(parseInt(v.idade))) ? '🧒' : '🧑';
        const idadeStr = v.idade ? `${v.idade} anos` : '';
        return `<div style="padding:8px 12px; background:rgba(196,163,90,0.04); border:1px solid var(--border); border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:13px; color:var(--ink-dk);">${tipo} ${nomeCompleto}</span>
          <span style="font-size:12px; color:var(--ink-lt);">${idadeStr}</span>
        </div>`;
      }).join('') + `</div>`;
  } else {
    if (cliente.viajantes) {
      viajantesHTML = `<div style="font-size:13px; color:var(--ink-dk); white-space:pre-wrap;">${cliente.viajantes}</div>`;
    } else {
      viajantesHTML = `<p style="font-size: 13px; color: var(--ink-lt); font-style: italic;">Nenhum viajante cadastrado.</p>`;
    }
  }

  let emailsHTML = '';
  if (emails && emails.length > 0) {
    emailsHTML = emails.map((e, i) => {
      const badge = i === 0 ? ' <span style="font-size:9px; background:var(--crimson); color:#fff; padding:1px 4px; border-radius:3px; vertical-align:middle;">Principal</span>' : '';
      return `<div style="font-size:13px; color:var(--ink-dk); padding:4px 0;">📧 ${e.email}${badge}</div>`;
    }).join('');
  } else if (cliente.email) {
    emailsHTML = `<div style="font-size:13px; color:var(--ink-dk); white-space:pre-wrap;">📧 ${cliente.email}</div>`;
  } else {
    emailsHTML = `<p style="font-size: 13px; color: var(--ink-lt); font-style: italic;">Nenhum e-mail cadastrado.</p>`;
  }

  let estadiasHTML = '';
  if (estadias && estadias.length > 0) {
    estadiasHTML = estadias.map(est => `
      <div class="preview-estadia-card" style="padding: 12px 16px; border-radius: 8px; background: rgba(196,163,90,0.04); border: 1px solid var(--border); margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <strong style="color: var(--crimson); font-size: 14px;">${est.cidade || 'Cidade não informada'}</strong>
          <span style="font-size: 12px; color: var(--ink-lt);">
            ${est.dataInicio && est.dataFim ? `📅 ${fmtDataBR(est.dataInicio)} a ${fmtDataBR(est.dataFim)}` : 'Sem período informado'}
          </span>
        </div>
        <div style="font-size: 13px; color: var(--ink-dk);">${est.hotel || 'Hotel não informado'}</div>
      </div>
    `).join('');
  } else {
    estadiasHTML = `<p style="font-size: 13px; color: var(--ink-lt); font-style: italic;">Nenhuma estadia cadastrada.</p>`;
  }

  contentDiv.innerHTML = `
    <div class="preview-body" style="display: flex; flex-direction: column; gap: 24px;">
      <div class="preview-section-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; background: var(--warm-white); padding: 16px; border-radius: 8px; border: 1px solid var(--border);">
        <div>
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-lt); margin-bottom: 4px;">Período (Chegada ↔ Partida)</div>
          <div style="font-size: 14px; color: var(--ink-dk); font-weight: 500;">${datasViagem}</div>
        </div>
        <div>
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-lt); margin-bottom: 4px;">Passageiros</div>
          <div style="font-size: 14px; color: var(--ink-dk); font-weight: 500;">${passageiros}</div>
        </div>
        <div>
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-lt); margin-bottom: 4px;">✈ Voo de Chegada</div>
          <div style="font-size: 14px; color: var(--ink-dk); font-weight: 500;">${vooChegadaStr}</div>
        </div>
        <div>
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-lt); margin-bottom: 4px;">✈ Voo de Partida</div>
          <div style="font-size: 14px; color: var(--ink-dk); font-weight: 500;">${vooPartidaStr}</div>
        </div>
      </div>

      <div>
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold-dk); margin-bottom: 12px; font-weight: 600;">👥 Viajantes</h3>
        ${viajantesHTML}
      </div>

      <div>
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold-dk); margin-bottom: 12px; font-weight: 600;">📧 E-mails</h3>
        ${emailsHTML}
      </div>

      <div>
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold-dk); margin-bottom: 12px; font-weight: 600;">Estadias e Hotéis</h3>
        <div class="preview-estadias-list">
          ${estadiasHTML}
        </div>
      </div>
    </div>
  `;
}

function renderAbaRoteiros(cliente) {
  const contentDiv = document.getElementById('clientTabContent');
  if (!contentDiv) return;

  const clienteNome = cliente.nome || '';
  const roteiros = typeof dbRotas !== 'undefined' ? Object.entries(dbRotas)
    .filter(([nome, rot]) => {
      return rot.notionClienteId === cliente.id || (rot.cliente && rot.cliente.nome === clienteNome);
    })
    .map(([nome, rot]) => ({ nome, ...rot })) : [];

  if (roteiros.length === 0) {
    contentDiv.innerHTML = `
      <div style="text-align:center; padding: 40px 20px;">
        <p style="color:var(--ink-lt); font-size:14px; margin-bottom:16px;">Nenhum roteiro vinculado a este cliente.</p>
        <button class="btn-primary" onclick="window.criarRoteiroParaCliente('${cliente.id}')" style="display:inline-flex; align-items:center; gap:8px; padding: 10px 18px; border-radius: 8px;">
          ➕ Criar Roteiro
        </button>
      </div>
    `;
    return;
  }

  let cardsHTML = roteiros.map(r => {
    const totalDias = (r.dias || []).length;
    const meta = `${totalDias} dia(s)`;
    return `
      <div class="compact-card" data-roteiro-name="${r.nome}" onclick="window.selectRoteiroCompact('${r.nome}')">
        <div class="compact-card-title">${r.nome}</div>
        <div class="compact-card-meta">${meta}</div>
        <div class="compact-card-footer">
          <span class="compact-card-price" style="font-size:11px;">Roteiro</span>
          <span class="compact-card-status" style="background:rgba(196,163,90,0.08); color:var(--gold-dk);">Ativo</span>
        </div>
      </div>
    `;
  }).join('');

  contentDiv.innerHTML = `
    <div class="compact-cards-grid">
      ${cardsHTML}
    </div>
    <div id="roteiroActivePreviewHeader" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding: 12px; background: #fafafa; border-radius: 8px; border: 1px solid var(--border);">
      <strong id="roteiroActiveTitle" style="color:var(--crimson); font-size:15px;"></strong>
      <div style="display:flex; gap:8px;">
        <button class="btn-secondary" id="btnSincronizarCalendarioPreview" style="padding: 6px 12px; font-size:12px; background:var(--crimson); color:white; border-color:var(--crimson); cursor:pointer;">📅 Sincronizar Calendário</button>
        <button class="btn-secondary" id="btnAbrirRoteiroPreview" style="padding: 6px 12px; font-size:12px; cursor:pointer;">🗺️ Abrir Editor</button>
        <button class="btn-secondary" id="btnExcluirRoteiroPreview" style="padding: 6px 12px; font-size:12px; color:#c00; border-color:#fee; cursor:pointer;">❌ Excluir</button>
      </div>
    </div>
    <div id="roteiroActivePreview" class="tab-preview-section"></div>
  `;

  // Selecionar o primeiro roteiro da lista por padrão
  window.selectRoteiroCompact(roteiros[0].nome);
}

window.selectRoteiroCompact = function(roteiroNome) {
  const cardsGrid = document.querySelector('.compact-cards-grid');
  if (cardsGrid) {
    cardsGrid.querySelectorAll('.compact-card').forEach(card => {
      if (card.dataset.roteiroName === roteiroNome) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  const titleEl = document.getElementById('roteiroActiveTitle');
  if (titleEl) titleEl.innerText = roteiroNome;

  const btnSinc = document.getElementById('btnSincronizarCalendarioPreview');
  if (btnSinc) {
    btnSinc.onclick = () => {
      if (typeof window.sincronizarRoteiroCalendario === 'function') {
        window.sincronizarRoteiroCalendario(roteiroNome);
      }
    };
  }

  const btnAbrir = document.getElementById('btnAbrirRoteiroPreview');
  if (btnAbrir) {
    btnAbrir.onclick = () => {
      closeClienteModal();
      if (typeof navToPage === 'function') navToPage('roteiros');
      if (typeof window.editarRoteiroCard === 'function') {
        window.editarRoteiroCard(roteiroNome);
      }
    };
  }

  const btnExcluir = document.getElementById('btnExcluirRoteiroPreview');
  if (btnExcluir) {
    btnExcluir.onclick = async () => {
      if (!confirm(`Tem certeza que deseja excluir o roteiro "${roteiroNome}"?`)) return;
      try {
        await fetch(`/api/roteiros/${encodeURIComponent(roteiroNome)}`, { method: 'DELETE' });
        if (typeof dbRotas !== 'undefined') {
          delete dbRotas[roteiroNome];
        }
        const cli = notionClients.find(x => x.id === window.clienteAtualVisualizado);
        renderAbaRoteiros(cli);
      } catch(err) {
        console.error(err);
        alert('Erro ao excluir roteiro.');
      }
    };
  }

  const previewDiv = document.getElementById('roteiroActivePreview');
  if (previewDiv) {
    previewDiv.innerHTML = '<div style="color:var(--ink-lt); padding:20px;">Carregando roteiro...</div>';
    setTimeout(() => {
      if (window.renderizarRoteiroNoElemento) {
        window.renderizarRoteiroNoElemento(roteiroNome, previewDiv);
      }
    }, 50);
  }
};

window.criarRoteiroParaCliente = function(clienteId) {
  closeClienteModal();
  if (typeof navToPage === 'function') navToPage('roteiros');
  
  const cliente = typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === clienteId) : null;
  if (!cliente) return;

  roteiroOriginalNome = '';
  roteiroEmEdicao = { 
    notionClienteId: clienteId,
    cliente: {
      nome: cliente.nome,
      adultos: cliente.adultos || 2,
      criancas: cliente.criancas || 0,
      dataInicio: cliente.dataInicio || '',
      dataFim: cliente.dataFim || '',
      vooChegada: cliente.vooChegada || '',
      vooPartida: cliente.vooPartida || '',
      estadias: []
    },
    dias: []
  };
  
  document.getElementById('roteirosEmptyState').style.display = 'none';
  document.getElementById('roteirosDetailWrapper').style.display = 'block';
  if (typeof abrirEditorRoteiro === 'function') abrirEditorRoteiro('Novo Roteiro');
  
  fetch(`/api/clientes/local/${clienteId}`).then(r => r.json()).then(d => {
    roteiroEmEdicao.cliente.estadias = JSON.parse(JSON.stringify(d.estadias || []));
    if (typeof renderRotEstadias === 'function') renderRotEstadias();
  }).catch(e => console.error(e));
};

function renderAbaCotacoes(cliente) {
  const contentDiv = document.getElementById('clientTabContent');
  if (!contentDiv) return;

  const cotacoes = state.orcamentosDB.filter(o => {
    return o.notionClienteId === cliente.id || (o.cliente && o.cliente.nome === cliente.nome);
  });

  if (cotacoes.length === 0) {
    contentDiv.innerHTML = `
      <div style="text-align:center; padding: 40px 20px;">
        <p style="color:var(--ink-lt); font-size:14px; margin-bottom:16px;">Nenhuma cotação vinculada a este cliente.</p>
        <button class="btn-primary" onclick="window.criarCotacaoParaCliente('${cliente.id}')" style="display:inline-flex; align-items:center; gap:8px; padding: 10px 18px; border-radius: 8px;">
          ➕ Criar Cotação
        </button>
      </div>
    `;
    return;
  }

  let cardsHTML = cotacoes.map(c => {
    const tT  = (c.tours || []).reduce((s,t)=>s+calcTotalTour(t),0);
    const tTr = (c.transportes || []).reduce((s,t)=>s+calcTotalTransporte(t),0);
    const tEx = (c.experiencias || []).reduce((s,e)=>s+calcTotalExp(e),0);
    const tItens = (c.itensAdicionais||[]).reduce((s,i)=>s+(i.valor||0),0);
    const cons = (c.consultoria && c.consultoria.ativa) ? (c.consultoria.valor || 0) : 0;
    const total = tT+tTr+tEx+tItens+cons;

    const dataOrc = c.cliente && c.cliente.dataOrcamento ? fmtDataBR(c.cliente.dataOrcamento) : '—';
    
    return `
      <div class="compact-card" data-cotacao-id="${c.id}" onclick="window.selectCotacaoCompact('${c.id}')">
        <div class="compact-card-title">${c.nome || 'Sem título'}</div>
        <div class="compact-card-meta">Data: ${dataOrc}</div>
        <div class="compact-card-footer">
          <span class="compact-card-price">¥ ${Math.round(total).toLocaleString('pt-BR')}</span>
          <span class="compact-card-status" style="background:rgba(107,31,42,0.08); color:var(--crimson);">${c.status || 'Orçamento'}</span>
        </div>
      </div>
    `;
  }).join('');

  contentDiv.innerHTML = `
    <div class="compact-cards-grid">
      ${cardsHTML}
    </div>
    <div id="cotacaoActivePreviewHeader" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding: 12px; background: #fafafa; border-radius: 8px; border: 1px solid var(--border);">
      <strong id="cotacaoActiveTitle" style="color:var(--crimson); font-size:15px;"></strong>
      <div style="display:flex; gap:8px;">
        <button class="btn-secondary" id="btnAbrirCotacaoPreview" style="padding: 6px 12px; font-size:12px; cursor:pointer;">💰 Abrir Editor</button>
        <button class="btn-secondary" id="btnExcluirCotacaoPreview" style="padding: 6px 12px; font-size:12px; color:#c00; border-color:#fee; cursor:pointer;">❌ Excluir</button>
      </div>
    </div>
    <div id="cotacaoActivePreview" class="tab-preview-section" style="max-height: 600px; overflow-y: auto;"></div>
  `;

  // Selecionar a primeira cotação da lista por padrão
  window.selectCotacaoCompact(cotacoes[0].id);
}

window.selectCotacaoCompact = function(cotacaoId) {
  const cardsGrid = document.querySelector('.compact-cards-grid');
  if (cardsGrid) {
    cardsGrid.querySelectorAll('.compact-card').forEach(card => {
      if (card.dataset.cotacaoId === String(cotacaoId)) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  const orc = state.orcamentosDB.find(o => o.id === cotacaoId);
  if (!orc) return;

  const titleEl = document.getElementById('cotacaoActiveTitle');
  if (titleEl) titleEl.innerText = orc.nome || 'Cotação';

  const btnAbrir = document.getElementById('btnAbrirCotacaoPreview');
  if (btnAbrir) {
    btnAbrir.onclick = () => {
      closeClienteModal();
      if (typeof navToPage === 'function') navToPage('orcamento');
      if (typeof abrirOrcamento === 'function') {
        abrirOrcamento(cotacaoId, true);
      }
    };
  }

  const btnExcluir = document.getElementById('btnExcluirCotacaoPreview');
  if (btnExcluir) {
    btnExcluir.onclick = async () => {
      if (!confirm('Tem certeza que deseja excluir esta cotação?')) return;
      try {
        await fetch(`/api/orcamentos/${cotacaoId}`, { method: 'DELETE' });
        state.orcamentosDB = state.orcamentosDB.filter(x => x.id !== cotacaoId);
        const cli = notionClients.find(x => x.id === window.clienteAtualVisualizado);
        renderAbaCotacoes(cli);
      } catch(err) {
        console.error(err);
        alert('Erro ao excluir cotação.');
      }
    };
  }

  const previewDiv = document.getElementById('cotacaoActivePreview');
  if (previewDiv) {
    previewDiv.innerHTML = '<div style="color:var(--ink-lt); padding:20px;">Carregando cotação...</div>';
    setTimeout(() => {
      if (window.renderPreviewOrcamentoNoElemento) {
        window.renderPreviewOrcamentoNoElemento(cotacaoId, previewDiv);
      }
    }, 50);
  }
};

window.criarCotacaoParaCliente = function(clienteId) {
  closeClienteModal(); 
  if (typeof navToPage === 'function') navToPage('orcamento');
  
  const cliente = typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === clienteId) : null;
  if (!cliente) return;

  novoOrcamento();
  state.orcamento.notionClienteId = clienteId;
  const nome = cliente.nome || '';
  document.getElementById('orcNome').value = 'Cotação - ' + nome;
  document.getElementById('clienteNome').value = nome;
  document.getElementById('clienteAdultos').value = cliente.adultos || '2';
  document.getElementById('clienteCriancas').value = cliente.criancas || '0';
  state.orcamento.cliente.nome = nome;
  state.orcamento.cliente.adultos = cliente.adultos || '2';
  state.orcamento.cliente.criancas = cliente.criancas || '0';
  state.orcamento.nome = 'Cotação - ' + nome;
  
  fetch(`/api/clientes/local/${clienteId}`).then(r=>r.json()).then(d => {
    state.orcamento.estadias = JSON.parse(JSON.stringify(d.estadias || []));
    if (typeof renderEstadiasReadOnlyForm === 'function') renderEstadiasReadOnlyForm();
  }).catch(e => {
    console.error(e);
  }).finally(() => {
    document.getElementById('orcamentosEmptyState').style.display = 'none';
    document.getElementById('orcamentosPreviewWrapper').style.display = 'none';
    document.getElementById('orcamentosEditorWrapper').style.display = 'block';
    if (typeof updateResumo === 'function') updateResumo();
  });
};

window.renderPreviewOrcamentoNoElemento = function(orcId, element) {
  const orc = state.orcamentosDB.find(o => o.id === orcId);
  if (!orc || !element) return;
  
  const originalOrcamento = state.orcamento;
  state.orcamento = JSON.parse(JSON.stringify(orc));
  
  const tempInline = document.getElementById('previewContainerInline');
  if (tempInline) {
    tempInline.removeAttribute('id');
  }
  
  element.setAttribute('id', 'previewContainerInline');
  
  try {
    renderPreview();
  } finally {
    element.removeAttribute('id');
    if (tempInline) {
      tempInline.setAttribute('id', 'previewContainerInline');
    }
    state.orcamento = originalOrcamento;
  }
};

// ── RICH TEXT FORMATTING HELPER ──────────────────────────────────────────
window.formatText = function(textareaId, command, value = '') {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);

  let replacement = '';
  if (command === 'bold') {
    replacement = `<b>${selectedText}</b>`;
  } else if (command === 'italic') {
    replacement = `<i>${selectedText}</i>`;
  } else if (command === 'size') {
    if (!value) return;
    replacement = `<span style="font-size: ${value};">${selectedText}</span>`;
  } else if (command === 'font') {
    if (!value) return;
    replacement = `<span style="font-family: ${value};">${selectedText}</span>`;
  }

  textarea.value = text.substring(0, start) + replacement + text.substring(end);
  textarea.focus();
  
  // Set selection to cover the formatted text
  textarea.selectionStart = start;
  textarea.selectionEnd = start + replacement.length;
  
  // Trigger input event to update state and auto-save timers
  textarea.dispatchEvent(new Event('input'));
};

// ── SISTEMA DE CALENDÁRIO COM INTEGRAÇÃO DE GUIAS ────────────────────────────
let calCurrentDate = new Date();
let calEventos = [];
let calColaboradores = [];
let calSelectedEvent = null;

// Inicialização e navegação de meses do calendário (Lista padrão no Mobile)
let calViewMode = window.innerWidth <= 768 ? 'list' : 'grid';

document.addEventListener('DOMContentLoaded', () => {
  const prevBtn = document.getElementById('calendarPrevMonthBtn');
  const nextBtn = document.getElementById('calendarNextMonthBtn');
  const filterCliente = document.getElementById('calendarFilterCliente');
  const refreshBtn = document.getElementById('btnRefreshCalendario');
  const modalSaveBtn = document.getElementById('calEventModalSaveBtn');
  const gridViewBtn = document.getElementById('btnCalViewGrid');
  const listViewBtn = document.getElementById('btnCalViewList');

  if (prevBtn) prevBtn.addEventListener('click', () => navegarMesCalendario(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => navegarMesCalendario(1));
  if (filterCliente) filterCliente.addEventListener('change', () => renderCalendario());
  if (refreshBtn) refreshBtn.addEventListener('click', () => renderCalendario());
  if (modalSaveBtn) modalSaveBtn.addEventListener('click', salvarAtribuicaoGuia);

  // Configurar display inicial ativo de acordo com o modo calViewMode
  if (calViewMode === 'list') {
    if (listViewBtn) listViewBtn.classList.add('active');
    if (gridViewBtn) gridViewBtn.classList.remove('active');
    const gw = document.getElementById('calendarioGridWrapper');
    const lw = document.getElementById('calendarioListaWrapper');
    if (gw) gw.style.display = 'none';
    if (lw) lw.style.display = 'flex';
  } else {
    if (gridViewBtn) gridViewBtn.classList.add('active');
    if (listViewBtn) listViewBtn.classList.remove('active');
    const gw = document.getElementById('calendarioGridWrapper');
    const lw = document.getElementById('calendarioListaWrapper');
    if (gw) gw.style.display = 'grid';
    if (lw) lw.style.display = 'none';
  }

  if (gridViewBtn) {
    gridViewBtn.addEventListener('click', () => {
      calViewMode = 'grid';
      gridViewBtn.classList.add('active');
      if (listViewBtn) listViewBtn.classList.remove('active');
      document.getElementById('calendarioGridWrapper').style.display = 'grid';
      document.getElementById('calendarioListaWrapper').style.display = 'none';
      renderCalendario();
    });
  }
  if (listViewBtn) {
    listViewBtn.addEventListener('click', () => {
      calViewMode = 'list';
      listViewBtn.classList.add('active');
      if (gridViewBtn) gridViewBtn.classList.remove('active');
      document.getElementById('calendarioGridWrapper').style.display = 'none';
      document.getElementById('calendarioListaWrapper').style.display = 'flex';
      renderCalendario();
    });
  }
});

async function navegarMesCalendario(direcao) {
  calCurrentDate.setMonth(calCurrentDate.getMonth() + direcao);
  await renderCalendario();
}

window.renderCalendario = async function() {
  const titleEl = document.getElementById('calendarMonthYearTitle');
  const gridEl = document.getElementById('calendarioGrid');
  const filterCliente = document.getElementById('calendarFilterCliente');
  const listEl = document.getElementById('calendarioListaWrapper');
  if (!titleEl || !gridEl) return;

  // 1. Atualizar Título do Mês/Ano
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  titleEl.innerText = `${meses[calCurrentDate.getMonth()]} ${calCurrentDate.getFullYear()}`;

  if (calViewMode === 'grid') {
    gridEl.innerHTML = '<div style="grid-column: span 7; text-align: center; padding: 40px; color: var(--ink-lt);">Carregando calendário do Notion...</div>';
  } else if (listEl) {
    listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--ink-lt);">Carregando calendário do Notion...</div>';
  }

  // 2. Carregar Colaboradores (Guias) se necessário
  if (calColaboradores.length === 0) {
    try {
      const res = await fetch('/api/notion/colaboradores');
      if (res.ok) {
        calColaboradores = await res.json();
        // Popular dropdown no modal de edição
        const select = document.getElementById('calEventModalAssigneeSelect');
        if (select) {
          select.innerHTML = '<option value="">Nenhum guia designado</option>';
          calColaboradores.forEach(col => {
            select.innerHTML += `<option value="${col.id}">👤 ${col.name}</option>`;
          });
        }
      }
    } catch (e) {
      console.error('Erro ao carregar colaboradores:', e);
    }
  }

  // 3. Carregar Clientes se necessário para o Dropdown de filtro
  if (filterCliente && filterCliente.options.length <= 1) {
    let clis = [];
    if (typeof notionClients !== 'undefined' && notionClients.length > 0) {
      clis = notionClients;
    } else {
      try {
        const res = await fetch('/api/notion/clientes');
        if (res.ok) clis = await res.json();
      } catch (e) {
        console.error(e);
      }
    }
    clis.forEach(c => {
      filterCliente.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
    });
  }

  // 4. Determinar datas de início e fim do mês
  const ano = calCurrentDate.getFullYear();
  const mes = calCurrentDate.getMonth();
  
  // Data de início (YYYY-MM-DD): primeiro dia do mês
  const dataInicioStr = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
  
  // Data de fim (YYYY-MM-DD): último dia do mês
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const dataFimStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

  // 5. Carregar Eventos da API
  const clienteFiltroId = filterCliente ? filterCliente.value : '';
  let url = `/api/calendario/eventos?data_inicio=${dataInicioStr}&data_fim=${dataFimStr}`;
  if (clienteFiltroId) url += `&cliente_id=${clienteFiltroId}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha ao buscar eventos');
    calEventos = await res.json();
  } catch (err) {
    console.error(err);
    const errHTML = '<div style="text-align: center; padding: 40px; color: #c00;">Erro ao carregar eventos do Notion. Verifique as credenciais no .env.</div>';
    if (calViewMode === 'grid') gridEl.innerHTML = errHTML;
    else if (listEl) listEl.innerHTML = errHTML;
    return;
  }

  // 6. Desenhar baseado no modo selecionado
  if (calViewMode === 'grid') {
    gridEl.innerHTML = '';

    const primeiroDiaSemana = new Date(ano, mes, 1).getDay(); // 0 (Dom) a 6 (Sáb)
    const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
    const totalDiasMesAnterior = new Date(ano, mes, 0).getDate();

    // Dias do Mês Anterior (células vazias/cinza)
    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
      const diaNum = totalDiasMesAnterior - i;
      gridEl.innerHTML += `
        <div class="calendar-cell other-month">
          <span class="calendar-cell-num">${diaNum}</span>
          <div class="calendar-events-list"></div>
        </div>
      `;
    }

    // Dias do Mês Atual
    const hoje = new Date();
    for (let dia = 1; dia <= totalDiasMes; dia++) {
      const dateKey = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const isToday = hoje.getFullYear() === ano && hoje.getMonth() === mes && hoje.getDate() === dia;
      
      // Filtrar eventos do dia
      const eventosDia = calEventos.filter(ev => ev.dataServico === dateKey);

      let eventosHTML = eventosDia.map(ev => {
        let tipoClass = 'event-type-transfer';
        const tLower = ev.tipoServico.toLowerCase();
        if (tLower.includes('roteiro')) tipoClass = 'event-type-roteiro';
        else if (tLower.includes('shinkansen')) tipoClass = 'event-type-shinkansen';
        else if (tLower.includes('romancecar')) tipoClass = 'event-type-romancecar';
        else if (tLower.includes('trem')) tipoClass = 'event-type-trem';
        else if (tLower.includes('ônibus') || tLower.includes('onibus')) tipoClass = 'event-type-onibus';
        else if (tLower.includes('experiência') || tLower.includes('experiencia')) tipoClass = 'event-type-experiencia';
        
        const guiaText = ev.assignee.length > 0 ? ` [👤 ${ev.assignee.map(a => a.name).join(', ')}]` : '';
        return `
          <div class="calendar-event-badge calendar-event-item ${tipoClass}" onclick="event.stopPropagation(); abrirCalendarioEventModal('${ev.id}')">
            ${ev.titulo}${guiaText}
          </div>
        `;
      }).join('');

      gridEl.innerHTML += `
        <div class="calendar-cell ${isToday ? 'today' : ''}">
          <span class="calendar-cell-num">${dia}</span>
          <div class="calendar-events-list">
            ${eventHTMLs(eventosHTML)}
          </div>
        </div>
      `;
    }

    // Dias do Mês Seguinte
    const totalCelulasAteAgora = primeiroDiaSemana + totalDiasMes;
    const celulasRestantes = (7 - (totalCelulasAteAgora % 7)) % 7;
    for (let dia = 1; dia <= celulasRestantes; dia++) {
      gridEl.innerHTML += `
        <div class="calendar-cell other-month">
          <span class="calendar-cell-num">${dia}</span>
          <div class="calendar-events-list"></div>
        </div>
      `;
    }
  } else {
    // VISUALIZAÇÃO EM LISTA
    if (!listEl) return;
    listEl.innerHTML = '';

    const eventosValidos = calEventos.filter(ev => ev.dataServico).sort((a, b) => {
      return new Date(a.dataServico) - new Date(b.dataServico);
    });

    if (eventosValidos.length === 0) {
      listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--ink-lt); font-size:14px;">Nenhum serviço ou tour guiado agendado para este mês.</div>';
      return;
    }

    const eventosPorData = {};
    eventosValidos.forEach(ev => {
      if (!eventosPorData[ev.dataServico]) eventosPorData[ev.dataServico] = [];
      eventosPorData[ev.dataServico].push(ev);
    });

    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    
    Object.keys(eventosPorData).sort().forEach(dateKey => {
      const evs = eventosPorData[dateKey];
      const [y, m, d] = dateKey.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const diaSemana = diasSemana[dateObj.getDay()];
      const dataFormatada = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;

      let diaRowHTML = `
        <div class="calendar-list-day-row">
          <!-- Coluna da Esquerda: Informações do Dia -->
          <div class="calendar-list-day-header">
            <div class="calendar-list-day-date">
              🗓️ ${dataFormatada}
            </div>
            <div class="calendar-list-day-weekday">
              ${diaSemana}
            </div>
            <div class="calendar-list-day-count">
              ${evs.length} evento(s)
            </div>
          </div>
          
          <!-- Coluna da Direita: Lista Horizontal de Cards -->
          <div class="calendar-list-cards-row">
      `;

      evs.forEach(ev => {
        // Obter nome do cliente (com fallback)
        let clienteNomeStr = ev.clienteNome || '';
        if (!clienteNomeStr) {
          if (ev.clientes && ev.clientes.length > 0) {
            const cli = typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === ev.clientes[0]) : null;
            clienteNomeStr = cli ? cli.nome : 'Cliente Vinculado';
          } else {
            clienteNomeStr = 'Nenhum cliente';
          }
        }

        // Obter cidade (com fallback)
        let cidadeStr = ev.cidade || '';
        if (!cidadeStr) {
          const clientNotionId = ev.clientes && ev.clientes.length > 0 ? ev.clientes[0] : null;
          let roteiroCliente = null;
          if (clientNotionId && typeof dbRotas !== 'undefined') {
            roteiroCliente = Object.values(dbRotas).find(rot => rot.notionClienteId === clientNotionId);
          }
          if (roteiroCliente && roteiroCliente.cliente?.dataInicio) {
            const parseDateUTC = (dateStr) => {
              const [yy, mm, dd] = dateStr.split('-').map(Number);
              return new Date(Date.UTC(yy, mm - 1, dd));
            };
            const diffDays = Math.round((parseDateUTC(ev.dataServico) - parseDateUTC(roteiroCliente.cliente.dataInicio)) / (1000 * 60 * 60 * 24));
            if (roteiroCliente.dias && roteiroCliente.dias[diffDays]) {
              const diaRoteiro = roteiroCliente.dias[diffDays];
              const sequencias = (diaRoteiro.elementos || []).filter(el => el.tipo === 'sequencia');
              if (sequencias.length > 0) {
                cidadeStr = sequencias[0].cidade || '';
              }
            }
          }
          if (!cidadeStr) cidadeStr = 'Japão';
        }

        // Colaboradores (Guias) - Lógica de renderização dinâmica de rodapé
        let footerGuiaHTML = '';
        if (ev.assignee && ev.assignee.length > 1) {
          const chips = ev.assignee.map(a => 
            `<span class="colab-card-chip" style="background:rgba(107,31,42,0.06); color:var(--crimson); font-size:8px; font-weight:700; padding:1px 5px; border-radius:4px; display:inline-flex; align-items:center; gap:2px; border:1px solid rgba(107,31,42,0.12);">
              👤 ${a.name}
            </span>`
          ).join('');
          
          footerGuiaHTML = `
            <div style="border-top:1px solid var(--border); padding-top:4px; display:flex; align-items:center; justify-content:space-between; width:100%; gap:4px;" onclick="event.stopPropagation(); abrirCalendarioEventModal('${ev.id}')">
              <div style="display:flex; flex-wrap:wrap; gap:2px; align-items:center; max-width:85%; overflow:hidden;">
                ${chips}
              </div>
              <span style="font-size:9px; color:var(--ink-lt); cursor:pointer; text-decoration:underline; font-weight:600; white-space:nowrap; padding:1px 4px;">Editar</span>
            </div>
          `;
        } else {
          const guiaIdAtual = ev.assignee && ev.assignee.length > 0 ? ev.assignee[0].id : '';
          const optionsColaboradores = calColaboradores.map(col => {
            return `<option value="${col.id}" ${col.id === guiaIdAtual ? 'selected' : ''}>👤 ${col.name}</option>`;
          }).join('');
          
          footerGuiaHTML = `
            <div style="border-top:1px solid var(--border); padding-top:4px; display:flex; align-items:center; justify-content:space-between; width:100%; gap:4px;" onclick="event.stopPropagation();">
              <div style="display:flex; align-items:center; gap:4px; flex-grow:1;">
                <span style="font-size:8px; font-weight:600; color:var(--ink-mid); white-space:nowrap;">👤 Guia:</span>
                <select onchange="atualizarGuiaRapidoLista('${ev.id}', this)" class="calendar-card-select" style="flex-grow:1; max-width:110px;">
                  <option value="">Nenhum guia designado</option>
                  ${optionsColaboradores}
                </select>
              </div>
              <button class="btn-secondary" style="margin:0; padding:1px 4px; font-size:8px; height:18px; line-height:1; border-radius:3px; border-color:var(--border);" onclick="abrirCalendarioEventModal('${ev.id}')" title="Designar múltiplos colaboradores">
                ➕
              </button>
            </div>
          `;
        }

        // Badges e Cores
        let badgeBg = 'rgba(107,31,42,0.06)';
        let badgeColor = 'var(--crimson)';
        const tLower = ev.tipoServico.toLowerCase();
        
        if (tLower.includes('shinkansen') || tLower.includes('romancecar') || tLower.includes('trem') || tLower.includes('ônibus') || tLower.includes('onibus') || tLower.includes('transfer') || tLower.includes('transporte')) {
          badgeBg = 'rgba(196,163,90,0.08)';
          badgeColor = 'var(--gold-dk)';
        } else if (tLower.includes('experiência') || tLower.includes('experiencia')) {
          badgeBg = 'rgba(135,75,45,0.06)';
          badgeColor = '#7a3e20';
        }

        // Determinar classe do card para cores específicas de borda/background
        let tipoClassSuffix = 'transporte';
        if (tLower.includes('roteiro')) {
          tipoClassSuffix = 'tour';
        } else if (tLower.includes('experiência') || tLower.includes('experiencia')) {
          tipoClassSuffix = 'experiencia';
        } else {
          tipoClassSuffix = 'transporte';
        }

        const meetingTime = ev.horaEncontro || '-';

        diaRowHTML += `
          <div class="calendar-list-event-card card-type-${tipoClassSuffix}" onclick="abrirCalendarioEventModal('${ev.id}')">
            <!-- Parte Superior do Card -->
            <div style="display:flex; flex-direction:column; gap:3px;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px;">
                <span class="compact-card-status" style="background:${badgeBg}; color:${badgeColor}; font-size:8px; text-transform:uppercase; padding:1px 4px; border-radius:3px; font-weight:600;">
                  ${ev.tipoServico}
                </span>
                <span style="font-size:9px; font-weight:700; color:var(--ink-mid);">
                  🕒 ${meetingTime}
                </span>
              </div>
              <h4 style="margin:1px 0 0 0; font-family:var(--ff-display); font-size:11px; font-weight:700; color:var(--ink-dk); line-height:1.3;">
                ${ev.titulo}
              </h4>
              <div style="display:flex; flex-direction:column; gap:1px; margin-top:1px; font-size:9px; color:var(--ink-mid);">
                <div>
                  <span style="color:var(--ink-lt);">Cliente:</span> <strong>${clienteNomeStr}</strong>
                </div>
                <div>
                  <span style="color:var(--ink-lt);">Cidade:</span> <strong>${cidadeStr}</strong>
                </div>
              </div>
            </div>

            <!-- Parte Inferior do Card: Guia -->
            ${footerGuiaHTML}
          </div>
        `;
      });

      diaRowHTML += `
          </div>
        </div>
      `;

      listEl.innerHTML += diaRowHTML;
    });
  }
};

function eventHTMLs(html) {
  return html || '<div style="color:#eee; font-size:10px; font-style:italic; padding:4px 0;">Sem eventos</div>';
}

window.atualizarGuiaRapidoLista = async function(eventoId, selectEl) {
  const userId = selectEl.value;
  selectEl.disabled = true;

  try {
    const res = await fetch(`/api/calendario/eventos/${eventoId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assigneeIds: userId ? [userId] : []
      })
    });

    if (!res.ok) throw new Error('Erro ao salvar guia no Notion');
    
    // Atualizar no array local
    const ev = calEventos.find(x => x.id === eventoId);
    if (ev) {
      if (!ev.valorDiariaColab) ev.valorDiariaColab = {};
      if (!ev.pagoColab) ev.pagoColab = {};

      if (userId) {
        const col = calColaboradores.find(x => x.id === userId);
        ev.assignee = col ? [{ id: col.id, name: col.name, avatar: col.avatar }] : [{ id: userId, name: userId }];
        
        // Sincronizar diárias e pagamentos individuais no estado local
        if (ev.valorDiariaColab[userId] === undefined || ev.valorDiariaColab[userId] === null) {
          const isRoteiro = ev.tipoServico && ev.tipoServico.toLowerCase() === 'roteiro';
          const defaultRate = col ? col.rate : 35000;
          ev.valorDiariaColab[userId] = isRoteiro ? defaultRate : 0;
        }
        if (ev.pagoColab[userId] === undefined) {
          ev.pagoColab[userId] = ev.pago || false;
        }

        // Remover outros colaboradores
        Object.keys(ev.valorDiariaColab).forEach(uid => {
          if (uid !== userId) {
            delete ev.valorDiariaColab[uid];
            delete ev.pagoColab[uid];
          }
        });

        ev.valorDiaria = ev.valorDiariaColab[userId];
        ev.pago = ev.pagoColab[userId];
      } else {
        ev.assignee = [];
        ev.valorDiariaColab = {};
        ev.pagoColab = {};
        ev.valorDiaria = null;
        ev.pago = false;
      }
      
      // Recarregar calendário para desenhar botões/chips
      renderCalendario();
    }
  } catch (err) {
    console.error(err);
    alert('Erro ao atualizar guia no Notion. Tente novamente.');
    renderCalendario();
  } finally {
    selectEl.disabled = false;
  }
};

window.abrirCalendarioEventModal = function(eventoId) {
  const ev = calEventos.find(x => x.id === eventoId);
  if (!ev) return;

  calSelectedEvent = ev;

  document.getElementById('calEventModalTitle').innerText = ev.titulo;
  
  // Badge de tipo
  const badge = document.getElementById('calEventModalTypeBadge');
  if (badge) {
    badge.innerText = ev.tipoServico;
    badge.className = 'compact-card-status';
    let bg = 'rgba(107,31,42,0.06)'; let color = 'var(--crimson)';
    const tLower = ev.tipoServico.toLowerCase();
    if (tLower.includes('shinkansen') || tLower.includes('romancecar') || tLower.includes('trem') || tLower.includes('ônibus') || tLower.includes('onibus') || tLower.includes('transfer') || tLower.includes('transporte')) {
      bg = 'rgba(196,163,90,0.08)'; color = 'var(--gold-dk)';
    } else if (tLower.includes('experiência') || tLower.includes('experiencia')) {
      bg = 'rgba(135,75,45,0.06)'; color = '#7a3e20';
    }
    badge.style.background = bg;
    badge.style.color = color;
  }

  // Data formatada
  const dateParts = ev.dataServico.split('-');
  document.getElementById('calEventModalData').innerText = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

  // Nome do cliente
  const cliNameEl = document.getElementById('calEventModalCliente');
  if (cliNameEl) {
    cliNameEl.innerText = ev.clienteNome || (ev.clientes && ev.clientes.length > 0
      ? (typeof notionClients !== 'undefined' && notionClients.find(c => c.id === ev.clientes[0])?.nome || 'Cliente Vinculado')
      : 'Nenhum cliente vinculado');
  }

  // Renderizar checkboxes de guias designados
  const container = document.getElementById('calEventModalAssigneesContainer');
  if (container) {
    container.innerHTML = calColaboradores.map(col => {
      const isChecked = ev.assignee && ev.assignee.some(a => a.id === col.id);
      return `
        <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--ink-dk); cursor:pointer; margin:0;">
          <input type="checkbox" class="cal-modal-assignee-checkbox" value="${col.id}" ${isChecked ? 'checked' : ''} onchange="onCalEventModalAssigneeChange()" style="width:15px; height:15px; margin:0; cursor:pointer;">
          <span>${col.name}</span>
        </label>
      `;
    }).join('');
  }

  // Especificações adicionais do roteiro (atrações/transportes/experiencias)
  const specContainer = document.getElementById('calEventModalEspecificacoesContainer');
  if (specContainer) {
    specContainer.style.display = 'none';
    specContainer.innerHTML = '';

    let specHTML = '';
    const typeLower = ev.tipoServico.toLowerCase();

    // 1. Tentar renderizar a partir das informações ricas salvas no próprio evento
    if (ev.cidade || ev.horaEncontro || ev.localEncontro || ev.atracoes || ev.transportInfo || ev.expInfo) {
      if (typeLower.includes('roteiro')) {
        specHTML += `<div style="font-weight:700; color:var(--crimson); font-size:12px; margin-bottom:12px; text-transform:uppercase;">🗺️ Roteiro do Dia:</div>`;

        const parts = [];
        if (ev.horaEncontro) parts.push(`🕒 Encontro: <strong>${ev.horaEncontro}</strong><br>`);
        if (ev.localEncontro) parts.push(`📍 Local: <strong>${ev.localEncontro}</strong><br>`);
        if (ev.duracaoTour) parts.push(`⏳ Duração: <strong>${ev.duracaoTour}</strong>`);
        
        if (parts.length > 0) {
          specHTML += `<div style="font-size:12px; background:#f9f6f6; border-left:3px solid var(--crimson); padding:8px 12px; border-radius:6px; margin-bottom:12px; color:var(--ink-mid); display:block; line-height:1.4;">${parts.join('')}</div>`;
        }

        if (ev.rotas && ev.rotas.length > 0) {
          specHTML += `<div style="font-size:12px; margin-bottom:8px; color:var(--ink);"><strong>Rotas:</strong> ${ev.rotas.join(' ➔ ')}</div>`;
        }
        
        if (ev.atracoes && ev.atracoes.length > 0) {
          const chipsHTML = ev.atracoes.map(atr => 
            `<span style="background:rgba(196,163,90,0.12); color:#8a703b; border:1px solid rgba(196,163,90,0.2); padding:3px 8px; border-radius:12px; font-size:11px; font-weight:600; display:inline-block; margin:2px 4px 2px 0;">⭐ ${atr}</span>`
          ).join('');
          specHTML += `<div style="margin-top:8px;"><strong>Atrações:</strong><div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:4px;">${chipsHTML}</div></div>`;
        }

        if (ev.textos && ev.textos.length > 0) {
          specHTML += `<div style="margin-top:12px; font-size:11px; font-style:italic; border-left:2px solid var(--gold-lt); padding-left:8px; color:var(--ink-mid);">`;
          ev.textos.forEach(t => {
            specHTML += `<p style="margin:4px 0;">"${t}"</p>`;
          });
          specHTML += `</div>`;
        }
      } else if (ev.transportInfo || typeLower.includes('shinkansen') || typeLower.includes('romancecar') || typeLower.includes('trem') || typeLower.includes('ônibus') || typeLower.includes('onibus') || typeLower.includes('transfer') || typeLower.includes('transporte')) {
        specHTML += `<div style="font-weight:700; color:#9c8248; font-size:12px; margin-bottom:12px; text-transform:uppercase;">🚆 Detalhes do Transporte:</div>`;
        
        const t = ev.transportInfo || {};
        const orig = t.origem || ev.cidade?.split(' ➔ ')[0] || 'Origem';
        const dest = t.destino || ev.cidade?.split(' ➔ ')[1] || 'Destino';
        const hora = t.horario || ev.horaEncontro || 'Definir';
        const meio = t.tipoTransporte || ev.tipoServico || 'Deslocamento';
        const heianEmitido = t.compradoHeian !== false
          ? `<span style="font-size:10px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; font-weight:bold; text-transform:uppercase;">Emitido Heian</span>`
          : `<span style="font-size:10px; background:#f3f3f3; color:#888; padding:2px 6px; border-radius:4px; font-weight:bold; text-transform:uppercase;">Emitido p/ Cliente</span>`;

        specHTML += `
          <div style="background:#fdfaf6; border:1px solid rgba(196,163,90,0.25); border-radius:8px; padding:12px; font-size:12px; line-height:1.6;">
            <div style="font-weight:bold; color:var(--ink-dk); font-size:14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
              <span>${orig} ➔ ${dest}</span>
              ${heianEmitido}
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; color:var(--ink-mid);">
              <div><strong>Meio:</strong> ${meio}</div>
              <div><strong>Horário:</strong> ${hora}</div>
              <div><strong>Linha:</strong> ${t.linha || '-'}</div>
              <div><strong>Categoria:</strong> ${t.categoria || '-'}</div>
              <div><strong>Duração:</strong> ${t.tempo || '-'}</div>
              <div><strong>Passageiros:</strong> ${t.adultos ? t.adultos + ' Adultos' : '-'}</div>
            </div>
            ${t.observacoes ? `<div style="margin-top:10px; font-style:italic; border-top:1px dashed rgba(196,163,90,0.2); padding-top:8px; color:var(--ink-lt);">Obs: ${t.observacoes}</div>` : ''}
          </div>`;
      } else if (ev.expInfo || typeLower.includes('experiência') || typeLower.includes('experiencia')) {
        specHTML += `<div style="font-weight:700; color:#a3522b; font-size:12px; margin-bottom:12px; text-transform:uppercase;">🎫 Tickets & Experiências:</div>`;
        
        const e = ev.expInfo || {};
        const hora = e.horaPartida || ev.horaEncontro || 'Definir';
        const nome = e.nomeExp || ev.titulo || 'Experiência';
        const heianEmitido = e.compradoHeian !== false
          ? `<span style="font-size:10px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; font-weight:bold; text-transform:uppercase;">Emitido Heian</span>`
          : `<span style="font-size:10px; background:#f3f3f3; color:#888; padding:2px 6px; border-radius:4px; font-weight:bold; text-transform:uppercase;">Emitido p/ Cliente</span>`;

        specHTML += `
          <div style="background:#faf8f5; border:1px solid rgba(163,82,43,0.25); border-radius:8px; padding:12px; font-size:12px; line-height:1.6;">
            <div style="font-weight:bold; color:var(--ink-dk); font-size:14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
              <span>${nome}</span>
              ${heianEmitido}
            </div>
            <div style="color:var(--ink-mid); display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <div><strong>Horário:</strong> ${hora}</div>
              <div><strong>Passageiros:</strong> ${e.adultos ? e.adultos + ' Adultos' : '-'}</div>
              ${ev.localEncontro ? `<div style="grid-column: span 2;"><strong>Local Encontro:</strong> ${ev.localEncontro}</div>` : ''}
            </div>
            ${e.observacoes ? `<div style="margin-top:10px; font-style:italic; border-top:1px dashed rgba(163,82,43,0.2); padding-top:8px; color:var(--ink-lt);">Obs: ${e.observacoes}</div>` : ''}
          </div>`;
      }
    }

    // 2. Se não renderizou nada com as informações ricas, usar a lógica antiga (fallback)
    if (!specHTML) {
      const clientNotionId = ev.clientes && ev.clientes.length > 0 ? ev.clientes[0] : null;
      let roteiroCliente = null;
      if (clientNotionId && typeof dbRotas !== 'undefined') {
        roteiroCliente = Object.values(dbRotas).find(rot => rot.notionClienteId === clientNotionId);
      }

      if (roteiroCliente && roteiroCliente.cliente?.dataInicio) {
        const parseDateUTC = (dateStr) => {
          const [y, m, d] = dateStr.split('-').map(Number);
          return new Date(Date.UTC(y, m - 1, d));
        };

        const diffDays = Math.round((parseDateUTC(ev.dataServico) - parseDateUTC(roteiroCliente.cliente.dataInicio)) / (1000 * 60 * 60 * 24));

        if (roteiroCliente.dias && roteiroCliente.dias[diffDays]) {
          const diaRoteiro = roteiroCliente.dias[diffDays];
          const typeLower = ev.tipoServico.toLowerCase();

          if (typeLower.includes('roteiro')) {
            const sequencias = (diaRoteiro.elementos || []).filter(el => el.tipo === 'sequencia');
            const infos = (diaRoteiro.elementos || []).filter(el => el.tipo === 'info');
            const textos = (diaRoteiro.elementos || []).filter(el => el.tipo === 'texto');

            if (sequencias.length > 0 || infos.length > 0 || textos.length > 0) {
              specHTML += `<div style="font-weight:700; color:var(--crimson); font-size:12px; margin-bottom:8px; text-transform:uppercase;">🗺️ Roteiro do Dia:</div>`;

              infos.forEach(inf => {
                const parts = [];
                if (inf.horarioEncontro) parts.push(`🕒 ${inf.horarioEncontro}`);
                if (inf.localEncontro) parts.push(`📍 Encontro: ${inf.localEncontro}`);
                if (inf.duracaoTour) parts.push(`⏳ ${inf.duracaoTour}`);
                if (parts.length > 0) {
                  specHTML += `<div style="font-size:11px; background:#f5f7fa; padding:6px 10px; border-radius:6px; margin-bottom:8px; color:var(--ink-mid);">${parts.join(' &nbsp;|&nbsp; ')}</div>`;
                }
              });

              sequencias.forEach(seq => {
                const cidadeName = seq.cidade ? `<strong style="color:var(--gold-dk);">${seq.cidade}:</strong> ` : '';
                const atrs = seq.atracoesDoDia && seq.atracoesDoDia.length > 0
                  ? seq.atracoesDoDia.map(a => `<span style="background:rgba(196,163,90,0.1); color:#9c8248; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600; display:inline-block; margin:2px 2px 2px 0;">⭐ ${a.nome}</span>`).join(' ')
                  : '<span style="color:var(--ink-lt);">Nenhuma atração</span>';

                specHTML += `
                  <div style="margin-bottom:8px; font-size:12px;">
                    <div>${cidadeName}${seq.nomeDaRota || ''}</div>
                    <div style="margin-top:4px;">${atrs}</div>
                  </div>`;
              });

              textos.forEach(txt => {
                if (txt.conteudo) {
                  specHTML += `<div style="font-size:11px; font-style:italic; border-left:2px solid var(--gold-lt); padding-left:8px; color:var(--ink-mid); margin-top:8px;">"${txt.conteudo}"</div>`;
                }
              });
            }
          } else if (typeLower.includes('shinkansen') || typeLower.includes('romancecar') || typeLower.includes('trem') || typeLower.includes('ônibus') || typeLower.includes('onibus') || typeLower.includes('transfer')) {
            const transportes = (diaRoteiro.elementos || []).filter(el => el.tipo === 'transporte');
            if (transportes.length > 0) {
              specHTML += `<div style="font-weight:700; color:#9c8248; font-size:12px; margin-bottom:8px; text-transform:uppercase;">🚆 Detalhes do Transporte:</div>`;
              transportes.forEach(t => {
                const heianEmitido = t.compradoHeian !== false
                  ? `<span style="font-size:9px; background:var(--gold); color:white; padding:1px 4px; border-radius:4px; font-weight:bold; margin-left:6px; text-transform:uppercase;">Emitido Heian</span>`
                  : `<span style="font-size:9px; background:#f3f3f3; color:#888; padding:1px 4px; border-radius:4px; font-weight:bold; margin-left:6px; text-transform:uppercase;">Emitido p/ Cliente</span>`;

                specHTML += `
                  <div style="background:#fdfaf6; border:1px solid rgba(196,163,90,0.2); border-radius:8px; padding:10px; margin-bottom:8px; font-size:11px; line-height:1.5;">
                    <div style="font-weight:bold; color:var(--ink); font-size:12px; margin-bottom:4px;">
                      ${t.cidadeOrigem || 'Origem'} ➔ ${t.cidadeDestino || 'Destino'} ${heianEmitido}
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; color:var(--ink-mid);">
                      <div><strong>Meio:</strong> ${t.tipoTransporte || 'Deslocamento'}</div>
                      <div><strong>Horário:</strong> ${t.horario || 'Definir'}</div>
                      <div><strong>Linha:</strong> ${t.linha || '-'}</div>
                      <div><strong>Categoria:</strong> ${t.categoria || '-'}</div>
                      <div><strong>Duração:</strong> ${t.tempo || '-'}</div>
                      <div><strong>Passageiros:</strong> ${t.adultos ? t.adultos + ' Adultos' : ''}</div>
                    </div>
                    ${t.observacoes ? `<div style="margin-top:6px; font-style:italic; border-top:1px dashed rgba(196,163,90,0.2); padding-top:4px; color:var(--ink-lt);">Obs: ${t.observacoes}</div>` : ''}
                  </div>`;
              });
            }
          } else if (typeLower.includes('experiência') || typeLower.includes('experiencia')) {
            const experiencias = (diaRoteiro.elementos || []).filter(el => el.tipo === 'experiencia');
            if (experiencias.length > 0) {
              specHTML += `<div style="font-weight:700; color:#a3522b; font-size:12px; margin-bottom:8px; text-transform:uppercase;">🎫 Tickets & Experiências:</div>`;
              experiencias.forEach(e => {
                const heianEmitido = e.compradoHeian !== false
                  ? `<span style="font-size:9px; background:var(--gold); color:white; padding:1px 4px; border-radius:4px; font-weight:bold; margin-left:6px; text-transform:uppercase;">Emitido Heian</span>`
                  : `<span style="font-size:9px; background:#f3f3f3; color:#888; padding:1px 4px; border-radius:4px; font-weight:bold; margin-left:6px; text-transform:uppercase;">Emitido p/ Cliente</span>`;

                specHTML += `
                  <div style="background:#faf8f5; border:1px solid rgba(163,82,43,0.15); border-radius:8px; padding:10px; margin-bottom:8px; font-size:11px; line-height:1.5;">
                    <div style="font-weight:bold; color:var(--ink); font-size:12px; margin-bottom:4px;">
                      ${e.nomeExp || 'Experiência'} ${heianEmitido}
                    </div>
                    <div style="color:var(--ink-mid);">
                      <div><strong>Horário:</strong> ${e.horaPartida || 'Definir'}</div>
                      <div><strong>Passageiros:</strong> ${e.adultos ? e.adultos + ' Adultos' : ''}</div>
                    </div>
                    ${e.observacoes ? `<div style="margin-top:6px; font-style:italic; border-top:1px dashed rgba(163,82,43,0.15); padding-top:4px; color:var(--ink-lt);">Obs: ${e.observacoes}</div>` : ''}
                  </div>`;
              });
            }
          }
        }
      }
    }

    if (specHTML) {
      specContainer.innerHTML = specHTML;
      specContainer.style.display = 'block';
    }
  }

  // Configurar campos de finanças iniciais baseado no guia do evento
  if (typeof onCalEventModalAssigneeChange === 'function') {
    onCalEventModalAssigneeChange();
  }

  const backdrop = document.getElementById('calendarioEventModal');
  if (backdrop) backdrop.classList.add('active');
};

window.fecharCalendarioEventModal = function() {
  const backdrop = document.getElementById('calendarioEventModal');
  if (backdrop) backdrop.classList.remove('active');
  calSelectedEvent = null;
};

window.toggleCalEventModalValorDiaria = function() {
  const checkbox = document.getElementById('calEventModalGeraPagamento');
  const wrapper = document.getElementById('calEventModalValorDiariaWrapper');
  const input = document.getElementById('calEventModalValorDiaria');
  
  if (checkbox && checkbox.checked) {
    if (wrapper) wrapper.style.display = 'flex';
    // Se o input estiver vazio, tentar preencher com a taxa padrão do primeiro guia marcado
    if (input && !input.value) {
      const checkedBox = document.querySelector('.cal-modal-assignee-checkbox:checked');
      const firstGuideId = checkedBox ? checkedBox.value : '';
      const colab = calColaboradores.find(c => c.id === firstGuideId);
      input.value = colab ? colab.rate : 35000;
    }
  } else {
    if (wrapper) wrapper.style.display = 'none';
  }
};

window.onCalEventModalAssigneeChange = function() {
  const checkedBoxes = document.querySelectorAll('.cal-modal-assignee-checkbox:checked');
  const guideIds = Array.from(checkedBoxes).map(cb => cb.value);
  const container = document.getElementById('calEventModalFinancasContainer');
  const checkbox = document.getElementById('calEventModalGeraPagamento');
  const wrapper = document.getElementById('calEventModalValorDiariaWrapper');
  const input = document.getElementById('calEventModalValorDiaria');
  
  if (guideIds.length > 0) {
    if (container) container.style.display = 'block';
    
    // Configuração inicial padrão baseada no tipo se não houver evento já configurado
    if (calSelectedEvent) {
      const isRoteiro = calSelectedEvent.tipoServico && calSelectedEvent.tipoServico.toLowerCase() === 'roteiro';
      const temDiaria = typeof calSelectedEvent.valorDiaria === 'number';
      
      if (temDiaria) {
        const geraPato = calSelectedEvent.valorDiaria > 0;
        if (checkbox) checkbox.checked = geraPato;
        if (wrapper) wrapper.style.display = geraPato ? 'flex' : 'none';
        if (input) input.value = calSelectedEvent.valorDiaria;
      } else {
        // Sem diária salva ainda
        if (checkbox) checkbox.checked = isRoteiro;
        if (wrapper) wrapper.style.display = isRoteiro ? 'flex' : 'none';
        if (input) {
          const colab = calColaboradores.find(c => c.id === guideIds[0]);
          input.value = isRoteiro ? (colab ? colab.rate : 35000) : '';
        }
      }
    }
  } else {
    if (container) container.style.display = 'none';
    if (checkbox) checkbox.checked = false;
    if (wrapper) wrapper.style.display = 'none';
    if (input) input.value = '';
  }
};

async function salvarAtribuicaoGuia() {
  if (!calSelectedEvent) return;
  
  const checkedBoxes = document.querySelectorAll('.cal-modal-assignee-checkbox:checked');
  const assigneeIds = Array.from(checkedBoxes).map(cb => cb.value);
  
  const checkbox = document.getElementById('calEventModalGeraPagamento');
  const geraPagamento = checkbox ? checkbox.checked : false;
  
  const inputValor = document.getElementById('calEventModalValorDiaria');
  let valor = 0;
  if (geraPagamento && inputValor) {
    valor = inputValor.value ? Number(inputValor.value) : 0;
    if (valor <= 0) {
      const firstColab = calColaboradores.find(c => c.id === assigneeIds[0]);
      valor = firstColab ? firstColab.rate : 35000;
    }
  }

  const btn = document.getElementById('calEventModalSaveBtn');
  const originalText = btn.innerText;
  btn.innerText = 'Salvando...';
  btn.disabled = true;

  try {
    const res = await fetch(`/api/calendario/eventos/${calSelectedEvent.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assigneeIds: assigneeIds,
        valorDiaria: assigneeIds.length > 0 ? valor : null,
        pago: assigneeIds.length > 0 ? (calSelectedEvent.pago || false) : false
      })
    });

    if (!res.ok) throw new Error('Erro ao salvar guias e diária');
    
    // Atualizar no array local para que o reflexo na UI seja instantaneo
    const ev = calEventos.find(x => x.id === calSelectedEvent.id);
    if (ev) {
      ev.assignee = assigneeIds.map(uid => {
        const col = calColaboradores.find(c => c.id === uid);
        return col ? { id: col.id, name: col.name, avatar: col.avatar } : { id: uid, name: uid };
      });
      
      // Sincronizar diárias e pagamentos individuais no estado local
      if (!ev.valorDiariaColab) ev.valorDiariaColab = {};
      if (!ev.pagoColab) ev.pagoColab = {};
      
      // Remover diárias de colaboradores desmarcados
      Object.keys(ev.valorDiariaColab).forEach(uid => {
        if (!assigneeIds.includes(uid)) {
          delete ev.valorDiariaColab[uid];
          delete ev.pagoColab[uid];
        }
      });
      
      // Inicializar diárias de novos colaboradores marcados
      assigneeIds.forEach(uid => {
        if (ev.valorDiariaColab[uid] === undefined || ev.valorDiariaColab[uid] === null) {
          const isRoteiro = ev.tipoServico && ev.tipoServico.toLowerCase() === 'roteiro';
          const colFound = calColaboradores.find(c => c.id === uid);
          const defaultRate = colFound ? colFound.rate : 35000;
          
          if (typeof valor === 'number' && valor > 0) {
            ev.valorDiariaColab[uid] = valor;
          } else {
            ev.valorDiariaColab[uid] = isRoteiro ? defaultRate : 0;
          }
        }
        if (ev.pagoColab[uid] === undefined) {
          ev.pagoColab[uid] = ev.pago || false;
        }
      });

      ev.valorDiaria = assigneeIds.length > 0 ? valor : null;
      if (assigneeIds.length === 0) {
        ev.pago = false;
        ev.valorDiariaColab = {};
        ev.pagoColab = {};
      } else {
        // Compatibilidade global: Sincroniza campos globais com o primeiro colaborador
        const primaryId = assigneeIds[0];
        ev.valorDiaria = ev.valorDiariaColab[primaryId];
        ev.pago = ev.pagoColab[primaryId];
      }
    }
    
    fecharCalendarioEventModal();
    renderCalendario(); // Recarregar
  } catch (err) {
    console.error(err);
    alert('Erro ao atualizar guias e diária. Tente novamente.');
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

window.deletarEventoCalendario = async function() {
  if (!calSelectedEvent) return;
  
  if (!confirm(`Deseja realmente excluir o dia/serviço "${calSelectedEvent.titulo}" do calendário local e arquivar o card correspondente no Notion? Esta ação não pode ser desfeita.`)) {
    return;
  }
  
  const btn = document.getElementById('calEventModalDeleteBtn');
  const originalText = btn.innerText;
  btn.innerText = 'Excluindo...';
  btn.disabled = true;
  
  try {
    const res = await fetch(`/api/calendario/eventos/${calSelectedEvent.id}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao deletar dia do calendário');
    }
    
    // Remover do array local calEventos
    const idx = calEventos.findIndex(e => e.id === calSelectedEvent.id);
    if (idx !== -1) {
      calEventos.splice(idx, 1);
    }
    
    fecharCalendarioEventModal();
    renderCalendario(); // Re-renderizar calendário
    alert('Dia excluído com sucesso do calendário e arquivado no Notion!');
  } catch (err) {
    console.error(err);
    alert(`Erro ao excluir dia: ${err.message}`);
  } finally {
    if (btn) {
      btn.innerText = originalText;
      btn.disabled = false;
    }
  }
};

// Inserir lógica de sincronização na UI do roteiro (Aba Roteiros)
window.sincronizarRoteiroCalendario = async function(roteiroNome) {
  if (!confirm(`Deseja sincronizar o roteiro "${roteiroNome}" com o calendário do Notion? Isso irá limpar eventos anteriores deste cliente e registrar os novos.`)) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.background = 'rgba(255,255,255,0.7)';
  overlay.style.backdropFilter = 'blur(2px)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';
  overlay.innerHTML = `
    <div style="background:#fff; padding:24px; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.15); border:1px solid var(--border); text-align:center;">
      <div style="font-size:32px; margin-bottom:12px; animation:spin 2s linear infinite">⏳</div>
      <strong style="color:var(--crimson); font-size:14px; display:block; margin-bottom:4px;">Sincronizando com o Notion...</strong>
      <span style="font-size:12px; color:var(--ink-lt);">Isso pode demorar alguns segundos</span>
    </div>
  `;
  document.body.appendChild(overlay);

  try {
    const res = await fetch('/api/calendario/sincronizar-roteiro', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ roteiroNome })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao sincronizar');
    }

    const data = await res.json();
    alert(`Roteiro sincronizado com sucesso! ${data.count} eventos criados no calendário.`);
  } catch (err) {
    console.error(err);
    alert(`Erro ao sincronizar com o calendário: ${err.message}`);
  } finally {
    overlay.remove();
  }
};

// ── SISTEMA DE GESTÃO DE COLABORADORES & DASHBOARD FINANCEIRO ───────────────
let calSelectedColaboradorId = null;

window.setupColaboradoresTab = async function() {
  const listEl = document.getElementById('tabelaColaboradoresList');
  if (listEl) {
    listEl.innerHTML = '<div style="padding: 24px; text-align:center; color: var(--ink-lt);">Carregando colaboradores...</div>';
  }

  // Se a lista de colaboradores estiver vazia, carrega
  if (calColaboradores.length === 0) {
    try {
      const res = await fetch('/api/notion/colaboradores');
      if (res.ok) {
        calColaboradores = await res.json();
      }
    } catch (e) {
      console.error('Erro ao carregar colaboradores na aba:', e);
    }
  }
  
  renderColaboradoresTabela();
};

window.renderColaboradoresTabela = function() {
  const listEl = document.getElementById('tabelaColaboradoresList');
  const searchInput = document.getElementById('pesquisaColaboradoresList');
  if (!listEl) return;
  
  const query = (searchInput?.value || '').toLowerCase();
  const filtrados = calColaboradores.filter(c => c.name.toLowerCase().includes(query));
  
  if (filtrados.length === 0) {
    listEl.innerHTML = '<div style="padding: 24px; text-align:center; color: var(--ink-lt);">Nenhum colaborador encontrado</div>';
    return;
  }
  
  listEl.innerHTML = filtrados.map(c => {
    const isSelected = calSelectedColaboradorId === c.id;
    return `
      <div class="colab-list-item ${isSelected ? 'active' : ''}" 
           style="padding: 14px 24px; border-bottom: 1px solid var(--border); cursor:pointer; display:flex; align-items:center; gap:12px; transition: all 0.2s;"
           onclick="selecionarColaboradorDashboard('${c.id}')">
        <div style="width: 32px; height: 32px; border-radius:50%; background:var(--crimson-lt); color:var(--crimson); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; flex-shrink:0;">
          ${c.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style="font-weight: 600; font-size: 13px; color: var(--ink-dk);">${c.name}</div>
          <div style="font-size:10px; color:var(--ink-lt); margin-top:2px;">Ativo</div>
        </div>
      </div>
    `;
  }).join('');
};

window.selecionarColaboradorDashboard = async function(id) {
  calSelectedColaboradorId = id;
  renderColaboradoresTabela(); // Atualiza classe active
  
  const colab = calColaboradores.find(x => x.id === id);
  if (!colab) return;
  
  document.getElementById('colaboradoresEmptyState').style.display = 'none';
  document.getElementById('colaboradoresDetailWrapper').style.display = 'block';
  
  // Preencher cabeçalho completo (Card de Perfil Premium)
  document.getElementById('colabDashNome').innerText = colab.name;
  
  const avatarEl = document.getElementById('colabDashAvatar');
  if (avatarEl) {
    avatarEl.innerText = colab.name.charAt(0).toUpperCase();
  }
  
  const emailVal = colab.email || '';
  const emailEl = document.getElementById('colabDashEmail');
  const emailLinkEl = document.getElementById('colabDashEmailLink');
  if (emailEl) {
    emailEl.innerText = emailVal ? emailVal : 'Não informado';
  }
  if (emailLinkEl) {
    if (emailVal) {
      emailLinkEl.href = `mailto:${emailVal}`;
      emailLinkEl.style.cursor = 'pointer';
      emailLinkEl.style.pointerEvents = 'auto';
    } else {
      emailLinkEl.removeAttribute('href');
      emailLinkEl.style.cursor = 'default';
      emailLinkEl.style.pointerEvents = 'none';
    }
  }

  const waVal = colab.whatsapp || '';
  const waEl = document.getElementById('colabDashWhatsapp');
  const waLinkEl = document.getElementById('colabDashWhatsappLink');
  if (waEl) {
    waEl.innerText = waVal ? waVal : 'Não informado';
  }
  if (waLinkEl) {
    if (waVal) {
      const waNumOnly = waVal.replace(/\D/g, '');
      waLinkEl.href = `https://wa.me/${waNumOnly}`;
      waLinkEl.style.cursor = 'pointer';
      waLinkEl.style.pointerEvents = 'auto';
    } else {
      waLinkEl.removeAttribute('href');
      waLinkEl.style.cursor = 'default';
      waLinkEl.style.pointerEvents = 'none';
    }
  }

  document.getElementById('colabDashRate').innerText = `Taxa Padrão: ${colab.rate ? '¥ ' + colab.rate.toLocaleString() : 'Não informada'}`;
  document.getElementById('colabDashResidencia').innerText = `Residência: ${colab.residencia && colab.residencia.length > 0 ? colab.residencia.join(', ') : 'Não informado'}`;
  document.getElementById('colabDashLocais').innerText = `Atuação: ${colab.locais && colab.locais.length > 0 ? colab.locais.join(', ') : 'Não informado'}`;
  
  // Resetar para a sub-aba de Escala
  mudarSubAbaColab('escala');

  // Buscar eventos do calendário local
  try {
    const res = await fetch('/api/calendario/eventos');
    if (res.ok) {
      calEventos = await res.json();
    }
  } catch (e) {
    console.error('Erro ao buscar eventos para o dashboard:', e);
  }
  
  // Filtrar eventos onde o guia está designado
  const toursColab = calEventos.filter(ev => {
    return ev.assignee && ev.assignee.some(a => a.id === id);
  });
  
  // Popular filtro de Período (Mês/Ano)
  const filtroPeriodo = document.getElementById('colabDashFiltroPeriodo');
  if (filtroPeriodo) {
    const periodos = new Set();
    toursColab.forEach(ev => {
      if (ev.dataServico) {
        const [y, m] = ev.dataServico.split('-');
        periodos.add(`${y}-${m}`);
      }
    });
    
    const prevVal = filtroPeriodo.value || 'all';
    const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    let optionsHTML = '<option value="all">📅 Todo o período</option>';
    Array.from(periodos).sort().reverse().forEach(p => {
      const [y, m] = p.split('-');
      const nomeMes = mesesNomes[parseInt(m) - 1];
      optionsHTML += `<option value="${p}">${nomeMes} ${y}</option>`;
    });
    filtroPeriodo.innerHTML = optionsHTML;
    
    if (Array.from(periodos).includes(prevVal) || prevVal === 'all') {
      filtroPeriodo.value = prevVal;
    } else {
      filtroPeriodo.value = 'all';
    }
  }
  
  filtrarDashColaborador();
};

window.mudarSubAbaColab = function(aba) {
  const btnEscala = document.getElementById('btnColabTabEscala');
  const btnFinanceiro = document.getElementById('btnColabTabFinanceiro');
  const wrapperEscala = document.getElementById('colabSubWrapperEscala');
  const wrapperFinanceiro = document.getElementById('colabSubWrapperFinanceiro');
  
  if (aba === 'escala') {
    btnEscala?.classList.add('active');
    btnFinanceiro?.classList.remove('active');
    if (wrapperEscala) wrapperEscala.style.display = 'block';
    if (wrapperFinanceiro) wrapperFinanceiro.style.display = 'none';
  } else {
    btnEscala?.classList.remove('active');
    btnFinanceiro?.classList.add('active');
    if (wrapperEscala) wrapperEscala.style.display = 'none';
    if (wrapperFinanceiro) wrapperFinanceiro.style.display = 'block';
  }
};

window.filtrarDashColaborador = function() {
  const id = calSelectedColaboradorId;
  const colab = calColaboradores.find(x => x.id === id);
  if (!colab) return;
  
  const periodSelected = document.getElementById('colabDashFiltroPeriodo')?.value || 'all';
  
  // Todos os tours designados para agenda
  let tours = calEventos.filter(ev => {
    return ev.assignee && ev.assignee.some(a => a.id === id);
  });
  
  // Filtrar por período se selecionado
  if (periodSelected !== 'all') {
    tours = tours.filter(ev => {
      if (!ev.dataServico) return false;
      const [y, m] = ev.dataServico.split('-');
      return `${y}-${m}` === periodSelected;
    });
  }
  
  // Ordenar tours por data ascendente
  tours.sort((a, b) => a.dataServico.localeCompare(b.dataServico));
  
  // ── SUB-ABA 1: RENDERIZAR TABELA DE ESCALA (TODOS OS SERVIÇOS) ──
  const tbodyEscala = document.getElementById('colabEscalaTableBody');
  if (tbodyEscala) {
    if (tours.length === 0) {
      tbodyEscala.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding: 24px; color: var(--ink-lt); font-style:italic;">
            Nenhum serviço ou escala atribuída neste período.
          </td>
        </tr>
      `;
    } else {
      tbodyEscala.innerHTML = tours.map(ev => {
        const [y, m, d] = ev.dataServico.split('-');
        const dataFormatada = `${d}/${m}/${y}`;
        
        let localStr = ev.localEncontro || '-';
        if (!localStr && ev.cidade) localStr = ev.cidade;
        
        return `
          <tr style="border-bottom:1px solid var(--border); transition: background 0.15s;">
            <td style="padding:12px 16px; font-size:12px; color:var(--ink-dk); font-weight:600;">${dataFormatada}</td>
            <td style="padding:12px 16px; font-size:12px; color:var(--ink-dk); font-weight:600;">${ev.clienteNome || 'Cliente'}</td>
            <td style="padding:12px 16px; font-size:12px;">
              <span class="compact-card-status" style="font-size:8px; text-transform:uppercase; padding:1px 4px; border-radius:3px; font-weight:600; background:rgba(0,0,0,0.04); color:var(--ink-mid);">
                ${ev.tipoServico}
              </span>
              <strong style="margin-left:4px; font-size:12px; color:var(--ink-dk);">${ev.titulo}</strong>
            </td>
            <td style="padding:12px 16px; font-size:12px; color:var(--ink-mid);">🕒 ${ev.horaEncontro || '-'}</td>
            <td style="padding:12px 16px; font-size:12px; color:var(--ink-mid);">${localStr}</td>
            <td style="padding:12px 16px; font-size:12px; text-align:right;">
              <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center;">
                <button class="btn-secondary" style="margin:0; padding:4px 8px; font-size:11px; border-radius:4px; border-color:var(--border);" onclick="enviarLembreteTrabalho('${ev.id}', 'email')">
                  ✉️ E-mail
                </button>
                <button class="btn-secondary" style="margin:0; padding:4px 8px; font-size:11px; border-radius:4px; border-color:#25D366; color:#25D366; background:#f0fff4;" onclick="enviarLembreteTrabalho('${ev.id}', 'whatsapp')">
                  💬 WhatsApp
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
  
  // ── SUB-ABA 2: CONTROLE FINANCEIRO (SERVIÇOS REMUNERADOS) ──
  const toursFinanceiro = tours.filter(ev => {
    const isRoteiro = ev.tipoServico && ev.tipoServico.toLowerCase() === 'roteiro';
    
    let temDiariaRemunerada = false;
    if (ev.valorDiariaColab && typeof ev.valorDiariaColab[id] === 'number') {
      temDiariaRemunerada = ev.valorDiariaColab[id] > 0;
    } else {
      temDiariaRemunerada = typeof ev.valorDiaria === 'number' && ev.valorDiaria > 0;
    }
    
    return isRoteiro || temDiariaRemunerada;
  });
  
  // Calcular KPIs (somente para Tours Guiados ou outros serviços remunerados)
  const totalTours = toursFinanceiro.length;
  let totalDevido = 0;
  let totalPago = 0;
  
  toursFinanceiro.forEach(ev => {
    let valor = colab.rate || 35000;
    if (ev.valorDiariaColab && typeof ev.valorDiariaColab[id] === 'number') {
      valor = ev.valorDiariaColab[id];
    } else if (typeof ev.valorDiaria === 'number') {
      valor = ev.valorDiaria;
    }
    
    let isPago = false;
    if (ev.pagoColab && ev.pagoColab[id] !== undefined) {
      isPago = !!ev.pagoColab[id];
    } else {
      isPago = ev.pago === true;
    }

    totalDevido += valor;
    if (isPago) {
      totalPago += valor;
    }
  });
  
  const totalPendente = totalDevido - totalPago;
  
  // Exibir KPIs formatados em ienes
  document.getElementById('kpiColabToursCount').innerText = totalTours;
  document.getElementById('kpiColabTotalDevido').innerText = `¥ ${totalDevido.toLocaleString()}`;
  document.getElementById('kpiColabTotalPago').innerText = `¥ ${totalPago.toLocaleString()}`;
  document.getElementById('kpiColabTotalPendente').innerText = `¥ ${totalPendente.toLocaleString()}`;
  
  // Renderizar tabela de tours financeiros
  const tbodyFinanceiro = document.getElementById('colabToursTableBody');
  if (tbodyFinanceiro) {
    if (toursFinanceiro.length === 0) {
      tbodyFinanceiro.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding: 24px; color: var(--ink-lt); font-style:italic;">
            Nenhum serviço remunerado atribuído neste período para faturamento.
          </td>
        </tr>
      `;
      return;
    }
    
    tbodyFinanceiro.innerHTML = toursFinanceiro.map(ev => {
      let valor = colab.rate || 35000;
      if (ev.valorDiariaColab && typeof ev.valorDiariaColab[id] === 'number') {
        valor = ev.valorDiariaColab[id];
      } else if (typeof ev.valorDiaria === 'number') {
        valor = ev.valorDiaria;
      }
      
      let isPago = false;
      if (ev.pagoColab && ev.pagoColab[id] !== undefined) {
        isPago = !!ev.pagoColab[id];
      } else {
        isPago = ev.pago === true;
      }
      
      const [y, m, d] = ev.dataServico.split('-');
      const dataFormatada = `${d}/${m}/${y}`;
      
      return `
        <tr style="border-bottom:1px solid var(--border); transition: background 0.15s;">
          <td style="padding:12px 16px; font-size:12px; color:var(--ink-dk); font-weight:600;">${dataFormatada}</td>
          <td style="padding:12px 16px; font-size:12px; color:var(--ink-dk); font-weight:600;">${ev.clienteNome || 'Cliente'}</td>
          <td style="padding:12px 16px; font-size:12px;">
            <span class="compact-card-status" style="font-size:8px; text-transform:uppercase; padding:1px 4px; border-radius:3px; font-weight:600; background:rgba(0,0,0,0.04); color:var(--ink-mid);">
              ${ev.tipoServico}
            </span>
            <strong style="margin-left:4px; font-size:12px; color:var(--ink-dk);">${ev.titulo}</strong>
          </td>
          <td style="padding:12px 16px; font-size:12px;">
            <input type="number" id="diaria_input_${ev.id}" class="search-input-modern" style="width:100px; padding:4px 8px; font-size:12px; margin:0;" value="${valor}">
          </td>
          <td style="padding:12px 16px; font-size:12px;">
            <select id="pago_select_${ev.id}" class="calendar-card-select" style="width:110px; height:26px; padding:2px 4px; font-size:11px; margin:0; border:1px solid var(--border);">
              <option value="false" ${!isPago ? 'selected' : ''}>⏳ Pendente</option>
               <option value="true" ${isPago ? 'selected' : ''}>✅ Pago</option>
            </select>
          </td>
          <td style="padding:12px 16px; font-size:12px; text-align:right;">
            <button class="btn-primary" style="margin-top:0; padding:4px 10px; font-size:11px; border-radius:4px;" onclick="salvarDiariaEStatusTour('${ev.id}', this)">
              Salvar
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
};

window.salvarDiariaEStatusTour = async function(eventoId, btnEl) {
  const colabId = calSelectedColaboradorId;
  if (!colabId) return;

  const inputValor = document.getElementById(`diaria_input_${eventoId}`);
  const selectPago = document.getElementById(`pago_select_${eventoId}`);
  if (!inputValor || !selectPago) return;
  
  const valor = Number(inputValor.value);
  const pago = selectPago.value === 'true';
  
  btnEl.disabled = true;
  btnEl.innerText = 'Salvando...';
  
  try {
    const res = await fetch(`/api/calendario/eventos/${eventoId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        colaboradorId: colabId,
        valorDiariaColab: valor,
        pagoColab: pago
      })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao atualizar pagamento do tour');
    }
    
    // Atualizar dados localmente em calEventos
    const evIndex = calEventos.findIndex(e => e.id === eventoId);
    if (evIndex !== -1) {
      const ev = calEventos[evIndex];
      if (!ev.valorDiariaColab) ev.valorDiariaColab = {};
      if (!ev.pagoColab) ev.pagoColab = {};
      ev.valorDiariaColab[colabId] = valor;
      ev.pagoColab[colabId] = pago;

      // Sincroniza campos globais de compatibilidade se for o primeiro guia
      const primaryId = ev.assignee && ev.assignee.length > 0 ? ev.assignee[0].id : null;
      if (colabId === primaryId || !primaryId) {
        ev.valorDiaria = valor;
        ev.pago = pago;
      }
    }
    
    // Recalcular KPIs e remontar a tabela
    filtrarDashColaborador();
    alert('Informações de pagamento salvas localmente!');
  } catch (err) {
    console.error(err);
    alert(`Erro ao salvar: ${err.message}`);
  } finally {
    btnEl.disabled = false;
    btnEl.innerText = 'Salvar';
  }
};

window.enviarLembreteTrabalho = function(eventoId, meio = 'email') {
  const ev = calEventos.find(e => e.id === eventoId);
  if (!ev) return;
  
  const colab = calColaboradores.find(x => x.id === calSelectedColaboradorId);
  const nomeGuia = colab ? colab.name : 'Guia';
  const emailGuia = colab && colab.email ? colab.email : '';
  const whatsappGuia = colab && colab.whatsapp ? colab.whatsapp.replace(/\D/g, '') : '';
  
  const [y, m, d] = ev.dataServico.split('-');
  const dataFormatada = `${d}/${m}/${y}`;
  
  let localStr = ev.localEncontro || '-';
  if (!localStr && ev.cidade) localStr = ev.cidade;
  
  // Mapear o tipo de serviço para exibição amigável
  let tipoTraduzido = ev.tipoServico || 'Serviço';
  if (tipoTraduzido.toLowerCase() === 'roteiro') tipoTraduzido = 'Tour Guiado (Roteiro)';
  if (tipoTraduzido.toLowerCase() === 'transporte') tipoTraduzido = 'Transporte / Transfer';
  if (tipoTraduzido.toLowerCase() === 'experiencia') tipoTraduzido = 'Experiência / Atração';
  
  const textoBase = 
    `Olá, ${nomeGuia}!\n\n` +
    `Confirmando o seu serviço designado para o dia ${dataFormatada}:\n\n` +
    `• Tipo: ${tipoTraduzido}\n` +
    `• Cliente: ${ev.clienteNome || 'Cliente'}\n` +
    `• Serviço: ${ev.titulo}\n` +
    `• Horário de Encontro: ${ev.horaEncontro || '-'}\n` +
    `• Local de Encontro: ${localStr}\n\n` +
    `Desejamos um excelente dia de trabalho!\n\n` +
    `Atenciosamente,\n` +
    `Equipe Heian Tour`;
    
  if (meio === 'email') {
    const emailDest = emailGuia || 'guia@heiantour.com';
    const assunto = encodeURIComponent(`[Escala Heian Tour] Detalhes do Serviço em ${dataFormatada}`);
    const corpo = encodeURIComponent(textoBase);
    const mailtoUrl = `mailto:${emailDest}?subject=${assunto}&body=${corpo}`;
    window.open(mailtoUrl, '_blank');
    alert(`E-mail de escala preparado para ${nomeGuia}${emailGuia ? ' (' + emailGuia + ')' : ''}! O seu aplicativo de e-mail foi aberto.`);
  } else {
    const textoWapp = encodeURIComponent(textoBase);
    const wappUrl = whatsappGuia 
      ? `https://wa.me/${whatsappGuia}?text=${textoWapp}`
      : `https://api.whatsapp.com/send?text=${textoWapp}`;
    window.open(wappUrl, '_blank');
    alert(`Mensagem do WhatsApp preparada para ${nomeGuia}! O WhatsApp foi aberto.`);
  }
};


