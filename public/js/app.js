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

  // Abertura em PARALELO (antes era em fila, deixando o carregamento lento).
  await Promise.all([ loadConfig(), loadDB(), loadOrcamentos() ]);
  setupNotion();
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
  try {
    const res = await fetch('/api/config');
    state.config = await res.json();
  } catch(e) {
    console.error('Erro ao carregar configurações do servidor:', e);
    state.config = {};
  }
  
  document.getElementById('cambioUSD').value = state?.config?.cambio_jpy_usd || 0.006280;
  document.getElementById('cambioBRL').value = state?.config?.cambio_jpy_brl || 0.031670;
  if (state?.config?.cambio_data_ref) {
    document.getElementById('cambioDataRef').textContent = 'Última atualização automática: ' + state.config.cambio_data_ref;
  }
  document.getElementById('sheetsId').value  = state?.config?.sheets_id || '';
  document.getElementById('sheetsScriptUrl').value = state?.config?.sheets_script_url || '';
  document.getElementById('abaTransportes').value = state?.config?.sheets_aba_transportes || 'Transportes';
  document.getElementById('abaExperiencias').value = state?.config?.sheets_aba_experiencias || 'Experiências';
  document.getElementById('abaAtracoes').value = state?.config?.sheets_aba_atracoes || 'Atracoes';
  if (document.getElementById('abaHoteis')) {
    document.getElementById('abaHoteis').value = state?.config?.sheets_aba_hoteis || 'Hotéis';
  }
  const setText = (id, val) => {
    document.getElementById(id).value = val;
    if (window.quillEditors && window.quillEditors[id]) {
      window.quillEditors[id].root.innerHTML = val;
    }
  };

  setText('textoObservacoes', state?.config?.texto_observacoes || TEXTOS_DEFAULT.observacoes);
  setText('textoCondicoes', state?.config?.texto_condicoes || TEXTOS_DEFAULT.condicoes);
  setText('textoCancelamento', state?.config?.texto_cancelamento || TEXTOS_DEFAULT.cancelamentos);
  setText('sugestoesTours', state?.config?.sugestoes_tours || '');
  setText('sugestoesTransportes', state?.config?.sugestoes_transportes || '');
  setText('sugestoesExperiencias', state?.config?.sugestoes_experiencias || '');

  if (state?.config?.ultima_sincronizacao)
    document.getElementById('syncStatus').textContent = 'Sync: ' + fmtDate(state.config.ultima_sincronizacao);
}

async function loadDB() {
  const [tRes, eRes, aRes, rRes, hRes] = await Promise.all([
    fetch('/api/transportes'),
    fetch('/api/experiencias'),
    fetch('/api/atracoes'),
    fetch('/api/rotas-base'),
    fetch('/api/hoteis')
  ]);
  state.transportesDB = await tRes.json();
  state.experienciasDB = await eRes.json();
  state.atracoesDB = await aRes.json();
  state.rotasDB = await rRes.json();
  const hoteisJson = await hRes.json().catch(() => []);
  state.hoteisDB = Array.isArray(hoteisJson) ? hoteisJson : [];
  renderTabelaTransportes();
  renderTabelaExperiencias();
  renderTabelaAtracoes();
  renderTabelaRotas();
  renderTabelaHoteis();
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

// Alterna a página Clientes entre a vista Lista (padrão) e o Quadro por etapas
window.setClientesVista = function(v, silencioso) {
  const pg = document.getElementById('page-clientes');
  if (!pg) return;
  const quadro = v === 'quadro';
  pg.classList.toggle('modo-quadro', quadro);
  try { localStorage.setItem('heian_clientes_vista', v); } catch (e) {}
  if (quadro && typeof renderKanban === 'function') renderKanban();
};

// Encontra a chave de exibição no dbRotas a partir do ID imutável (rot_...)
window.chaveRoteiroPorId = function(rid) {
  if (!rid || typeof dbRotas === 'undefined') return null;
  for (const [k, v] of Object.entries(dbRotas)) {
    if (v && v.id === rid) return k;
  }
  return null;
};

// Versão base da cotação aberta (para a guarda anti-sobrescrita no servidor)
window.__orcVersaoBase = null;

async function saveOrcamentoToCloud(orc) {
  try {
    const payload = { ...orc, _baseVersao: window.__orcVersaoBase };
    const res = await fetch('/api/orcamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.status === 409) {
      if (!window.__conflitoCotacaoAvisado) {
        window.__conflitoCotacaoAvisado = true;
        alert('Esta cotação foi alterada em outra sessão (outra aba ou outro usuário).\nSuas últimas alterações NÃO foram salvas.\nRecarregue a página para pegar a versão mais recente antes de continuar.');
      }
      const ind = document.getElementById('autoSaveIndicator');
      if (ind) { ind.textContent = 'Conflito de edição!'; ind.style.opacity = '1'; }
      return false;
    }
    if (!res.ok) {
      alert('Erro ao salvar a cotação na nuvem! Verifique sua conexão ou tente novamente.');
      console.error('Falha no POST:', await res.text());
      return false;
    }
    // Sucesso: a versão gravada vira a nova base
    window.__orcVersaoBase = orc.atualizadoEm || null;
    return true;
  } catch(e) { 
    console.error('Erro salvar orçamento na nuvem', e); 
    alert('Erro de conexão ao salvar a cotação!');
    return false;
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
  _lastSavedOrcSig = orcSignature(orc);
  
  renderListaOrcamentos();
  document.getElementById('orcTitulo').textContent = nome;
  showToast('Cotação salva!');
}

let _autoSaveTimer = null;

// Snapshot da última versão salva: o autosave só grava se algo mudou de verdade.
// Isso evita que simplesmente ABRIR uma cotação gere uma gravação (e sobrescreva
// o trabalho de outra pessoa que esteja editando ao mesmo tempo).
let _lastSavedOrcSig = null;
function orcSignature(orc) {
  try { const c = { ...orc }; delete c.atualizadoEm; return JSON.stringify(c); } catch (e) { return null; }
}

function montarOrcParaSalvar() {
  syncDOMToState();
  const nome = document.getElementById('orcNome').value.trim()
    || document.getElementById('clienteNome').value.trim()
    || 'Rascunho';
  return {
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
}

// Marca o estado atual como "já salvo" (chamado ao abrir uma cotação)
function marcarBaselineAutoSave() {
  try { _lastSavedOrcSig = orcSignature(montarOrcParaSalvar()); } catch (e) { _lastSavedOrcSig = null; }
}

function autoSave() {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => {
    if (typeof window.registrarEstadoCotacao === 'function') {
      window.registrarEstadoCotacao(state.orcamento);
    }
    const temConteudoPre = document.getElementById('clienteNome').value.trim();
    const orc = montarOrcParaSalvar();
    const temConteudo = orc.tours.length || orc.transportes.length
      || orc.experiencias.length || (orc.estadias || []).length
      || temConteudoPre;
    if (!temConteudo) return;

    // Nada mudou desde a última gravação? Não grava.
    const sig = orcSignature(orc);
    if (sig && sig === _lastSavedOrcSig) return;

    const idx = state.orcamentosDB.findIndex(o => o.id === orc.id);
    if (idx > -1) state.orcamentosDB[idx] = orc;
    else state.orcamentosDB.unshift(orc);
    state.orcamento = orc;
    saveOrcamentoToCloud(orc);
    _lastSavedOrcSig = sig;
    renderListaOrcamentos();
    const ind = document.getElementById('autoSaveIndicator');
    if (ind) { ind.textContent = 'Salvo automaticamente'; ind.style.opacity = '1'; setTimeout(()=>{ind.style.opacity='0.4';}, 1500); }
  }, 800);
}

function abrirOrcamento(id, directEdit = false) {
  if (typeof navToPage === 'function') navToPage(directEdit ? 'orcamento' : 'meus');
  localStorage.setItem('heian_last_orcamento_id', id);
  const orc = state.orcamentosDB.find(o => String(o.id) === String(id));
  if (!orc) return;
  state.orcamento = JSON.parse(JSON.stringify(orc));
  window.__orcVersaoBase = orc.atualizadoEm || null;
  window.__conflitoCotacaoAvisado = false;
  
  window.cotacaoUndoStack = [];
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
  if (!state.orcamento.itensAdicionais) state.orcamento.itensAdicionais = [];
  document.getElementById('orcNome').value = orc.nome || '';
  const notionCli = orc.notionClienteId && typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === orc.notionClienteId) : null;
  document.getElementById('clienteNome').value = notionCli ? notionCli.nome : (orc.cliente?.nome || '');
  document.getElementById('clienteAdultos').value = notionCli ? notionCli.adultos : (orc.cliente?.adultos || '2');
  document.getElementById('clienteCriancas').value = notionCli ? notionCli.criancas : (orc.cliente?.criancas || '0');
  
  const temCliente = !!orc.notionClienteId;
  const lockedStyle = temCliente ? 'background:#f1f5f9; cursor:not-allowed' : '';
  const btnEditarCot = document.getElementById('btnEditarClienteCotacao');
  if(btnEditarCot) btnEditarCot.innerHTML = temCliente ? '<svg class="v-icon" style="margin-right:2px;"><use href="#icon-user"></use></svg> Editar Cliente' : '<svg class="v-icon" style="margin-right:2px;"><use href="#icon-save"></use></svg> Salvar Cliente no Notion';
  const btnImport = document.getElementById('btnImportNotion');
  if (btnImport) btnImport.style.display = temCliente ? 'none' : 'inline-block';
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
    if (orc.orcRoteiroVinculado || orc.roteiroId) {
      btnIr.style.display = 'inline-block';
      btnIr.onclick = () => {
        navToPage('roteiros');
        const sel = document.getElementById('selectRoteiroBase');
        if (sel) {
          // Prefere o vínculo por ID imutável (sobrevive a renomeações)
          const chavePorId = window.chaveRoteiroPorId ? window.chaveRoteiroPorId(orc.roteiroId) : null;
          sel.value = chavePorId || orc.orcRoteiroVinculado;
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
  // Abrir uma cotação NÃO deve gravá-la: registra o estado atual como baseline
  // para que o autosave só dispare quando algo mudar de verdade.
  marcarBaselineAutoSave();
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
  // Tanto o preview quanto o editor vivem no painel de detalhe no celular
  window.mostrarDetailMobile('page-meus');
}

window.voltarParaClientesDeCotacao = function() {
  if (state.orcamento && state.orcamento.notionClienteId) {
    const clienteId = state.orcamento.notionClienteId;
    if (typeof navToPage === 'function') navToPage('clientes');
    if (typeof window.abrirDetalhesCliente === 'function') {
      window.abrirDetalhesCliente(clienteId);
      setTimeout(() => {
        const btnTab = document.querySelector('.tab-client-btn[data-tab="cotacoes"]');
        if (btnTab) btnTab.click();
      }, 150);
    }
  } else {
    if (typeof navToPage === 'function') navToPage('clientes');
  }
};

function novoOrcamento() {
  localStorage.removeItem('heian_last_orcamento_id');
  state.orcamento = emptyOrc();
  _lastSavedOrcSig = null;
  window.__orcVersaoBase = null;
  window.__conflitoCotacaoAvisado = false;
  
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
  if(btnEditarCot) btnEditarCot.innerHTML = '<svg class="v-icon"><use href="#icon-save"></use></svg> Salvar Cliente no Notion';
  const btnImport = document.getElementById('btnImportNotion');
  if (btnImport) btnImport.style.display = 'inline-block';
  
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
          <svg class="v-icon no-margin" style="width:1.15em; height:1.15em;"><use href="#icon-edit"></use></svg>
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
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.remove('show-detail');
  });
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
  if (targetPg === 'contabilidade' && typeof carregarSaldosContas === 'function') carregarSaldosContas();
  if (targetPg === 'calendario' && typeof renderCalendario === 'function') renderCalendario();
  if (targetPg === 'colaboradores' && typeof setupColaboradoresTab === 'function') setupColaboradoresTab();
  if (targetPg === 'lixeira' && typeof window.carregarLixeira === 'function') window.carregarLixeira();
  if (targetPg === 'meus' && typeof renderListaOrcamentos === 'function') {
    renderListaOrcamentos();
    // Entrar pelo menu deve sempre MOSTRAR a lista de cotações
    // (o tema a esconde por padrão via classe cot-list-hidden)
    const pgMeus = document.getElementById('page-meus');
    if (pgMeus) pgMeus.classList.remove('cot-list-hidden');
    const tgl = document.getElementById('cotListToggle');
    if (tgl) tgl.classList.add('on');
  }
  if (targetPg === 'roteiros' && typeof renderListaRoteiros === 'function') {
    try { renderListaRoteiros(document.getElementById('pesquisaRoteirosList')?.value || ''); } catch (e) {}
  }

  if (targetPg === 'clientes') {
    const paneList = document.querySelector('#page-clientes .pane-list');
    if (paneList) {
      if (!window.clienteAtualVisualizado) {
        paneList.style.display = 'flex';
      }
    }
    // Limpa a busca anterior ao voltar para a lista de clientes
    const buscaCli = document.getElementById('pesquisaClientesList');
    if (buscaCli && buscaCli.value) {
      buscaCli.value = '';
      if (typeof renderClientesTabela === 'function') renderClientesTabela();
    }
    // Aplica a vista escolhida (lista ou quadro por etapas)
    let vista = 'lista';
    try { vista = localStorage.getItem('heian_clientes_vista') || 'lista'; } catch (e) {}
    if (typeof window.setClientesVista === 'function') window.setClientesVista(vista, true);
  }

  // Calendário no celular abre direto na vista Lista (a grade mensal não cabe)
  if (targetPg === 'calendario' && window.innerWidth <= 768) {
    const btnLista = document.getElementById('btnCalViewList');
    if (btnLista && !btnLista.classList.contains('active')) {
      setTimeout(() => btnLista.click(), 60);
    }
  }

  // Lembra a página atual (pra o F5 não voltar pro início). Toda navegação registra aqui.
  try {
    localStorage.setItem('heian_last_page', pg);
    if ((location.hash || '').replace('#', '') !== pg) history.replaceState({ page: pg }, '', '#' + pg);
  } catch (e) {}
}

function setupMenuCambio() {
  const iJ = document.getElementById('menuCambioJPY');
  const iB = document.getElementById('menuCambioBRL');
  const iU = document.getElementById('menuCambioUSD');
  const btn = document.getElementById('btnRefreshCambioMenu');
  if (!iJ || !iB || !iU || !btn) return;
  
  const clear = () => { iJ.value = ''; iB.value = ''; iU.value = ''; };
  btn.addEventListener('click', clear);
  
  const getB = () => parseFloat(state?.config?.cambio_jpy_brl) || 0.031670;
  const getU = () => parseFloat(state?.config?.cambio_jpy_usd) || 0.006280;

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
      btnFetch.textContent = 'Do Dia'; btnFetch.disabled = false;
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
      btnSave.textContent = 'Salvar'; btnSave.disabled = false;
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
      if (pg === 'dashboard' && typeof selecionarClienteDashboard === 'function') {
        selecionarClienteDashboard('');
      }
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
        if (e.state.page === 'dashboard' && typeof selecionarClienteDashboard === 'function') {
          selecionarClienteDashboard('');
        }
      }
    } else {
      // Sem estado: usa o hash da URL (ex.: usuário digitou /admin#roteiros).
      // Antes caía numa "Nova Cotação" em branco.
      const hashPg = (window.location.hash || '').replace('#', '');
      if (hashPg && (hashPg === 'orcamento' || document.getElementById('page-' + hashPg))) {
        if (hashPg === 'orcamento') { novoOrcamento(); }
        navToPage(hashPg);
      } else {
        navToPage('dashboard');
      }
    }
  });

  // Restaura a última página: prioriza a URL (#pagina); se vazia, usa o que foi salvo no localStorage.
  let restore = window.location.hash.replace('#', '');
  if (!restore) { try { restore = localStorage.getItem('heian_last_page') || ''; } catch (e) {} }
  const restoreExiste = restore && (restore === 'orcamento' || document.getElementById('page-' + restore));
  if (restoreExiste) {
    history.replaceState({ page: restore }, '', '#' + restore);
    if (restore === 'orcamento') {
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
    } else navToPage(restore);
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
    const isFirst = i === 0;
    const isLast = i === currentEditingEstadias.length - 1;
    div.innerHTML = `
      <div class="item-row-header" style="display: flex; align-items: center; justify-content: space-between;">
        <span class="item-row-num">Estadia ${i+1}</span>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button type="button" class="btn-move-up" onclick="moverEstadia(${i}, -1)" ${isFirst ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''} style="background:none; border:none; color:var(--ink-mid); cursor:pointer; padding:2px 6px; font-size:12px;">▲</button>
          <button type="button" class="btn-move-down" onclick="moverEstadia(${i}, 1)" ${isLast ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''} style="background:none; border:none; color:var(--ink-mid); cursor:pointer; padding:2px 6px; font-size:12px;">▼</button>
          <button type="button" class="btn-remove" onclick="rmEstadia(${est.id})">✕</button>
        </div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Cidade</label><input type="text" value="${est.cidade}" placeholder="Ex: Tokyo" oninput="updEstadia(${est.id},'cidade',this.value); filtrarDatalistHoteis(${est.id},this.value)"></div>
        <div class="field"><label>Data Início</label><input type="date" value="${est.dataInicio}" oninput="updEstadia(${est.id},'dataInicio',this.value)"></div>
        <div class="field"><label>Data Fim</label><input type="date" value="${est.dataFim}" oninput="updEstadia(${est.id},'dataFim',this.value)"></div>
        <div class="field"><label>Hotel</label><input type="text" list="datalist-hoteis-${est.id}" value="${est.hotel}" placeholder="Busque na lista ou digite novo..." oninput="updEstadia(${est.id},'hotel',this.value)"></div>
      </div>
      <datalist id="datalist-hoteis-${est.id}"></datalist>`;
    cont.appendChild(div);
    // Popula o datalist de hotéis com o filtro inicial da cidade
    filtrarDatalistHoteis(est.id, est.cidade);
  });
}
function rmEstadia(id) { currentEditingEstadias = currentEditingEstadias.filter(e => e.id !== id); renderEstadiasForm(); }
function updEstadia(id, f, v) { const e = currentEditingEstadias.find(x => x.id === id); if (e) e[f] = v; }

window.moverEstadia = function(index, direcao) {
  const targetIndex = index + direcao;
  if (targetIndex < 0 || targetIndex >= currentEditingEstadias.length) return;
  const temp = currentEditingEstadias[index];
  currentEditingEstadias[index] = currentEditingEstadias[targetIndex];
  currentEditingEstadias[targetIndex] = temp;
  renderEstadiasForm();
};

window.ordenarEstadiasPorData = function() {
  currentEditingEstadias.sort((a, b) => {
    if (!a.dataInicio) return 1;
    if (!b.dataInicio) return -1;
    return a.dataInicio.localeCompare(b.dataInicio);
  });
  renderEstadiasForm();
};

function filtrarDatalistHoteis(estId, cidadeDigitada) {
  const datalist = document.getElementById(`datalist-hoteis-${estId}`);
  if (!datalist) return;
  const cidadeNorm = (cidadeDigitada || '').trim().toLowerCase();
  const hoteisCadastrados = state.hoteisDB || [];
  
  const hoteisFiltrados = cidadeNorm 
    ? hoteisCadastrados.filter(h => {
        const hCid = (h.Cidade || '').trim().toLowerCase();
        return hCid.includes(cidadeNorm) || cidadeNorm.includes(hCid);
      })
    : hoteisCadastrados;
    
  datalist.innerHTML = hoteisFiltrados.map(h => `<option value="${h['Nome do Hotel']}"></option>`).join('');
}

// ── TOURS ─────────────────────────────────────────────────────────────────────
// CORREÇÃO: sem re-render durante digitação — só atualiza estado e subtotal
function calcTotalTour(t) {
  let base = parseFloat(t.valor) || 0;
  if (t.descontoAtivo && t.desconto > 0) base = base - (base * (t.desconto / 100));
  return base;
}
function addTour() {
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
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
function rmTour(id) {
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
  state.orcamento.tours = state.orcamento.tours.filter(t => t.id !== id);
  renderToursForm();
  updateResumo();
}
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
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
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
      `${g.trecho} | ${g.tipo} | ${g.linha} | ${g.categoria} ${g.tempo ? '(' + g.tempo + ') ' : ''}— Ad: ¥${fmt(pAd)} / Inf: ¥${fmt(pInf)}</option>`;
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
function rmTransporte(id) {
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
  state.orcamento.transportes = state.orcamento.transportes.filter(t => t.id !== id);
  renderTransportesForm();
  updateResumo();
}
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
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
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
function rmExp(id) {
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
  state.orcamento.experiencias = state.orcamento.experiencias.filter(e => e.id !== id);
  renderExperienciasForm();
  updateResumo();
}
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
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
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
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
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
function getUSD() { return parseFloat(state?.config?.cambio_jpy_usd)||0.006280; }
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
  document.getElementById('searchHotel')?.addEventListener('input', e => renderTabelaHoteis(e.target.value));
  if(document.getElementById('searchRota')) document.getElementById('searchRota').addEventListener('input', e => renderTabelaRotas(e.target.value));
  document.getElementById('btnNovoTransporte')?.addEventListener('click', () => abrirModalTransporte());
  document.getElementById('btnNovaExperiencia')?.addEventListener('click', () => abrirModalExperiencia());
  document.getElementById('btnNovaAtracao')?.addEventListener('click', () => abrirModalAtracao());
  document.getElementById('btnNovoHotel')?.addEventListener('click', () => abrirModalHotel());
}
function renderTabelaTransportes(filtro) {
  if (filtro === undefined) {
    const el = document.getElementById('searchTransporte');
    filtro = el ? el.value : '';
  }
  const tbody = document.querySelector('#tabelaTransportes tbody');
  if(!tbody) return;
  const lista = filtro ? state.transportesDB.filter(t=>[t.trecho,t.tipo,t.linha,t.categoria].join(' ').toLowerCase().includes(filtro.toLowerCase())) : state.transportesDB;
  tbody.innerHTML = lista.map(t=>`<tr><td>${t.trecho}</td><td>${t.idade||''}</td><td>${t.tipo}</td><td>${t.linha}</td><td>${t.categoria}</td><td class="preco-cell">¥${fmt(t.preco_jpy)}</td><td>${t.tempo||'—'}</td><td><button class="btn-icon" onclick="abrirModalTransporte('${t.id}')" title="Editar"><svg class="v-icon no-margin"><use href="#icon-edit"></use></svg></button> <button class="btn-icon" onclick="deletarTransporte('${t.id}')" title="Excluir"><svg class="v-icon no-margin" style="stroke:#c00;"><use href="#icon-trash"></use></svg></button></td></tr>`).join('');
}
function renderTabelaExperiencias(filtro) {
  if (filtro === undefined) {
    const el = document.getElementById('searchExperiencia');
    filtro = el ? el.value : '';
  }
  const tbody = document.querySelector('#tabelaExperiencias tbody');
  if(!tbody) return;
  const lista = filtro ? state.experienciasDB.filter(e=>e.nome.toLowerCase().includes(filtro.toLowerCase())) : state.experienciasDB;
  tbody.innerHTML = lista.map(e=>`<tr><td>${e.nome}</td><td>${e.tipo}</td><td class="preco-cell">¥${fmt(e.preco_jpy)}</td><td>${e.observacao||'—'}</td><td><button class="btn-icon" onclick="abrirModalExperiencia('${e.id}')" title="Editar"><svg class="v-icon no-margin"><use href="#icon-edit"></use></svg></button> <button class="btn-icon" onclick="deletarExperiencia('${e.id}')" title="Excluir"><svg class="v-icon no-margin" style="stroke:#c00;"><use href="#icon-trash"></use></svg></button></td></tr>`).join('');
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
      <div class="field full-width"><label>Instrução de Compra (Pré-compra)</label><textarea id="m_compra" rows="3" style="width:100%; border:1px solid var(--border); border-radius:4px; padding:8px; font-family:inherit;">${item.compra||''}</textarea></div>
      <div class="field full-width"><label>Instrução de Uso (Embarque)</label><textarea id="m_uso" rows="3" style="width:100%; border:1px solid var(--border); border-radius:4px; padding:8px; font-family:inherit;">${item.uso||''}</textarea></div>
    </div>
    <div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-primary" onclick="salvarTransporte('${id||'null'}')">Salvar</button></div>`;
  openModal();
}
async function salvarTransporte(id) {
  const dados={
    trecho:v('m_trecho'),
    idade:v('m_idade'),
    tipo:v('m_tipo'),
    linha:v('m_linha'),
    categoria:v('m_categoria'),
    preco_jpy:parseFloat(v('m_preco'))||0,
    tempo:v('m_tempo'),
    observacao:v('m_obs'),
    link:v('m_link'),
    compra:v('m_compra').trim(),
    uso:v('m_uso').trim()
  };
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
    <div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-primary" onclick="salvarExperiencia('${id||'null'}')">Salvar</button></div>`;
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
  tbody.innerHTML = lista.map(a=>`<tr><td>${a['Cidade']||''}</td><td>${a['Bairro']||''}</td><td><div class="chip-atracao" style="display: inline-block;" data-id="${a['Nome da Atração'].replace(/"/g, '&quot;')}">${a['Nome da Atração']}</div></td><td>${a['Preço (Ingresso)']||'—'}</td><td><button class="btn-icon" onclick="abrirModalAtracao('${a['Nome da Atração'].replace(/'/g, "\\'")}')" title="Editar"><svg class="v-icon no-margin"><use href="#icon-edit"></use></svg></button> <button class="btn-icon" onclick="deletarAtracao('${a['Nome da Atração'].replace(/'/g, "\\'")}')" title="Excluir"><svg class="v-icon no-margin" style="stroke:#c00;"><use href="#icon-trash"></use></svg></button></td></tr>`).join('');

  // Adicionar listeners para o popover flutuante nos chips
  tbody.querySelectorAll('.chip-atracao').forEach(chip => {
    if (typeof showPopover === 'function' && typeof hidePopover === 'function') {
      chip.addEventListener('mouseenter', showPopover);
      chip.addEventListener('mouseleave', hidePopover);
    }
  });
}
function abrirModalAtracao(idOrName) {
  const item = idOrName 
    ? (state.atracoesDB.find(a=>a['Nome da Atração'] === idOrName) || state.atracoesDB.find(a=>a.id == idOrName) || {})
    : {};
  
  const diasS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const diasVal = [1, 2, 3, 4, 5, 6, 0];
  const diasFechados = item.diasFechados || [];
  
  const checkboxesHTML = diasS.map((diaNome, idx) => {
    const val = diasVal[idx];
    const checked = diasFechados.includes(val) ? 'checked' : '';
    return `<label style="display:inline-flex; align-items:center; margin-right:12px; font-weight:normal; cursor:pointer;">
              <input type="checkbox" name="m_a_dias_fechados" value="${val}" ${checked} style="margin-right:4px;"> ${diaNome}
            </label>`;
  }).join('');

  const salvarParam = idOrName ? `'${idOrName.replace(/'/g, "\\'")}'` : 'null';

  document.getElementById('modalContent').innerHTML = `
    <h3 class="modal-title">${idOrName?'Editar':'Nova'} Atração</h3>
    <div class="form-grid">
      <div class="field"><label>Cidade</label><input id="m_a_cidade" value="${item['Cidade']||''}"></div>
      <div class="field"><label>Bairro</label><input id="m_a_bairro" value="${item['Bairro']||''}"></div>
      <div class="field full-width"><label>Nome da Atração</label><input id="m_a_nome" value="${item['Nome da Atração']||''}"></div>
      <div class="field full-width"><label>Preço (Texto livre)</label><input id="m_a_preco" value="${item['Preço (Ingresso)']||''}"></div>
      <div class="field full-width"><label>Foto (URL da Imagem personalizada - Opcional)</label><input id="m_a_foto" placeholder="https://exemplo.com/imagem.jpg" value="${item['Foto (URL)']||''}"></div>
      <div class="field full-width"><label>Descrição Detalhada</label><textarea id="m_a_desc" rows="4">${item['Descrição Detalhada']||''}</textarea></div>
      
      <div class="field full-width" style="margin-top:8px;">
        <label>Dias Fechados (Recorrente)</label>
        <div style="display:flex; flex-wrap:wrap; margin-top:4px; gap:4px;">
          ${checkboxesHTML}
        </div>
      </div>
      <div class="field"><label>Manutenção/Reforma (Início)</label><input type="date" id="m_a_manut_inicio" value="${item.manutencaoInicio||''}"></div>
      <div class="field"><label>Manutenção/Reforma (Fim)</label><input type="date" id="m_a_manut_fim" value="${item.manutencaoFim||''}"></div>
      <div class="field full-width"><label>Motivo da Manutenção/Reforma</label><input type="text" id="m_a_manut_motivo" placeholder="Ex: Reforma de verão, pintura, etc." value="${item.manutencaoMotivo||''}"></div>
    </div>
    <div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-primary" onclick="salvarAtracao(${salvarParam})">Salvar</button></div>`;
  openModal();
  
  // Clean up any stray HTML tags if the user accidentally saved with Quill previously
  const descEl = document.getElementById('m_a_desc');
  if (descEl.value) {
    descEl.value = descEl.value.replace(/<[^>]*>?/gm, '').trim();
  }
}
async function salvarAtracao(idOrName){
  const checkboxes = document.querySelectorAll('input[name="m_a_dias_fechados"]:checked');
  const diasFechados = Array.from(checkboxes).map(cb => parseInt(cb.value));
  const manutencaoInicio = document.getElementById('m_a_manut_inicio').value;
  const manutencaoFim = document.getElementById('m_a_manut_fim').value;
  const manutencaoMotivo = document.getElementById('m_a_manut_motivo').value.trim();

  const dados={
    'Cidade':v('m_a_cidade'),
    'Bairro':v('m_a_bairro'),
    'Nome da Atração':v('m_a_nome'),
    'Preço (Ingresso)':v('m_a_preco'),
    'Descrição Detalhada':v('m_a_desc').trim(),
    'Foto (URL)':v('m_a_foto').trim(),
    'diasFechados': diasFechados,
    'manutencaoInicio': manutencaoInicio,
    'manutencaoFim': manutencaoFim,
    'manutencaoMotivo': manutencaoMotivo
  };
  if(idOrName){
    const encodeId = typeof idOrName === 'string' ? encodeURIComponent(idOrName) : idOrName;
    await fetch(`/api/atracoes/${encodeId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});
    const i=state.atracoesDB.find(a=>a['Nome da Atração'] === idOrName || a.id == idOrName);
    if(i)Object.assign(i,dados);
  }
  else{const n=await fetch('/api/atracoes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)}).then(r=>r.json());state.atracoesDB.push(n);}
  await loadDB();closeModal();
  // Se estivermos na aba de roteiros, atualiza lá também
  if (typeof carregarBases === 'function') await carregarBases();
}
async function deletarAtracao(idOrName){
  if(!confirm('Remover atração?'))return;
  const encodeId = typeof idOrName === 'string' ? encodeURIComponent(idOrName) : idOrName;
  await fetch(`/api/atracoes/${encodeId}`,{method:'DELETE'});
  state.atracoesDB=state.atracoesDB.filter(a=>a.id!=idOrName && a['Nome da Atração']!==idOrName);
  renderTabelaAtracoes();
  if (typeof carregarBases === 'function') await carregarBases();
}

function renderTabelaHoteis(filtro) {
  if (filtro === undefined) {
    const el = document.getElementById('searchHotel');
    filtro = el ? el.value : '';
  }
  const tbody = document.querySelector('#tabelaHoteis tbody');
  if(!tbody) return;
  const lista = state.hoteisDB || [];
  const listaFiltrada = filtro ? lista.filter(h=>[h['Nome do Hotel'], h.Cidade, h.Comodidades].join(' ').toLowerCase().includes(filtro.toLowerCase())) : lista;
  
  tbody.innerHTML = listaFiltrada.map(h=>{
    const fotoRaw = h['Foto (URL)'] || '';
    const primeiraFoto = fotoRaw ? fotoRaw.split(',')[0].trim() : '';
    const fotoHtml = primeiraFoto ? `<img src="${primeiraFoto}" style="width: 50px; height: 35px; object-fit: cover; border-radius: 4px;" onerror="this.src='https://via.placeholder.com/50x35?text=Sem+Foto'">` : '—';
    const mapsLink = h['Link do Google Maps'] ? `<a href="${h['Link do Google Maps']}" target="_blank" style="color:var(--crimson); text-decoration:underline; font-weight:500;">Ver no Maps</a>` : '—';
    
    return `<tr>
      <td>${h.Cidade||''}</td>
      <td><strong>${h['Nome do Hotel']||''}</strong></td>
      <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${(h['Descrição']||'').replace(/"/g, '&quot;')}">${h['Descrição']||'—'}</td>
      <td>${h.Comodidades||'—'}</td>
      <td style="text-align:center;">${fotoHtml}</td>
      <td>${mapsLink}</td>
      <td>
        <button class="btn-icon" onclick="abrirModalHotel('${h.id}')" title="Editar"><svg class="v-icon no-margin"><use href="#icon-edit"></use></svg></button> 
        <button class="btn-icon" onclick="deletarHotel('${h.id}')" title="Excluir"><svg class="v-icon no-margin" style="stroke:#c00;"><use href="#icon-trash"></use></svg></button>
      </td>
    </tr>`;
  }).join('');
}

window.abrirModalHotel = abrirModalHotel;
function abrirModalHotel(id) {
  const item = id ? state.hoteisDB.find(h=>h.id == id) : {};
  document.getElementById('modalContent').innerHTML = `
    <h3 class="modal-title">${id?'Editar':'Novo'} Hotel</h3>
    <div class="form-grid">
      <div class="field"><label>Cidade</label><input id="m_h_cidade" value="${item.Cidade||''}"></div>
      <div class="field full-width"><label>Nome do Hotel</label><input id="m_h_nome" value="${item['Nome do Hotel']||''}"></div>
      <div class="field full-width"><label>Link do Google Maps</label><input id="m_h_maps" value="${item['Link do Google Maps']||''}"></div>
      <div class="field full-width"><label>Foto (URL da Imagem)</label><input id="m_h_foto" placeholder="https://exemplo.com/foto.jpg" value="${item['Foto (URL)']||''}"></div>
      <div class="field full-width"><label>Comodidades (Separadas por vírgula)</label><input id="m_h_comodidades" placeholder="Ex: Wi-Fi gratuito, Café da manhã, Spa" value="${item.Comodidades||''}"></div>
      <div class="field full-width"><label>Descrição</label><textarea id="m_h_desc" rows="4">${item['Descrição']||''}</textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn-primary" onclick="salvarHotel('${id||'null'}')">Salvar</button>
    </div>`;
  openModal();
}

window.salvarHotel = salvarHotel;
async function salvarHotel(id) {
  const dados = {
    'Cidade': v('m_h_cidade'),
    'Nome do Hotel': v('m_h_nome'),
    'Link do Google Maps': v('m_h_maps'),
    'Foto (URL)': v('m_h_foto').trim(),
    'Comodidades': v('m_h_comodidades'),
    'Descrição': v('m_h_desc').trim()
  };

  const parsedId = id !== 'null' ? id : null;
  const btn = document.querySelector('#modalBox .btn-primary');
  btn.disabled = true;
  btn.innerText = 'Salvando...';

  try {
    if (parsedId) {
      await fetch(`/api/hoteis/${parsedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });
      const i = state.hoteisDB.find(h => h.id == parsedId);
      if (i) Object.assign(i, dados);
    } else {
      const n = await fetch('/api/hoteis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      }).then(r => r.json());
      state.hoteisDB.push(n);
    }
    await loadDB();
    closeModal();
  } catch (err) {
    console.error('Erro ao salvar hotel:', err);
    alert('Erro ao salvar hotel!');
    btn.disabled = false;
    btn.innerText = 'Salvar';
  }
}

window.deletarHotel = deletarHotel;
async function deletarHotel(id) {
  if (!confirm('Remover hotel da base de dados?')) return;
  try {
    await fetch(`/api/hoteis/${id}`, { method: 'DELETE' });
    state.hoteisDB = state.hoteisDB.filter(h => h.id != id);
    renderTabelaHoteis();
  } catch (err) {
    console.error('Erro ao deletar hotel:', err);
    alert('Erro ao deletar hotel!');
  }
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
      sheets_aba_atracoes:document.getElementById('abaAtracoes').value.trim(),
      sheets_aba_hoteis:document.getElementById('abaHoteis')?.value.trim() || 'Hotéis'
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
        await loadDB(); window.dbTransportesCache = null; window.dbExperienciasCache = null; showToast(`Base atualizada! ${data.nTransp||0} transportes, ${data.nExp||0} experiências, ${data.nAtracoes||0} atrações, ${data.nHoteis||0} hotéis.`);
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
  const docTitle = document.querySelector('.pdf-cover-title')?.textContent?.trim() || 
                   document.getElementById('editRoteiroNome')?.value?.trim() ||
                   document.getElementById('rotClienteNome')?.value?.trim() ||
                   document.getElementById('orcNome')?.value?.trim() ||
                   document.getElementById('clienteNome')?.value?.trim() || 
                   'sem nome';
                   
  let finalTitle = docTitle;
  if (!finalTitle.toLowerCase().startsWith('roteiro') && !finalTitle.toLowerCase().startsWith('cotação') && finalTitle !== 'sem nome') {
    const isRoteiro = !!document.getElementById('editRoteiroNome') || !!document.getElementById('rotClienteNome');
    finalTitle = isRoteiro ? `Roteiro - ${finalTitle}` : `Cotação - ${finalTitle}`;
  }
  const cleanNome = finalTitle.replace(/[^a-zA-Z0-9À-ÿ _-]/g,'');
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
        <link rel="stylesheet" href="${window.location.origin}/css/style.css?v=premium_vis6">
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
            .dia-card {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
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
  
  // Só faz a sincronização de DOM se o editor estiver visível e a página de orçamentos ativa
  const editorVisivel = document.getElementById('page-meus')?.classList.contains('active') && 
                        document.getElementById('orcamentosEditorWrapper') && 
                        document.getElementById('orcamentosEditorWrapper').style.display === 'block';
  if (editorVisivel) {
    syncDOMToState();
  }

  const nomeCliente = editorVisivel ? (document.getElementById('clienteNome').value || 'Cliente') : (o.cliente?.nome || 'Cliente');
  const ad = editorVisivel ? (parseInt(document.getElementById('clienteAdultos')?.value)||0) : (parseInt(o.cliente?.adultos)||0);
  const cr = editorVisivel ? (parseInt(document.getElementById('clienteCriancas')?.value)||0) : (parseInt(o.cliente?.criancas)||0);
  let txtPessoas = '';
  if(ad) txtPessoas += `${ad} ${ad>1?'Adultos':'Adulto'}`;
  if(cr) txtPessoas += `${ad?', ':''}${cr} ${cr>1?'Crianças':'Criança'}`;
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
  const antecipado = sinal + tTr + tEx + tItens;

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
  const logoSrc = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAdAAAADQCAYAAAC3KjC0AAAt/0lEQVR4Ae3BV5On55nY59/9PG/6h85xenJCHgDcJWV6V1rL5VqVdqt8IvvMpz71dyAO+Q38HVw+kG25SmVbu5K42mUCCYJEGkzqmemezumf3vTcZoMLLggC090zPdPpvi754fVbGGOMMeZgHMYYY4w5MIcxxhhjDsxhjDHGmANzGGOMMebAHMYYY4w5MIcxxhhjDsxhjDHGmANzGGOMMebAHMYYY4w5MIcxxhhjDsxhjDHGmANzGGOMMebAHMYYY4w5MIcxxhhjDsxhzBly9U+bvPNXw9qe8BhjzPNwGHOWCIxfjJm6mhIlgjHGPCuHMWeECDiHisDklUTTlsMYY56Vw5gzwEfC0FTE2IWEOHOMn48ZmY1xkWCMMc8i4hlFiZC2HYdCoSqUvBs4TRrDHhdxOBSKXqDMlRcpaTriTDgtRIQogfZ4xNzrmY6ei/nSuVdTXX9UyGBHeZnEQdJwRKlwWIpuoMwVszdx4LwQJYIIIIKPeWZFL1DmCsoLkTQdcSY8r/5WINTKSeS8kLYcLuLQ5Z1AVSjPIuIZiMDIbMyr/6KlHIJQwcq9nDs/6QmnhPPCje83dWgq4jBUuTL/QV+e3M55keZez5h7LVVOCRcJadMRJcLXjZ+PGZ6KyLsFGnhp4sxx4a2GztxIOCz3ftqTxc9yzDcQiBIhbTjihiNtOdK2Y2g8UhcLPoLGiEeEZ3L3pz1ZuVtQV8phE4G5V1Pm3siU56AKn/7nrqw/LDiJ0rbj+n/V1OGpiMP26X/uyvrDAlUOLOIZiYBzwi5xkDQdUSLslwbob9doAPWKOOG0ESc4JyDgYyFtOsSxb3WlDLYDu5wHhBdOBJwTdomHrO1wXtivqlCKXkADR8ZFEGeOKBGexkXC+TcauvG4lDJXXiZx4JywSzykLYePhP2qSyXvBbTmd5xg/pCLhMaQozHiGZ6KGJ2NdHg6Jmk66lIp80Co+L3mqEcce6pLpegHQsUXxPFCiROcE3Y5D2nb4bxwUNe/19CdlVLKgXLSCOCc4JzgYyFpCC4SnlVdKkU/ECoQ4ZnJD6/f4lmkLcfIbMwuHwmjc5HOXEtJ2469aA2Lt3NW7+VS10CAfqdmZ6XitBCB0bmYOHOIQNp0TF1NdPxijPPCXvpbNUt3cjYWKuG3tFY66zX97ZoXqT0R0Rz17IoSYfp6opOXE3wk7KXoBZbvFqw/KqSuOBICRKnQHPHanvC0xiIaIw7nhW9S5oH3/+22bD0pUeWlcJHQHvNkw55dPhamriQ6dTUhSoS95L3A0uc5m4uV1KWyq7Na0duqMeAioT3uGZmNGb8Q69i5mCgTBjuBwU5N0VN6WzX9rVqqQlF+551/PaQuEp6mHARW7peszRdSFcqundWKwXaNKi9Ee8LTHI3YFSXCxKVYJy4lpE3HQdSV8vHfduTxbwacNFEsDE1HxJkjbQqtsUhbE56RqYi44divulQ6axWbixU7q5VUubL5pCTvBp6F/PD6LQ5D2nJc+dOmXno7w3nhaVYfFHz473ek6AfOChEYmY155Z+3dGwuZi8f/8eOPPygjypHqj3hee0v2jp+IUEc36oqlCef5dz9SU/6OzVHTQSSpmP0XMzk5UTH5mIaIw7nha97/JsBH/1NR0KtHJXWmOfVf9HWiUsxzgvfpq6UJ5/mfPqjjpQDxfwTEWiOeiavJExdSXRkNibUys5qzfZyyfZyJTurFf3tQKiUr0pbjn/5P08oTxFqZenzgjs/7kp3o+aoZEOOa99t6oW3GiCAgjj2pAqbiyW//HfbUvQCJ11rPGLqSszca5kOTUXsJe8FVu4WLH4ykK2lirpSnpf/y/EZDkNdKt7z3viF5AdRIjzNnZ/0ZPNJyVlTFUqUuvcmLiU/4CkGncCn/6nzXlUoR63oK2nbvzc6F//AeeHbDHYCjz8ayMZCyXFRl0p3vWZrqXqvv1O/JyI/SFsOHwlflbUdK3fz94q+clTKgZK23HujM/EPfCx8m7wTmP9wINvLFeafRIkw+0rGpbcbeuGtxg+ylmf9ccnCxwN5/JvBe08+K97bWa0o+4oG/sjwdMT5N7If8BRlrix8lMvqg4KjVJeK8/LexMX4B1WuVHkgShwiPJUIxIkj74T3tpcrTrqyH9hcrBh0wntpy/+gMez5Nnk3sPDxgAfv92VntUIDh8JxiEINoVL2UuWBs6gqlLwb2MugE6gr5bioSwXlqTRAXXEsFb3A0uc5d37clYcfDhh0Al+VNB3n38yUI1YOlBB4qqpQ+ls15p80Rz03vt/SG99v6tTVhM5azZ2f9OT2f+nK/K/6bC9XhFp5XqGGUCtHTRWqXClzJe8G1h+XDDqB/fCxMPtqqmnbcVqs3Cv4/Mdd6W3UfJNQKasPCh79eiD9nZrD5DDmDNAAnbWa+V/25c6Pu9Jdr1Hl9869mhFnjpNAg2J+Z3Q25rW/aOvFtxtEsfD4owGf/agjD3/Vp7NWoYFTTYOy/qiUjccFoVb2Ig7a456Z6ymnydZiyb33exJq5es6GzVLn+fS3645bA5jzpC8F1j8NOfzH3elt1mD8oW05Tj/Roo5OeZez3j1L1o6dTWhv11z+x96cu9nfdl4XFJXylkx2KlZvltIb7NmP+LUMXM91WzIcVqEGlbuFaw/KvkqDbC5ULK5UKLKoXMYc8bUpbJyt+D233elv12D8oXL7zbVx4I5/s6/kXHte00dnY3ZXCj5+G92ZOHjAf3tmrNGFdYfFmw9qQi1shdx0J7wTF9POU3KgfLks1z4isFOzdaTSspceREcxpxBdaWs3Cu4/fddqQplVzbkmL2ZYo63829kXP1uU5ujntX5gl//fzuy/qikLpWzqsyV5Xu59LcC+xFnjumriTaGPadFqJWtpYruZs2Xels1O6sVL4rDmDMqVMrynYI7P+5KqJVdl99tKObYOv9GxtXvNrU56lmbL/jobzrSXa9R5cxbmy/ZWioJtbIXcdCeiJi+lnCalIPAznLFlwY7ge5GzYviMOYMqyvl4a8HPLmds6s56pm6kmCOn+lrKZe/09DmqGdtvuCjv+lIf6vG/E5dKkuf5zLYCexH0nRMXk60MeI5LepS2Voqhd+qCmWwUxNq5UVxGHPG1aXy2Y+6MtipcZFw5U8aijlWRs/FXP1uQ9sTEVuLJR//bUf6WzXmD63cL9hergi1shcRGJqKmLqacFqEGgadwK5QKVWJ8AI5jDHk3cAv/t22iEB7MmL8YoI5HtK24/K7DR2ejulv13zyo470t2rMH9MAjz8eSN4N7EfackxdSbQ9EXEahFrJu4FdZa4MdmpeJIcx5gvbSxXzv+wTxcL511NFMEfMx8LFWw2duJwQauWzH3VlZ7lGFfMtVu8XbC9XhKDsx9hczMz1RBFOB+ULGiBUvFAOY8zv3f1ZT/o7gbHzMe2JCHN0RGD6esK5V1J8BPff77P+qCTUinm6++/3Je8E9sPHwviFhJHpiNNAA1SF8jI4jDG/V/QD99/viThh5nqiCOaIDE1FzL2WaWPEs3y34MlnAykHAbO3zcWSlXsFoVL2Y2Q2YvxigvOceHWl9LdrXgaHMeb3NMCTz3IefzRAA+K8YF6+OBVmb6Y6fiGhv1Wz8MlAels1Zv8eftiXvBfYDx8LE5diHZqMMPvnMMb8gapQPv/7rtz9aY9QKeblch7GLyRMXU0IlfL4o4FsLpRowBxAZ61m+U6BBvZldDZm7HyMjwSzPw5jjDlGGsOe2VdTbY1HrD0sWL5bUA4Uc3APP+xL3gvsh4+FySuJtic8Zn8cxhhzTPhYGL+QMHExZrBTs3y3kO5GhXk23Y2axU8H7NfobMzoXIyPBbM3hzHGHAcCrTHPzM1EfSyszZeszRdowDyHR78eSN4J7IePhelrqbbGPGZvDmOMOQbiVJi8nDA6G9PdqFm5l0veDZjn09usefzxgP0amYkYm4uJEsE8ncMYY46aQHPEM3szVX5rbb5k/XGJORyPfj2Q/nZgP3wszNxItTHsMU/nMMaYIxYnwsTlhPZERHejZvVBIVWumMPR3665/35P2KfhmYix8zE+Fsy3cxhjzFESyIY9c69mWtfKxkLJ1pMSc7iWbudsLVXsh4+EC29m2hrzIJhv4TDGmCPkI2HiUkxz1NPfqlm+m0tVKOZwFYPA/Ad9YZ/aExHT11KNEsF8M4cxxhyhOBXOvZqpBmV7qWJrscIcPg2w/qhgY6FkP8TB3Gsp2ZAHwXwDhzHGHBHnhckrCUMTnkE3sHK/kLpSzItR9JRHHw6EfcqGPbM3U/WRYP6YwxhjjoiLYPaVTBXYWalYvV9gXpxQKxuLJeuPSvZDBC68kZG2HOaPOYwx5igIDE1GjJ+PqQbK2nwpdaWYFyvvBB7/ZiDsU9pynH8jU+cF84ccxhhzBJzAhbcyFQd5L7D42QDz4oVa2VoqWXtYsC8CF281iBuC+UMOY4w5AnHDMX0tpSqUpc9zqlwxL0d/O7DwcS4o+xJnwpV3m4r5Aw5jTjHnhTgVnBfM8TJ7MyVKhCoPLN8tBPPShFrZXChZ/Cxnvy7eykhbDvNPHMacYuffSPmz/2lcZ19JMceH83DxVkM1wM5qxc5KhXm5+js1y3dyKQfKfvhEuPqnTUUw/8hhzCnlIyFKHeb4GT0X0xr31JXy+KNcMC+dBtheqVh9UICyLxfezGgMe8zvOIw5pZKWoz3uFXPszL2eKb+VdwMbj0vM0ehv16zcz6XoB/bDJ8KV7zRUBPNbDmNOI4HGsGN4OsIcL3EmTFxK0AArd3OKfsAcDQ2w9aRi7WGJKvsy+0pKezLCgMOYUyhOhbFzsTZHI8zxMnk5IW05VJXle4VgjlR/u2ZtvpCiG9iPOHVc/ZOm+kg46xzGnDLOw8hszOwrKc5jjpnZVzIVoL8d2FqqMEdLA2wslKwvlKiyJ3EweSVmdC7mrHMYc4qIg/ZExMVbDW1PRJjjpTHsGZmJQGD585xQKebo9bdr1ucLyTuB/fCxcPFWpj4WzjKHMaeEOBieirj63aZOXUkwx8/klYQoFXYt3ckFcyxogPXHJRsLBaFW9uK8MHouZvxCzFnmMOYQRImQtR1HJUqEc69k3Pyzls5cTxGHOYbGL8TqnNBZq9hZrTDHR3+rZvluIf2twH7EmXD+jUyjRDirIow5BHFDmLqa6NZSJVtPSl6WOHOMn4+Zupbo2FxMc9Rjjqe05RiajBAHS5/nhBpzjKjC+sOSzcsljRGH88LTOC8MT0eMX0xYvpNzFkUYcwicF8bmYl755y3dXiqpS144H0FrIqI57GmOesRhjrHxiwlJQ9i19HkhmGOn6AdW7hcyei7W1phnL2nLce7VVNcfFlIVylkTYcwh8bEwdi5meCpCAy+cOIgSwZwM4+dj9ZHQWavpbtaY42ltvmD6WkJj2OG88DTOC8PTEROXE5Zu55w1EcYcokGnZutJRVUqL5qPhLHzEVnbY463OHMMT0c4L6zcz9FaMcdTlSvLdwoZnY21OerZS9Z2zFxPdW2+kCpXzpIIYw7J9nLFnZ/0ZHOxBOXFE4hiYex8zKV3Gjo8HWGOp9FzEUnDgcDK3UJUMcfY6v2C2VdSsiGH88LTOC8Mz0RMXkp4cjvnLHEYcwgGncDjjwayei+n6AWKfqDoB4p+oOgHin6g6AeKfqDoB4p+oOgHin6g6AeKfqDoB4p+oOgHin6g6AeKfqDoB4p+oOgHin6g6AeKfqDoBXpbNYuf5rz/f2zJpz/qSl0q5vgZmYk0SoS8G+hu1Jjjra6UxU9zybuB/WgOe6aupRqnjrPEYcwhqAsl7wRC4KULtZJ3Aw8/6PPB/70t/a0ac7yMnU+IUmFtvqCuFHP8rdzN2Vmp0KDsRRyMzERMXI45SxzGHBLlaNWVsvqg4MP/Z0f6WzXmeBiajIgzYdfGYiUaMCeAKtz/RV/yrrIfrTHP5OVE49RxVjiMOUVUYXu54u7PelIVijl6o+dikoZDFTYXC0KtmJNh43HJyv2CUCn7MXk5YeZmAsKZ4DDmlKlLZe1hyfLdAhRzxIamvEapsPWkpOwp5mR5+GFfir6yH2nLMXEx0eaI5yxwGHMK9bdqlm4PpMwVc3TiTGiOenwkbC5W1JViTpadlYqVewUa2Jex8zFj52PEceo5jDmleluBzYUSc3TaExFJw6EK648KqSvFnDzzv+pJ0Q/sR9pyTFxKtDHsOe0cxpxSebdmZ63CHJ32eEScOYpeoLdVowFzAnXWapY+z9mv8fMxo+dinOdUcxhzSlWFkneDYI6ECLQnvMaZsL1UUheKObnmf9WXohfYj7TlmLycaDbkOc0cxpxSGmBntWLxswG9zRrzcsVNR2PE4yNha6WiKhVzcnXXaxY+ydmv8YsxI7MRzgunlcOYU2zjcclnP+rK5mKJebnaY5606dAAOyu11KViTraHv+rLoBPYj7TpmL6aatZ2nFYOY4x5AVpjEUnTMdipGWzXaMCccL2tmvkP+sI+jV+MGZ6JcF44jRzGGHPIxEFrzGvSELZXK8pcMafDwkcDdlYq9iNpOGZupJq2HKeRwxhjDlnScKRth/PCzkpFVQTM6VAMAvO/6gv7NHExYXgmwnnhtHGYl0YEnMeYU68x7Elbjl3djVqqQjGngwZYfVCytVSxH3EmnHsl1bghnDaOIzB5JVHh7EnbnpHZWDHmlGuOerK2Y7ATyLsBDZhTpOgFHn7YF/Zp4lLC6EyE85wqjiMwezPl5p+1dGgq4ixwXhiZibj8bkNnricYc9o1R72mLUdnraLsB8zpEmpl41HJ5mLJfkSJcOW7TY1Tx2kScQTizHHx7QazN1OtSuW0EwEfC3HqiFLBmNMszhxpy+G8sLNWUQwUc/oMuoFHvx7I6LlY2YeR6ZipawkLHw8INadCxBGJEiFKPMaY06Ux7GgMOXb1tmqp8oA5fUKlbC6WbDwuGTsfsxdxcPk7DX1yO5dQK6dBxBFZ/Czn3k97MtipOQuSluPyOw09/0aGiwRjTqu05UiajrwTyHcCocacUv2dwOOPBzJ2Plb2oTUWce5myqPfDFDlxIs4Aqv3Cz7899uigTOjzGvu/bwvzouefzPDmNOqMexpDHk66xXFIGBOr1ApG49Klm7nzNxM2YsIXP1eUx99NBCUE89xBB5+2BdVzpxBp2ZrqRSMOaWcF9KW0ygVuhs1RU8xp1t/p+bJ7VzqQtmPxrDnwlsNTgOHeWk0QF1hzKmVNoWs7djV3wmUecCcbhpgZ7Vi5UHBfl37XkN9JJx0DmOMOSTpkKcx7KkLpb9VS5Ur5vTrbdWs3C2kHCj7kbU9F25lnHQOY4w5JGnDkbUd/U6g6AXM2aABtpZK1uYLUPbl8rsNjTPhJHMYY8whEIFsyJG2Pf2tmrwbMGdHb6tmdb6Qoh/Yj6ztufBmg5PMYYwxhyBKHWnbqfMw6ASKfsCcHRpgc7Fk/XGJKnsSB+ffSDVtOU4qhzHGHII4E7K2RxXyTk2ZK+Zs6W3WrM0XUvQC+5ENe86/kXFSOYwx5hAkTUdj2FMOAoNOkFAp5mzRABuPSzYel4Sg7MV5YfaVVBvDnpPIYYwxhyBtOJojjsFOIO8EzNnU26pZvpfLYDuwFxFoDHsuvJWpOE4chzHGPCfnhKTpiDPHoBMYdGvM2aQB1h+WbC6WhFrZSxQLM9dTRmZiThqHMcY8J58K2ZBTcTDYqRl0AubsyruB1QeFDHYCexLIhhznXk3VeU4UhzHGPKc4FRrDnrpS8m6QulDM2bY2X7K1VBJqZS8+EsbOx4zMxpwkDmOMeU5x5miNecp+IO8GVDFnXNEPLN8tZNAJ7EmgOeyZvZGq85wYDmOMeU5JJjSGPUVfybsBY3atPijYXq4ItbIXnwijczGj52JOCocxxjwH54W05YhSoegH8m7AmF1VrizdziXvBvajNeaZvpaq85wIDmOMeQ4+ERojXkWg6AXybsCYL63cK9hZrdCg7MXHwuhczOhcwkngMMaY5xAlQnPEowHyXqAYBIz5Ul0p8x8MJO8q+zE04Zm6kqjzHHsOY4x5DlEsNIYdqoACyokTJQ7z4qw9LFh7WBAqZS8uEsbmYkbnEo47hzHGPIcoERojHuehNeZpjnpOEhGYey1RzIujMP9BX8pc2Y+hqYjJS7G6SDjOIowx5hmJg6TpSBqOXZNXUoq+6r33e1L0AsedCMy9njF9PcW8WNvLFav3C869luK88DTOw/iFhNH5kvWHBcdVhDHGPCMfC60xz5echwtvZUxeTnTQDRx3aVPIhjwimJdg/oO+TF1NNGkKexmaihi/EOv2UilVoRxHEcYY84yiRBiaipR/FGqlKhRx0BhyHHfOY16i7ZWK5bsF59/MEOGpnIfJSwnrDwvWH5UcRxHGGPOMfCQ0RzwoFP3A2qOSzYVS6lI5CeLMMX090ZGZGOcxL8H8Bz2ZuZ5o3HDsZWgqYux8rNsrlVS5ctxEGGPMM/Kx0BhxVIWy8EnO3Z/2pBwETpInt3N556+GdfRchHnxdlZrntzOufh2g704D9PXUjYXKtYfFahyrDiMMeYZiIOk6YhTR2+rZvluLuUgcNIMdmoef9QXzEvz4IO+FL3AfgxPR0xeTTRpOI4bhzHGPAMfCcNTEbvyXqCzVnFSdTdqzMvTXa95+OsB+zV9NWFoMkKEY8VhjDHPwHmhOeY1VMpgJ1AOFGP26+EHfemu1+xHc9QzcTnRuOE4ThzGGPMMXAStMU+ZK92NSjDmAIp+YP5XfWGfZm4ktCc8IhwbDmOMeQbOC+2xiLpU+lsBYw5CFZbvFuysVOxHY9gzfTXVOHMcFw5jjDkgcdAa9USpUBVKb6vGmIMqeoGHHw6EfZq5mdIa84hwLDiMMeaAnBOGpiJ2VYXS36ox5qBCraw9LNhaqtiPrO2YuZlqlAjHgcMYYw5IPLTGvdaV0t2oqSvFmGeRdwKPfzMQ9uncqynN0QgRjpzDGGMOyDlhaCKiLpTueiUY84zqSll/XLC5WLIfScNx/o1UXSQcNYcxxhyQOGiNe+pK6W3VGPM8BtuBhY9zYZ/mXs9ojniOmsMYYw5ABEZmIpwXqkLZWakx5nnUlbL+qGD5bsF++Fi49G5DxXGkHMYYcwAiMDQVqSqUfWXQqTHmefW2ahY/G0iolP04/3pGc8RzlBzGGHMQIrQnIkKtdDZqjDkMGmBnuWLlQcl+iINr/6ypHCGHMcYcgDgYmoioS2VnuRSMOSS9rZrlO7lUhbIfc69ltMYijorDGGMOwEdCa9wTKuhs1BhzWDTA9lLF2nzBfl3/flPFcSQcxhhzAOMXYnbVldLbqDHmMHU3K1bvF1IOlP2YvZEyNBlxFBzGGHMAY3OxqkLRDRT9gDGHSQNsPqlYf1SAsicRuPqnTY0S4WVzGGPMAQxNerRWtlcrjHkRuhsVa/OlFP3AngSmriZMXkl42RzGmG+VNBzT1xKGpyNEOPN8LLQmIkIN28uVYMwLoAE2Fko2Fko0sCcXCRfeamicCS+TwxjzjVwkTF5OeP1fDun09VQRzrzWWETScISgdNYqjHlRuhsVK/cK6e/U7EUEhqc8U1dSXiaHMeYbNYYdc6+nWvQDa/OFaODMGz0XsasuobdZY8yLogHW5gs2F0s0KHuJEse511JNGsLL4jDG/JEoEWZupAzPxGw+KdleqjAwcTFWVRjs1FSFYo6WjwUfC6fVoBNYe1BKfyewF3EwPBUxdTVVXhKHMeYPiIPhmYgLb2Za9AKr9wupK+Wsc5Ewei4Gha2lCnP0okSIE+E0W3tYsPWkIgRlL3HmmL6RkmSOl8FhjPkDSdNx+d2Gpk3H1lLJ5kKJgeaII2k6VJWt5UowR8bHQpwJ4gSccJrl3cDq/ULyncBexEGj7UiajpfBYYz5PeeFy+80dOJSQjFQ1h6UUuaKgdFzMbs0QGe1whwdH0OcOaJEiFPhtFt9ULC9UhGCsicBcbwUDmPM783cSLjwZoZzQne9YuV+gfmdsfOJ8o96mzXmaESJ0BjyiIBPhDgTFcepVvQDS3dyyTuB48RhjPnC8HTEK3/e0rjhKPPA0p1CykHAgI+F8Qsxu7ZXKkKtmKMRpUJj1Cu/JQJp0xFnjtNu5W7BzmqFBuW4cBhjaI55bv3lkGZDHhTyTmD5To75nfHzMXEm7KoKxRydJHO0xzxfao1HNIY9p11VKI9+k0veVY4LhzFnXHPM8+5fD2trImJXVSqLn+aS9wLmdyavJOocXxiZiTBHQwQaI57hmYgvtSc8zVHHWbD2oGD9UUGolOPAYcwZ1hzzvPvXw9qeiBDhC3WpPLmdg2J+K205pq+liBN2+UhojXvMyxc3HKPnYnVe+FLScIzNJZq1HaddqJWHH/alHCjHgcOYM6o56nn3r4Z1aCJChC+EWln8NKe/XWN+59p3m5o0hC85L1x4s6GYl0oE2hOeuddSvm72ZsLIbMxZsLlYsfaoJNTKUXMcJsEcAhHMC+S8cO7VlO/9m1EdmopA+L1QwaPf9IXjTISXQQRmbqTM3ExxkfAlcTD3esrQVASCeUmyIc/ld5qaNB1fF2eOi283dHg6AuHUm/9lT6pCOWqOQyICUSz4WNiLj4WzyEdCnAl7aY97olg4FgScF/biPESJcGwJ+EhojXle+2/a+sZ/O6TZkOPrVh4UdNdrjkKcOZzjqeLMMTwV8aL5SBg7H3Pzz1qathxfl2SOd/71sI7MxDgvnHQ+EvYiAuIEEV66rO249E5Dp68nfJuJizFX/rSpQxMRzgun2dZSxer9AlWOlOMQiIPmqGfiUqJpy7GXi7camrUcIpwZzguj52Jmb6TKHnwsnHs1I86Eo+S80Bz1zNxI1MfC06Qtx/iFWLO2Q4RjQQR8LCQNx9BkxMW3G3znvx/Ri7cyolT4ulAr93/eE14y54XmqGf6WqJR5niapCFMXk40aThEOFTiIM6ExpDnwlsZt/7VsLbGPN9IoDnmufWXQzp9PSFrO6JEEMeJIgJx5ph7PVP2kLYc4xdjbY55xPHCiYM4E4YmI17587Ze+ZMGezn3SspbfzmkszdTGsOeKBGcE06jB7/oS1UoR0l+eP0WzyLOhOaoZ1fScMy9lun09QTnhf1YuV9w//2e1KWCQtFX+ts1p4ZAe8zjE0FEaI56LryV6dhczH7UpfLgl32W7+bCb2mAQSdQ9AIvUmPIk7SEXc1Rz8W3GjoyG+G8sJeqUJY+z1n8JJeqDBy1KHG0xjzD05FOXIzJhjxPs7FQ8pP/bVN4wZyDtO1JmsKuxrDn/BuZjp+PcZGwl3IQWLqd8+TzQqoisKu/HSh6gYPykZANOaJUSFuOsblYxy8ktMc9LhL2o66U7aWK1flCdlYqin5gsBPIu4HjKGs7kqZDHPhImLmR6sVbDcSxp1DD8p2chY8HUgwCu/rbgbIfUOVQpE1HNuRI257xC7HOvpKSNh0Htf6oZO1hId31mkGnRgNsL1ecJm/95ZCefyPjm3TWam7/XVeW7+W8KPLD67c4KBGYuZHyzl8PK4egrpSFj3M++g87winhIuF7/2ZER8/FHIZyoNz+L115+GGfF+m1v2jr5e80OGs0wPv/dktW5wtetKztuP79ll54M+OwfPy3HZn/oM9BtSciXvnzlk5dTThMn/6oK/d/3uM4uvH9ll56p0GcCYfh47/tyOOPBtSlchguv9vg5p+11MfCYSpz5T/8r6vCKTI06fne/zimcSp8XWet5vbfdWX5Xs6LEvGMin5g43HJYQi10tushdNEle2VCg0ciqpQ8m7gRett1bLxuFROGR8LcSYkTYePhK/rrFWszhe8DKGG3kYlG49L5ZDk3cCzqEuls1YRJcJhyndqjqv+Ti2bi6VGiXAY8m6NKodm0A1sLpY4LxymqlROm53Vmocf9hk7F/N1/e2aYhB4keSH12/xLHwiZC3HYSlzpegFTg2BrO3xEYdCFcq+UuaBFylpOuJUOG2ShqM56hmajHR0LqY94fGRsEsD/Pr/3ZGFjwe8DOIgaTiiRDgsRS9Q5spBOS8kDcHHwmEq+oFyoBxHccMRp4IIh6LoBcpCQTkUcepImsJhU4XeZs1p42Mhazu+LtRQ9AN1qbwo8sPrtzDmrBAHY3Mx177b1LELMc4LO6sVP/3fN6UcKMYYs18OY84QDbD+qOTxRwMpesquhY8GUhWKMcYchMOYM6izXlOXSm+zZvlugQaMMeZAIow5g6pCWfh4IHkvkHcDxhhzUBHGnEF5L/DoNwNCrdSVYowxBxVhzBkUKqWoFGOMeVYOY4wxxhyYwxhjjDEH5jDGGGPMgTmMMcYYc2AOY4wxxhyYwxhjjDEH5jDGGGPMgTmMMcYYc2AOY4wxxhyYwxhjjDEHFmGMMeZEc07wMYgTDkJVqSsIlfI0LhKSTPCx4CPBRUJVKKFSin6gKpT98pHgYmGX1kpVKHsRAZ8IzgkhKHWhqPJ7ScPxbUKt1KWiyqGLMMYYc6I1RhwTlxLSllMOoC5VNh6XbCyUfJOs7WiNR7TGPO2JSNOmI24IceoY7NSUudJZq6SzVtHdrOlvBUKtPM3wTMTk5UT5rc56LYufDNhLnDmmbyQ0hrwOOkEWPxlQFcouEbj8nYbyLapCpbdZ01mv6G8HQqUcFvnh9VsYY4w5uaauJNz885YOTUYcRNEL3Pt5X+6/3+OrokQYmYmZvpboxOWE5qhHhG+kCkUvsLlYsny3kPWHBYNO4Ntc/W6Tm3/WUn5r+W7BL/+vLWEPrXHPW//dkI7OxWwvV/zi/9ySQSewSxz8q/9lSnmKvBfYXChZvlPIyv2CchA4DBHGGGNOtDJXtpcrqkL5qqzlaAx7ECgHgc56zVdVuZJ3a74qaztmbqacfz3T1rjHeaEqlM5aRX+75ksiQtwQWmMRWdsxcyNlZCbWpemIxx8NpLNaocpLFSqls1FTl8ou54S07UibjpkbKUOTkSZNkYWPc4p+4HlFGGOMOdG6GxXzH/TFR8JXzb6a6cW3PCLQXa+5/Xdd4Ss0wKBT86Ws7bhwq6EX3sxIW45Qw+qDgtUHheysVPS2ar4kIiQNoT0RMX4h1omLCdmQ48KbGWnL6b2f92RnuUKVl6YYKPO/7Etvs2aX80I25Bg7H+vk5YTmqOfSuw0NFbLwyYCqUJ6HwxhjzIlWDpTt5YqNhZKNhZKNhZKNhZL+Vi3K7xQDZWOhZGOhZGOhZGOhZPNJyaAT2BVnwtzrGRfezEhbjqIfePCLHrf/vivzH/RZf1Qy2AkMdgKDnUB/u2ZrqWLhkwGf/0NP7v6sJ9tLFT4Wpq4kXPlOU5tjnpcp1MrOSsXGQsnGQsnaw4KFjwfc+UlPHv16wKATaAx5Lr3b0PZEhAjPxWGMMeZMEwcTlxLmXs80bTmKfuDBL/ty/xd92V6q0MC30gD97ZqFjwfce78n28sVPhamribM3kw1aTiOkir0t2oe/rov648KQq20xjzT1xKNEuF5OIwxxpxprdGImRupNkc8oYaFj3IWPhpQ9AL7VRXK6v2Chx/2pbdZEyXC3GsZ7UmPCEcu7wRWHxQy6AR2jV9M8InwPBzGGGPOLHEwOhcxfiFGHGwsFDy5PZC8GzioqlCW7xasPyrRAI0Rz/S1VJOG4zjorNUUvcCu9oTHR8LzcBhjjDmzsrZn9FysSeYItbJ6v5DOeo0qz6ToB1YfFNLdrBGBqSsJactxHIRK0cAXfCQgPBeHMcaYMyttO1pjHgS66zU7KxV1qTwzhc3Fku5axa7GiCcb9ojjyLlIEMcXin5AA8/FYYwx5syKEyFpOHYVfaXMleeV9wJlruwSgaztcF44akOTEWnTsau3URNq5Xk4jDHGnFlxw5G1Hbt6mxV5N/DcFLobtRT9wK7mqFcfCUcpbTmmryfaGPbsWr5XSJUrzyPCGGPMmeU8uEjYpRwy5QtRIiAcDYGs5bjxX7d0+koKAtsrFct3c6pCeR4Rxhhjzqyyr+SdQNp2+EhwXjgMPkadF3Z1N2sJlfKiiUCUCnHm2BVnwsTFhAtvZTo8HbGr6Ace/KIvg+3A84owxhhzZtWVUpVKCjSGPUnD0d+ueR7OQWPIE6XCrmoQ0MAL1xj2fO9/GFW+gQbIu4HP/6ErS5/n1JXyvBzGGGPOrEEn0N2o2dUe9zRGHCI8l/ZkRGPEs6sulZ3VmrpSXjRVqCulLpVQKShfCLWysVjy0d/syOJnOXWpHAaHMcaYM2uwU7OzWqEBkqZjZDrWOHM8K+dgZCaiOeLZtblQUvQDz0MEEPZUF8rynYJHvxmwdKdg0AnsyruBx7/uy9qDglAph8VhjDHmzKoKZXu5kv52za7pGwljczHOC8+iNR4xdS3VbMgRamX9USllP/ClulC+5D37EmcOFwm7NIDyzYpB4P7Pe/LJf+zIp/+pI4ufDqgrpTHsmb6eanPMg3BoHMYYY860zcWSlXsFdaU0Rzxzr2fanvCI40DSluPca6mOzcXs2l6uWH1QUObKl7aWKlAQgcaIJ2s7nkYERmZi0qZjV3+nRmv2lPcCS3cK2VysUIXJywkzN1KNU8dhcRhjjDnTil5g6fNcNhdLNCiTVxIuvdPQkZkY54U9CTSGPRdvNfTcKxlRIvS2ah5+OJDuZs1X7axVdDcqdmVDjktvNzRKhW/TnoiYvBRr0nRogLX5QupS2Y+dlYrFTwYy2KnxsTD7SsbYXITzwmFwGGOMOfM2n5Q8/HAgnbUacXDu1Ywb32/q3OspzVEPwh8TSBqO6asJ1/9ZUy++nZENOfJu4PFvBrJ6v6Aula8KlXL3Zz0JNfhImHsj48KbGUnT8VXOC8NTEZffbejIbIwIbDwu2VgoqWtlP0KtrM0XrNwvqCulPe6Zey3TrO04DBHGGGPOPA2w9qDAeZFLb2c6PB0xcSmhPRHpxuOSreVS+puBslB2OQeNEc/QVKRj52JaYx5x0N2oWfh4IIuf5BT9wDdZup0zMtPn4q2MtOm48idNbQx7tpcrybsB54X2uGfsQqyjszFRKnQ3ah580Jf+VgBl3wadwNLtXIanIx2djZm4lDC1UPL4owFVoTyPCGOMMea3qkJZ+jwn79Qy93qmU1cS0qZj9pWUySuJDjqBulB2iYOs7Uiajl1VoWwulix8MpDV+yXlIPBtQg33ftYTDeiFN1PSluPirQZ5N2jRDzgvZEOOKBF2bS9XzH/Ql/VHBaFWDmprqeLJZ7lkba9Z23Hx7YburFaysVCigWcWYYwxxvyjUCnrj0oGO0HW5gvGLyY6fj6mMeJpj3u+ShWKXmDzScn6o1LWH5X0NmrqStlL3g3cf78nva2KqSupjsxEZEOObMixSwP0NmtW5wuW7xSy9aSkKpRnUZfK0u2ckZmImRsprTHPxbcb2lmvpegFnpX88PotjDHGnD6tUU9rIkIE8m5gc7HkIMRB1nY0hj1x5mhPeOUfaUDyXiDvBPo7NXknUBXKQflIaIw4GkOebMiRNJ2GCsm7gUGnprdZk/cCGvhGIjB9PWVXXSqbT0qqXPkmQ5MRjWGHOKEulY2FkrpUnpX88PotjDHGmL3EmfAlVQgVhFo5LC4SfAQaoK4UDRxrEcYYY8w+lAPlRQqVEipODIcxxhhjDsxhjDHGmANzGGOMMebAHMYYY4w5MIcxxhhjDsxhjDHGmANzGGOMMebAHMYYY4w5MIcxxhhjDsxhjDHGmANzGGOMMebAHMYYY4w5MIcxxhhjDuz/B1eXuN32glOtAAAAAElFTkSuQmCC";

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
      ${o.transportes.length>0?`<div class="pdf-section">
        <div class="pdf-section-header"><div class="pdf-section-dot"></div><div class="pdf-section-title">${T.secTransp}</div></div>
        <table class="pdf-table"><thead><tr><th style="width:9%">Data</th><th style="width:36%">Descrição</th><th class="num" style="width:13%">Valor Unitário ¥</th><th class="num" style="width:8%">Pessoas</th><th style="width:14%">Taxa Adicional</th><th class="num" style="width:12%">Total ¥</th><th class="num" style="width:12%">US$</th></tr></thead>
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
        <table class="pdf-table"><thead><tr><th style="width:9%">Data</th><th style="width:36%">Experiência</th><th class="num" style="width:13%">Valor Unitário ¥</th><th class="num" style="width:8%">Pessoas</th><th style="width:14%">Taxa Adicional</th><th class="num" style="width:12%">Total ¥</th><th class="num" style="width:12%">US$</th></tr></thead>
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
            <div class="pdf-resumo-row total"><span>Valor total dos serviços</span><span class="pdf-resumo-valor">¥${fmt(total)} &nbsp;·&nbsp; ${fmtUSD(total*usd)}</span></div>
            <div class="pdf-pagamento-box">
              <div class="pdf-pagamento-title">Pagamento antecipado — necessário para confirmar e reservar os serviços</div>
              <div class="pdf-resumo-row"><span>Sinal de 30% dos tours</span><span class="pdf-resumo-valor">¥${fmt(sinal)} &nbsp;·&nbsp; ${fmtUSD(sinal*usd)}</span></div>
              ${tTr>0?`<div class="pdf-resumo-row"><span>Transportes — valor integral</span><span class="pdf-resumo-valor">¥${fmt(tTr)} &nbsp;·&nbsp; ${fmtUSD(tTr*usd)}</span></div>`:''}
              ${tEx>0?`<div class="pdf-resumo-row"><span>Experiências — valor integral</span><span class="pdf-resumo-valor">¥${fmt(tEx)} &nbsp;·&nbsp; ${fmtUSD(tEx*usd)}</span></div>`:''}
              ${tItens>0?`<div class="pdf-resumo-row"><span>Itens adicionais — valor integral</span><span class="pdf-resumo-valor">¥${fmt(tItens)} &nbsp;·&nbsp; ${fmtUSD(tItens*usd)}</span></div>`:''}
              <div class="pdf-resumo-row total-antecipado"><span>Total a pagar com antecedência</span><span class="pdf-resumo-valor">¥${fmt(antecipado)} &nbsp;·&nbsp; ${fmtUSD(antecipado*usd)}</span></div>
            </div>
            <div class="pdf-resumo-row pagamento-saldo"><span>Saldo dos tours (70%) — a pagar na semana da viagem</span><span class="pdf-resumo-valor">¥${fmt(saldo)} &nbsp;·&nbsp; ${fmtUSD(saldo*usd)}</span></div>
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
function fmtDataBR(str) { if(!str) return '—'; const clean = str.includes('T') ? str.split('T')[0] : str; const parts = clean.split('-'); if(parts.length < 3) return str; const [y,m,d]=parts; return `${d}/${m}/${y}`; }
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
      <button type="button" class="btn-sugestao-menu" onclick="toggleSugestoesDropdown(${id}, '${tipo}', event)" style="display:inline-flex; align-items:center; gap:3.5px;"><svg class="v-icon" style="stroke:var(--ink-mid); width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-file"></use></svg>Biblioteca</button>
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
        // Guarda o ID imutável devolvido pelo servidor (vínculo que nunca quebra)
        try {
          const j = await res.json();
          if (j && j.id) {
            novoRoteiroObj.id = j.id;
            novoRoteiroObj.nome = j.nome || nomeRoteiro;
            state.orcamento.roteiroId = j.id;
          }
        } catch (e) { /* segue */ }
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
        <button class="btn-icon" onclick="editarRota(${r.id})" title="Editar"><svg class="v-icon no-margin"><use href="#icon-edit"></use></svg></button>
        <button class="btn-icon" onclick="deletarRota(${r.id})" title="Excluir"><svg class="v-icon no-margin" style="stroke:#c00;"><use href="#icon-trash"></use></svg></button>
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
          <input type="text" id="modalRotSearch" placeholder="Buscar..." oninput="window.renderModalRotasUI()" style="width:250px; padding:4px 8px; font-size:13px; border:1px solid #ccc; border-radius:4px;">
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

// ── UNDO HISTORY (CTRL+Z) FOR COTACAO ─────────────────────────────────────────
window.cotacaoUndoStack = [];
window.registrarEstadoCotacao = function(orcState) {
  if (!orcState) return;
  // Deep clone do estado atual
  const strState = JSON.stringify(orcState);
  // Evita duplicar o último estado salvo
  if (window.cotacaoUndoStack.length > 0 && window.cotacaoUndoStack[window.cotacaoUndoStack.length - 1] === strState) {
    return;
  }
  window.cotacaoUndoStack.push(strState);
  if (window.cotacaoUndoStack.length > 30) {
    window.cotacaoUndoStack.shift();
  }
};

window.desfazerAcaoCotacao = function() {
  if (!window.cotacaoUndoStack || window.cotacaoUndoStack.length <= 1) {
    showToast('Nada para desfazer!');
    return;
  }
  // Remove o estado atual
  window.cotacaoUndoStack.pop();
  // Pega o estado anterior
  const estadoAnteriorStr = window.cotacaoUndoStack[window.cotacaoUndoStack.length - 1];
  const estadoAnterior = JSON.parse(estadoAnteriorStr);
  
  state.orcamento = estadoAnterior;
  if (typeof currentEditingEstadias !== 'undefined') {
    currentEditingEstadias = JSON.parse(JSON.stringify(estadoAnterior.estadias || []));
  }
  
  // Atualiza no banco local
  const idx = state.orcamentosDB.findIndex(o => o.id === estadoAnterior.id);
  if (idx > -1) state.orcamentosDB[idx] = estadoAnterior;
  
  // Atualiza a interface do formulário
  preencherInterfaceCotacao(estadoAnterior);
  
  // Salva na nuvem
  saveOrcamentoToCloud(estadoAnterior);
  renderListaOrcamentos();
  
  showToast('Desfeito! ↩');
};

function preencherInterfaceCotacao(orc) {
  document.getElementById('orcNome').value = orc.nome || '';
  const notionCli = orc.notionClienteId && typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === orc.notionClienteId) : null;
  document.getElementById('clienteNome').value = notionCli ? notionCli.nome : (orc.cliente?.nome || '');
  document.getElementById('clienteAdultos').value = notionCli ? notionCli.adultos : (orc.cliente?.adultos || '2');
  document.getElementById('clienteCriancas').value = notionCli ? notionCli.criancas : (orc.cliente?.criancas || '0');
  document.getElementById('clienteDataOrcamento').value = orc.cliente?.dataOrcamento || today();
  
  if (orc.valoresTour) {
    if(document.getElementById('baseTour4h')) document.getElementById('baseTour4h').value = orc.valoresTour['4h'] || 45000;
    if(document.getElementById('baseTour6h')) document.getElementById('baseTour6h').value = orc.valoresTour['6h'] || 65000;
    if(document.getElementById('baseTour8h')) document.getElementById('baseTour8h').value = orc.valoresTour['8h'] || 85000;
    if(document.getElementById('baseTour10h')) document.getElementById('baseTour10h').value = orc.valoresTour['10h'] || 105000;
    if(document.getElementById('baseTour12h')) document.getElementById('baseTour12h').value = orc.valoresTour['12h'] || 125000;
  }
  
  if (document.getElementById('orcRoteiroVinculado')) {
    document.getElementById('orcRoteiroVinculado').value = orc.orcRoteiroVinculado || orc.roteiroVinculado || '';
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
  
  if (typeof preencherTextosForm === 'function') preencherTextosForm(orc.textos || {});
  
  renderEstadiasReadOnlyForm();
  renderToursForm();
  renderTransportesForm();
  renderExperienciasForm();
  renderItensAdicionaisForm();
  updateResumo();
}

// ── LIXEIRA DO SISTEMA (FRONTEND INTEGRATION) ─────────────────────────────────
window.carregarLixeira = async function() {
  const container = document.getElementById('lixeiraListContainer');
  if (!container) return;
  
  container.innerHTML = '<div style="color:var(--ink-lt); padding:10px; font-size:13px; text-align:center;">Carregando lixeira...</div>';
  try {
    const res = await fetch('/api/lixeira?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Falha na API da Lixeira');
    const data = await res.json();
    
    const orcs = data.orcamentos || [];
    const rots = data.roteiros || [];
    
    if (orcs.length === 0 && rots.length === 0) {
      container.innerHTML = '<div style="color:var(--ink-lt); padding:20px; text-align:center; font-size:13px;">A lixeira está vazia.</div>';
      return;
    }
    
    let html = `
      <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:left;">
        <thead>
          <tr style="border-bottom: 2px solid var(--border); color: var(--ink-lt); font-weight:600;">
            <th style="padding:8px;">Tipo</th>
            <th style="padding:8px;">Nome / Item</th>
            <th style="padding:8px;">Cliente</th>
            <th style="padding:8px;">Data Exclusão</th>
            <th style="padding:8px; text-align:right;">Ações</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    orcs.forEach(o => {
      const dataDel = o.deletadoEm ? new Date(o.deletadoEm).toLocaleString('pt-BR') : '—';
      html += `
        <tr style="border-bottom: 1px solid var(--border);">
          <td style="padding:8px;"><span style="background:rgba(107,31,42,0.08); color:var(--crimson); padding:2px 6px; border-radius:4px; font-weight:600; font-size:10px;">Cotação</span></td>
          <td style="padding:8px; font-weight:500;">${o.nome || 'Sem título'}</td>
          <td style="padding:8px;">${o.cliente?.nome || '—'}</td>
          <td style="padding:8px; color:var(--ink-lt);">${dataDel}</td>
          <td style="padding:8px; text-align:right;">
            <button class="btn-secondary" onclick="window.restaurarItemLixeira('cotacao', '${o.id}')" style="padding:4px 8px; font-size:11px; margin-right:4px;">Restaurar</button>
            <button class="btn-secondary" onclick="window.excluirItemDefinitivoLixeira('cotacao', '${o.id}')" style="padding:4px 8px; font-size:11px; color:#c00; border-color:#fee;">Definitivo</button>
          </td>
        </tr>
      `;
    });
    
    rots.forEach(r => {
      const dataDel = r.deletadoEm ? new Date(r.deletadoEm).toLocaleString('pt-BR') : '—';
      html += `
        <tr style="border-bottom: 1px solid var(--border);">
          <td style="padding:8px;"><span style="background:rgba(196,163,90,0.08); color:var(--gold-dk); padding:2px 6px; border-radius:4px; font-weight:600; font-size:10px;">Roteiro</span></td>
          <td style="padding:8px; font-weight:500;">${r.nome}</td>
          <td style="padding:8px;">${r.cliente?.nome || '—'}</td>
          <td style="padding:8px; color:var(--ink-lt);">${dataDel}</td>
          <td style="padding:8px; text-align:right;">
            <button class="btn-secondary" onclick="window.restaurarItemLixeira('roteiro', '${encodeURIComponent(r.nome)}')" style="padding:4px 8px; font-size:11px; margin-right:4px;">Restaurar</button>
            <button class="btn-secondary" onclick="window.excluirItemDefinitivoLixeira('roteiro', '${encodeURIComponent(r.nome)}')" style="padding:4px 8px; font-size:11px; color:#c00; border-color:#fee;">Definitivo</button>
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch(e) {
    console.error(e);
    container.innerHTML = '<div style="color:#c00; padding:10px; font-size:13px; text-align:center;">Erro ao carregar a lixeira.</div>';
  }
};

window.restaurarItemLixeira = async function(tipo, key) {
  try {
    const url = tipo === 'cotacao' ? `/api/orcamentos/${key}/restaurar` : `/api/roteiros/${key}/restaurar`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) throw new Error('Erro ao restaurar');
    showToast('Item restaurado com sucesso!');
    
    // Atualiza a lixeira
    window.carregarLixeira();
    
    // Atualiza os dados ativos no frontend
    if (tipo === 'cotacao') {
      const resList = await fetch('/api/orcamentos?t=' + Date.now(), { cache: 'no-store' });
      if (resList.ok) {
        state.orcamentosDB = await resList.json();
        if (typeof renderListaOrcamentos === 'function') {
          renderListaOrcamentos();
        }
        if (window.clienteAtualVisualizado && typeof notionClients !== 'undefined') {
          const cli = notionClients.find(x => x.id === window.clienteAtualVisualizado);
          if (cli && typeof renderAbaCotacoes === 'function') {
            renderAbaCotacoes(cli);
          }
        }
      }
    } else {
      if (typeof window.carregarRoteirosDoServidor === 'function') {
        await window.carregarRoteirosDoServidor();
        if (window.clienteAtualVisualizado && typeof notionClients !== 'undefined') {
          const cli = notionClients.find(x => x.id === window.clienteAtualVisualizado);
          if (cli && typeof renderAbaRoteiros === 'function') {
            renderAbaRoteiros(cli);
          }
        }
      }
    }
  } catch(err) {
    console.error(err);
    alert('Erro ao restaurar o item.');
  }
};

window.excluirItemDefinitivoLixeira = async function(tipo, key) {
  if (!confirm('Tem certeza de que deseja excluir permanentemente este item? Esta ação é irreversível e apagará os dados na nuvem de vez!')) {
    return;
  }
  try {
    const url = tipo === 'cotacao' ? `/api/orcamentos/${key}/definitivo` : `/api/roteiros/${key}/definitivo`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erro ao excluir permanentemente');
    showToast('Item apagado definitivamente!');
    window.carregarLixeira();
  } catch(err) {
    console.error(err);
    alert('Erro ao apagar o item da lixeira.');
  }
};

// Captura de atalho Ctrl+Z global
window.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    const isOrcamentoVisible = document.getElementById('orcamentosEditorWrapper')?.style.display === 'block';
    const isRoteiroVisible = document.getElementById('roteiroEditContainer')?.style.display === 'block';
    
    if (isOrcamentoVisible) {
      e.preventDefault();
      if (typeof window.desfazerAcaoCotacao === 'function') {
        window.desfazerAcaoCotacao();
      }
    } else if (isRoteiroVisible) {
      e.preventDefault();
      if (typeof window.desfazerAcaoRoteiro === 'function') {
        window.desfazerAcaoRoteiro();
      }
    }
  }
});

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
      
      const btnImport = document.getElementById('btnImportNotion');
      if (btnImport) btnImport.style.display = 'none';

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
let currentEditingVouchers = [];
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
  const btnOrdenar = document.getElementById('btnOrdenarEstadias');
  if(btnOrdenar) btnOrdenar.addEventListener('click', () => {
    window.ordenarEstadiasPorData();
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
    const paneList = document.querySelector('#page-clientes .pane-list');
    if (paneList) paneList.style.display = 'flex';
    
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

window.obterCoresStatus = function(status) {
  const s = (status || 'Início/call de dúvidas').toLowerCase();
  if (s.includes('dúvida') || s.includes('duvida')) return { color: '#787878', bg: 'rgba(120, 120, 120, 0.08)', border: 'rgba(120, 120, 120, 0.2)' };
  if (s.includes('negociação') || s.includes('negociacao')) {
    if (s.includes('aprovada')) return { color: '#0284c7', bg: 'rgba(2, 132, 199, 0.08)', border: 'rgba(2, 132, 199, 0.2)' };
    return { color: '#64748b', bg: 'rgba(100, 116, 139, 0.08)', border: 'rgba(100, 116, 139, 0.2)' };
  }
  if (s.includes('rascunho')) return { color: '#db2777', bg: 'rgba(219, 39, 119, 0.08)', border: 'rgba(219, 39, 119, 0.2)' };
  if (s.includes('versão final') || s.includes('versao final')) return { color: '#ea580c', bg: 'rgba(234, 88, 12, 0.08)', border: 'rgba(234, 88, 12, 0.2)' };
  if (s.includes('viagem')) return { color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.08)', border: 'rgba(124, 58, 237, 0.2)' };
  if (s.includes('cancelado')) return { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.08)', border: 'rgba(220, 38, 38, 0.2)' };
  if (s.includes('finalizados') || s.includes('finalizado')) return { color: '#16a34a', bg: 'rgba(22, 163, 74, 0.08)', border: 'rgba(22, 163, 74, 0.2)' };
  if (s.includes('pós') || s.includes('pos')) return { color: '#b45309', bg: 'rgba(180, 83, 9, 0.08)', border: 'rgba(180, 83, 9, 0.2)' };
  
  return { color: '#9c8248', bg: 'rgba(196, 163, 90, 0.08)', border: 'rgba(196, 163, 90, 0.2)' };
};

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
    const coresStatus = window.obterCoresStatus(c.status);
    const isSelected = window.clienteAtualVisualizado === c.id ? 'selected' : '';

    const card = document.createElement('div');
    card.className = 'list-card ' + isSelected;
    card.dataset.id = c.id;
    card.onclick = () => abrirDetalhesCliente(c.id);
    card.onmouseenter = () => hoverCliente(c.id);
    
    let datasViagem = 'Sem data';
    if (c.dataInicio && c.dataFim) {
      datasViagem = `${fmtDataBR(c.dataInicio)} a ${fmtDataBR(c.dataFim)}`;
    } else if (c.dataInicio) {
      datasViagem = `${fmtDataBR(c.dataInicio)}`;
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
        passageiros = `${passageiros}`;
      }
    }
    
    if (!passageiros) {
      let ad = parseInt(c.adultos) || 0;
      let cr = parseInt(c.criancas) || 0;
      if (ad > 0 || cr > 0) {
        const parts = [];
        if (ad > 0) parts.push(`${ad} Ad`);
        if (cr > 0) parts.push(`${cr} Cr`);
        passageiros = `${parts.join(', ')}`;
      } else {
        passageiros = 'Sem passageiros';
      }
    }

    card.innerHTML = `
      <div class="list-card-title-row" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
        <div class="list-card-title" style="color:var(--crimson); font-weight: 600; margin-bottom: 0;">${c.nome}</div>
        <button class="btn-card-edit-minimalist" onclick="event.stopPropagation(); editarClienteCard('${c.id}')" title="Editar">
          <svg class="v-icon no-margin"><use href="#icon-edit"></use></svg>
        </button>
      </div>
      <div class="list-card-subtitle" style="margin-top: 4px; font-size: 11px; color: var(--ink-lt); display: flex; gap: 8px; flex-wrap: wrap;">
        <span>${datasViagem}</span>
        <span>·</span>
        <span>${passageiros}</span>
      </div>
      <div class="list-card-meta" style="margin-top: 8px; font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color:${coresStatus.color}; font-weight:600; background: ${coresStatus.bg}; border: 1px solid ${coresStatus.border}; padding: 2px 6px; border-radius: 4px;">${c.status || 'Novo'}</span>
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
  window.mostrarDetailMobile('page-clientes');

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
      currentEditingVouchers = d.vouchers || [];
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

      // Perfil & Preferencias (camada nova): injeta a secao e preenche com o que esta salvo
      try { if (window.HeianPerfil) window.HeianPerfil.carregar(d.preferencias || {}); } catch (e) {}

      formatHubButtons();
    }).catch(e => { 
      console.error(e); 
      currentEditingEstadias = []; 
      currentEditingViajantes = [];
      currentEditingVouchers = [];
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
    currentEditingVouchers = [];
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
    if(c) {
      window.clienteAtualVisualizado = id;
      if (typeof navToPage === 'function') navToPage('clientes');
      if (typeof renderClientesTabela === 'function') renderClientesTabela();
      abrirClienteModal(c);
    }
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

    const urlUnificada = currentEditingClienteId ? `/api/clientes/${currentEditingClienteId}` : '/api/clientes';
    const methodUnificado = currentEditingClienteId ? 'PATCH' : 'POST';

    // Perfil & Preferencias (camada nova): inclui as preferencias e as colunas no salvar
    const _perfil = (window.HeianPerfil ? window.HeianPerfil.coletar() : null);
    if (_perfil && _perfil.colunas) {
      if (_perfil.colunas.profissoes !== undefined) payload.profissoes = _perfil.colunas.profissoes;
      if (_perfil.colunas.ocasiaoEspecial !== undefined) payload.ocasiaoEspecial = _perfil.colunas.ocasiaoEspecial;
      if (_perfil.colunas.necessidadesEspeciais !== undefined) payload.necessidadesEspeciais = _perfil.colunas.necessidadesEspeciais;
      if (_perfil.colunas.observacoes !== undefined) payload.observacoes = _perfil.colunas.observacoes;
    }

    const res = await fetch(urlUnificada, {
      method: methodUnificado,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notionPayload: payload,
        localPayload: {
          nome: payload.nome,
          estadias: currentEditingEstadias,
          viajantes: currentEditingViajantes,
          emails: currentEditingEmails,
          fotoPerfil: editFotoPerfilBase64,
          vouchers: currentEditingVouchers,
          preferencias: (_perfil ? _perfil.preferencias : undefined)
        }
      })
    });
    
    if (!res.ok) {
      const errInfo = await res.json();
      throw new Error(errInfo.message || 'Falha ao salvar dados unificados do cliente');
    }

    const data = await res.json();
    const cliId = currentEditingClienteId || data.id;
    
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
        
        if (resp.status === 409) {
          const errData = await resp.json();
          alert(errData.message || 'Já existe um roteiro com este nome associado a outro cliente. Por favor, escolha outro nome.');
          return;
        }

        if (resp.ok) {
          // Guarda o ID imutável devolvido pelo servidor
          try {
            const j = await resp.json();
            if (j && j.id) {
              novoRoteiroObj.id = j.id;
              novoRoteiroObj.nome = j.nome || nomeRoteiro;
              state.orcamento.roteiroId = j.id;
            }
          } catch (e) { /* segue */ }
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
    btnToggle.innerHTML = roteiroInfo ? 'Mudar para Cotação' : 'Mudar para Roteiro';
    
    btnToggle.onclick = function() {
      if (this.dataset.view === 'roteiro') {
        this.dataset.view = 'cotacao';
        this.innerHTML = 'Mudar para Roteiro';
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
        this.innerHTML = 'Mudar para Cotação';
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

// --- MOBILE MASTER-DETAIL TOGGLE ---
window.mostrarDetailMobile = function(pageId) {
  if (window.innerWidth <= 768) {
    const layout = document.getElementById(pageId);
    if (layout) {
      layout.classList.add('show-detail');
      // Rolar painel de detalhes para o topo
      const paneContent = layout.querySelector('.pane-content');
      if (paneContent) paneContent.scrollTop = 0;
    }
  }
};

window.fecharDetailMobile = function(pageId) {
  const layout = document.getElementById(pageId);
  if (layout) {
    layout.classList.remove('show-detail');
  }
};


window.handleAcaoClienteCotacao = async function() {
  if (state.orcamento && state.orcamento.notionClienteId) {
    editarClienteNotion(state.orcamento.notionClienteId);
  } else {
    // Modo "Salvar Cliente no Notion"
    const nome = document.getElementById('clienteNome').value.trim();
    if (!nome) return alert('Preencha pelo menos o Nome do Cliente para salvar no Notion.');
    
    const btn = document.getElementById('btnEditarClienteCotacao');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = 'Salvando...';
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

      btn.innerHTML = '<svg class="v-icon" style="margin-right:2px;"><use href="#icon-user"></use></svg> Editar Cliente';
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
  const orc = state.orcamentosDB.find(o => String(o.id) === String(id));
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

  // Ocultar a barra lateral de clientes para focar nos detalhes do cliente selecionado APENAS se não for hover
  if (!isHover) {
    window.mostrarDetailMobile('page-clientes');
  }
  
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
    renderPreviewCliente(c, estadias, viajantes, emails, d.fotoPerfil || "", d.vouchers || []);
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
    renderPreviewCliente(c, estadias, [], [], "", []);
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

window.calcularEstagioCliente = function(cliente, estadias = [], viajantes = [], vouchers = []) {
  if (!Array.isArray(estadias)) estadias = [];
  if (!Array.isArray(viajantes)) viajantes = [];
  if (!Array.isArray(vouchers)) vouchers = [];
  const etapas = [
    { id: 'cotacao', label: 'Cotação', status: 'pending', pendencias: [] },
    { id: 'passageiros', label: 'Passageiros', status: 'pending', pendencias: [] },
    { id: 'hoteis', label: 'Hotéis', status: 'pending', pendencias: [] },
    { id: 'emissoes', label: 'Emissões', status: 'pending', pendencias: [] },
    { id: 'pronto', label: 'Viagem', status: 'pending', pendencias: [] }
  ];

  // 1. COTAÇÃO
  const statusCli = (cliente.status || '').toLowerCase().trim();
  const isCotacao = statusCli === 'cotação' || statusCli === 'cotacao' || statusCli === 'leads' || statusCli === 'novo' || statusCli === '';
  if (isCotacao) {
    etapas[0].status = 'active';
    etapas[0].pendencias.push({ texto: 'Aprovar orçamento e alterar o status do cliente (atualmente em Cotação).', acao: 'editar', labelAcao: 'Alterar Status' });
    return { etapaAtiva: 'cotacao', etapas };
  } else {
    etapas[0].status = 'completed';
  }

  // 2. PASSAGEIROS
  const viajArr = Array.isArray(viajantes) ? viajantes : [];
  const viajantesPendentes = viajArr.filter(v => !v.passaporte || v.passaporte.trim().length < 5);
  if (viajArr.length === 0) {
    etapas[1].status = 'active';
    etapas[1].pendencias.push({ texto: 'Nenhum viajante cadastrado para esta viagem.', acao: 'dados', labelAcao: 'Adicionar Viajantes' });
    return { etapaAtiva: 'passageiros', etapas };
  } else if (viajantesPendentes.length > 0) {
    etapas[1].status = 'active';
    viajantesPendentes.forEach(vp => {
      etapas[1].pendencias.push({ texto: `Falta cadastrar passaporte para o viajante: ${vp.nome || 'Sem Nome'}.`, acao: 'dados', labelAcao: 'Preencher' });
    });
    return { etapaAtiva: 'passageiros', etapas };
  } else {
    etapas[1].status = 'completed';
  }

  // 3. HOTÉIS (ESTADIAS)
  if (!cliente.dataInicio || !cliente.dataFim) {
    etapas[2].status = 'active';
    etapas[2].pendencias.push({ texto: 'Definir as datas de início e fim da viagem no cadastro do cliente.', acao: 'editar', labelAcao: 'Definir Datas' });
    return { etapaAtiva: 'hoteis', etapas };
  }

  const dInicio = new Date(cliente.dataInicio);
  const dFim = new Date(cliente.dataFim);
  const noitesViagem = Math.ceil((dFim - dInicio) / (1000 * 60 * 60 * 24));

  // Calcular noites cobertas pelas estadias
  let noitesCobertas = 0;
  estadias.forEach(est => {
    if (est.dataInicio && est.dataFim) {
      const estInicio = new Date(est.dataInicio);
      const estFim = new Date(est.dataFim);
      const noites = Math.ceil((estFim - estInicio) / (1000 * 60 * 60 * 24));
      if (noites > 0) noitesCobertas += noites;
    }
  });

  if (noitesCobertas < noitesViagem) {
    etapas[2].status = 'active';
    const noitesFaltantes = noitesViagem - noitesCobertas;
    etapas[2].pendencias.push({ 
      texto: `Faltam cobrir ${noitesFaltantes} noite(s) de hotel na viagem (Cobertura: ${noitesCobertas} de ${noitesViagem} noites).`, 
      acao: 'dados', 
      labelAcao: 'Adicionar Hotel' 
    });
    return { etapaAtiva: 'hoteis', etapas };
  } else {
    etapas[2].status = 'completed';
  }

  // 4. EMISSÕES (TICKETS E INGRESSOS)
  const clienteNome = cliente.nome || '';
  const roteiro = typeof window.dbRotas !== 'undefined' ? Object.values(window.dbRotas).find(rot => {
    return rot.notionClienteId === cliente.id || (rot.cliente && rot.cliente.nome === clienteNome);
  }) : null;

  if (!roteiro) {
    etapas[3].status = 'active';
    etapas[3].pendencias.push({ texto: 'Roteiro do cliente ainda não foi criado no montador de roteiros.', acao: 'roteiros', labelAcao: 'Criar Roteiro' });
    return { etapaAtiva: 'emissoes', etapas };
  }

  let pendenciasEmissao = [];
  if (roteiro && roteiro.dias) {
    roteiro.dias.forEach((dia, dIdx) => {
      const diaLabel = `Dia ${dIdx + 1} (${dia.cidade || ''})`;
      if (dia.elementos) {
        dia.elementos.forEach(el => {
          if (el.tipo === 'transporte') {
            const emitido = el.compradoHeian === true;
            const temVoucher = vouchers.some(v => v.atracaoNome && v.atracaoNome.startsWith('transporte:') && v.atracaoNome.includes(el.tipoTransporte));
            if (!emitido && !temVoucher) {
              const desc = `${el.tipoTransporte || 'Transporte'}${el.cidadeOrigem && el.cidadeDestino ? ` (${el.cidadeOrigem} ➔ ${el.cidadeDestino})` : ''}`;
              pendenciasEmissao.push({ texto: `Pendente emitir ticket de Transporte: ${desc} (${diaLabel}).`, acao: 'vouchers', labelAcao: 'Anexar Voucher' });
            }
          } else if (el.tipo === 'experiencia') {
            const emitido = el.compradoHeian === true;
            const temVoucher = vouchers.some(v => v.atracaoNome && v.atracaoNome.startsWith('experiencia:') && v.atracaoNome.includes(el.nomeExp));
            if (!emitido && !temVoucher) {
              pendenciasEmissao.push({ texto: `Pendente emitir voucher de Experiência: ${el.nomeExp} (${diaLabel}).`, acao: 'vouchers', labelAcao: 'Anexar Voucher' });
            }
          }
        });
      }
    });
  }

  if (pendenciasEmissao.length > 0) {
    etapas[3].status = 'active';
    etapas[3].pendencias = pendenciasEmissao;
    return { etapaAtiva: 'emissoes', etapas };
  } else {
    etapas[3].status = 'completed';
  }

  // 5. VIAGEM PRONTA
  etapas[4].status = 'active';
  return { etapaAtiva: 'pronto', etapas };
};

window.renderPreviewCliente = function(cliente, estadias = [], viajantes = [], emails = [], fotoPerfil = "", vouchers = []) {
  if (!Array.isArray(estadias)) estadias = [];
  if (!Array.isArray(viajantes)) viajantes = [];
  if (!Array.isArray(emails)) emails = [];
  if (!Array.isArray(vouchers)) vouchers = [];
  const container = document.getElementById('clientesPreviewContainer');
  if (!container) return;

  const coresStatus = window.obterCoresStatus(cliente.status);

  // Serializar coleções locais para a alternância rápida de abas
  const estadiasStr = encodeURIComponent(JSON.stringify(estadias));
  const viajantesStr = encodeURIComponent(JSON.stringify(viajantes));
  const emailsStr = encodeURIComponent(JSON.stringify(emails));

  // Calcular estágios dinâmicos do cliente
  const { etapaAtiva, etapas } = window.calcularEstagioCliente(cliente, estadias, viajantes, vouchers);
  window.currentClientProcessStages = etapas;

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
          <span class="client-status-badge" style="color: ${coresStatus.color}; background: ${coresStatus.bg}; border: 1px solid ${coresStatus.border}; font-weight: 600; padding: 4px 10px; border-radius: 12px; font-size: 11px; text-transform: uppercase;">
            ${cliente.status || 'Início/call de dúvidas'}
          </span>
        </div>
      </div>
      <div class="client-actions-bar">
        <button class="btn-secondary" onclick="window.location.href='mailto:${emails && emails[0] ? emails[0].email : (cliente.email || '')}'" title="Enviar E-mail" style="display:inline-flex; align-items:center; gap:4px; ${!(emails && emails[0] || cliente.email) ? 'opacity:0.5; cursor:not-allowed;' : ''}" ${!(emails && emails[0] || cliente.email) ? 'disabled' : ''}>
          <svg class="v-icon" style="stroke:var(--ink-mid); width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-mail"></use></svg> E-mail
        </button>
        <button class="btn-secondary" onclick="if('${cliente.telefone || ''}') window.open('https://wa.me/${(cliente.telefone || '').replace(/\D/g,'')}', '_blank');" title="WhatsApp" style="display:inline-flex; align-items:center; gap:4px; ${!cliente.telefone ? 'opacity:0.5; cursor:not-allowed;' : ''}" ${!cliente.telefone ? 'disabled' : ''}>
          <svg class="v-icon" style="stroke:var(--ink-mid); width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-message-square"></use></svg> WhatsApp
        </button>
        <button class="btn-secondary" onclick="if(typeof copiarLinkClienteFromId === 'function') copiarLinkClienteFromId('${cliente.id}');" title="Copiar Link da Área do Cliente" style="display:inline-flex; align-items:center; gap:4px;">
          <svg class="v-icon" style="stroke:var(--ink-mid); width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-link"></use></svg> Link do Cliente
        </button>
        <button class="btn-secondary" onclick="navToPage('dashboard'); if(typeof selecionarClienteDashboard === 'function') selecionarClienteDashboard('${cliente.id}'); closeClienteModal();" title="Painel Financeiro do Cliente" style="display:inline-flex; align-items:center; gap:4px;">
          <svg class="v-icon" style="stroke:var(--ink-mid); width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-dollar-sign"></use></svg> Financeiro
        </button>
        <button class="btn-primary" onclick="editarClienteCard('${cliente.id}')" style="display:inline-flex; align-items:center; gap:4px;">
          <svg class="v-icon" style="margin-right:0;"><use href="#icon-user"></use></svg> Editar Cliente
        </button>
      </div>
    </div>

    <!-- Barra de Navegação de Abas -->
    <div class="tabs-client-nav">
      <button class="tab-client-btn active" data-tab="resumo" onclick="window.switchClientTab('resumo', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')" style="display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="stroke:var(--ink-mid); width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-file"></use></svg> Resumo de Pendências</button>
      <button class="tab-client-btn" data-tab="dados" onclick="window.switchClientTab('dados', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')">Dados do Cliente</button>
      <button class="tab-client-btn" data-tab="roteiros" onclick="window.switchClientTab('roteiros', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')">Roteiros</button>
      <button class="tab-client-btn" data-tab="cotacoes" onclick="window.switchClientTab('cotacoes', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')">Cotações</button>
      <button class="tab-client-btn" data-tab="vouchers" onclick="window.switchClientTab('vouchers', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')" style="display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="stroke:var(--ink-mid); width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-ticket"></use></svg> Vouchers & Ingressos</button>
    </div>

    <!-- Conteúdo da Aba Ativa -->
    <div id="clientTabContent" class="tab-client-content"></div>
  `;

  // Renderizar a primeira aba por padrão (Resumo de Pendências)
  window.switchClientTab('resumo', cliente.id, estadiasStr, viajantesStr, emailsStr);
};

window.renderAbaResumoCliente = async function(cliente, estadias = [], viajantes = []) {
  const contentDiv = document.getElementById('clientTabContent');
  if (!contentDiv) return;

  contentDiv.innerHTML = `
    <div style="display:flex; justify-content:center; align-items:center; padding: 40px; gap: 8px;">
      <div class="spinner-mini" style="border: 2px solid rgba(107,31,42,0.1); border-top-color: var(--crimson); width: 16px; height: 16px; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <strong style="color:var(--crimson); font-size:13px; font-weight:500;">Carregando resumo de pendências...</strong>
    </div>
    <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
  `;

  let vouchers = [];
  try {
    const localRes = await fetch(`/api/clientes/local/${cliente.id}?t=${Date.now()}`);
    const localData = await localRes.json();
    vouchers = localData.vouchers || [];
    window.currentEditingVouchers = vouchers;
  } catch (e) {
    console.error("Erro ao carregar vouchers para resumo:", e);
  }

  // Se o usuário já trocou de aba enquanto os dados carregavam, não sobrescreve
  if (window.__activeClientTab && window.__activeClientTab !== 'resumo') return;

  const estadiasStr = encodeURIComponent(JSON.stringify(estadias));
  const viajantesStr = encodeURIComponent(JSON.stringify(viajantes));
  const emailsStr = encodeURIComponent(JSON.stringify(cliente.emails || []));

  // --- SEÇÃO 1: VIAJANTES E DADOS GERAIS ---
  const pendenciasDados = [];
  if (!cliente.email || cliente.email.trim() === '') {
    pendenciasDados.push({
      texto: "E-mail de contato principal não cadastrado.",
      tipo: "warning",
      labelAcao: "Preencher",
      onclick: `editarClienteCard('${cliente.id}')`
    });
  }
  if (!cliente.telefone || cliente.telefone.trim() === '') {
    pendenciasDados.push({
      texto: "Telefone de contato principal não cadastrado.",
      tipo: "warning",
      labelAcao: "Preencher",
      onclick: `editarClienteCard('${cliente.id}')`
    });
  }

  const statusCli = (cliente.status || '').toLowerCase().trim();
  const isCotacao = statusCli === 'cotação' || statusCli === 'cotacao' || statusCli === 'leads' || statusCli === 'novo' || statusCli === '';
  if (isCotacao) {
    pendenciasDados.push({
      texto: `Orçamento pendente de aprovação (Status: ${cliente.status || 'Novo'}).`,
      tipo: "warning",
      labelAcao: "Alterar",
      onclick: `editarClienteCard('${cliente.id}')`
    });
  }

  if (!viajantes || viajantes.length === 0) {
    pendenciasDados.push({
      texto: "Nenhum viajante cadastrado para esta viagem.",
      tipo: "error",
      labelAcao: "Adicionar",
      onclick: `window.switchClientTab('dados', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
    });
  } else {
    viajantes.forEach(v => {
      if (!v.passaporte || v.passaporte.trim().length < 5) {
        pendenciasDados.push({
          texto: `Falta passaporte para o viajante: ${v.nome || 'Sem Nome'}.`,
          tipo: "error",
          labelAcao: "Preencher",
          onclick: `window.switchClientTab('dados', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
        });
      }
    });
  }

  // --- SEÇÃO 2: HOSPEDAGEM (ESTADIAS) ---
  const pendenciasHospedagem = [];
  if (!cliente.dataInicio || !cliente.dataFim) {
    pendenciasHospedagem.push({
      texto: "Definir as datas de início e fim da viagem no cadastro do cliente.",
      tipo: "error",
      labelAcao: "Definir Datas",
      onclick: `editarClienteCard('${cliente.id}')`
    });
  } else {
    const dInicio = new Date(cliente.dataInicio);
    const dFim = new Date(cliente.dataFim);
    const noitesViagem = Math.ceil((dFim - dInicio) / (1000 * 60 * 60 * 24));

    let noitesCobertas = 0;
    let temEstadiaSemHotel = false;
    let temEstadiaSemCidade = false;
    let temEstadiaSemData = false;

    estadias.forEach(est => {
      if (!est.hotelNome || est.hotelNome.trim() === '') {
        temEstadiaSemHotel = true;
      }
      if (!est.cidade || est.cidade.trim() === '') {
        temEstadiaSemCidade = true;
      }
      if (est.dataInicio && est.dataFim) {
        const estInicio = new Date(est.dataInicio);
        const estFim = new Date(est.dataFim);
        const noites = Math.ceil((estFim - estInicio) / (1000 * 60 * 60 * 24));
        if (noites > 0) noitesCobertas += noites;
      } else {
        temEstadiaSemData = true;
      }
    });

    if (temEstadiaSemHotel) {
      pendenciasHospedagem.push({
        texto: "Existem estadias adicionadas sem nome de hotel definido.",
        tipo: "error",
        labelAcao: "Gerenciar",
        onclick: `window.switchClientTab('dados', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
      });
    }
    if (temEstadiaSemCidade) {
      pendenciasHospedagem.push({
        texto: "Existem estadias cadastradas sem cidade definida.",
        tipo: "error",
        labelAcao: "Gerenciar",
        onclick: `window.switchClientTab('dados', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
      });
    }
    if (temEstadiaSemData) {
      pendenciasHospedagem.push({
        texto: "Uma ou mais estadias cadastradas estão sem data definida.",
        tipo: "error",
        labelAcao: "Gerenciar",
        onclick: `window.switchClientTab('dados', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
      });
    }

    if (noitesCobertas < noitesViagem) {
      const noitesFaltantes = noitesViagem - noitesCobertas;
      pendenciasHospedagem.push({
        texto: `Faltam cobrir ${noitesFaltantes} noite(s) de hotel (Cobertura: ${noitesCobertas} de ${noitesViagem} noites).`,
        tipo: "error",
        labelAcao: "Adicionar Hotel",
        onclick: `window.switchClientTab('dados', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
      });
    }
  }

  // --- SEÇÃO 3: ROTEIRO & EMISSÕES ---
  const pendenciasEmissoes = [];
  const clienteNome = cliente.nome || '';
  const roteiro = typeof window.dbRotas !== 'undefined' ? Object.values(window.dbRotas).find(rot => {
    return rot.notionClienteId === cliente.id || (rot.cliente && rot.cliente.nome === clienteNome);
  }) : null;

  if (!roteiro) {
    pendenciasEmissoes.push({
      texto: "Roteiro do cliente ainda não foi criado no montador.",
      tipo: "error",
      labelAcao: "Criar Roteiro",
      onclick: `window.switchClientTab('roteiros', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
    });
  } else if (roteiro.dias) {
    roteiro.dias.forEach((dia, dIdx) => {
      const diaLabel = `Dia ${dIdx + 1} (${dia.cidade || ''})`;
      if (dia.elementos) {
        dia.elementos.forEach(el => {
          if (el.tipo === 'transporte') {
            const t = el.transportInfo || {};
            // tipoTransporte e campos ficam direto em el.*
            const transpNome = el.tipoTransporte || t.tipoTransporte || el.tipoServico || 'Transporte';
            const origem = el.cidadeOrigem || t.origem || '';
            const destino = el.cidadeDestino || t.destino || '';
            const trechoValido = origem && destino && origem.toLowerCase() !== destino.toLowerCase();
            const desc = `${transpNome}${trechoValido ? ` (${origem} ➔ ${destino})` : (origem ? ` (${origem})` : '')}`;
            const hora = el.horario || t.horario || el.horaEncontro;

            // 1. Shinkansen/trem sem horário
            const isTrem = transpNome.toLowerCase().includes('shinkansen') || transpNome.toLowerCase().includes('trem');
            if (isTrem && (!hora || hora === 'Definir' || hora.trim() === '')) {
              pendenciasEmissoes.push({
                texto: `Shinkansen/Trem sem horário definido: ${desc} (${diaLabel}).`,
                tipo: "error",
                labelAcao: "Ver Roteiro",
                onclick: `window.switchClientTab('roteiros', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
              });
            }

            // 2. Comprado Heian sem voucher
            const compradoPelaHeian = el.compradoHeian !== false && t.compradoHeian !== false;
            if (compradoPelaHeian) {
              const trechoSlug = origem && destino ? `|${origem}>${destino}` : '';
              const transpKey = `transporte:${transpNome}${trechoSlug}:d${dIdx}`;
              const temVoucher = vouchers.some(vx => vx.atracaoNome === transpKey)
                || vouchers.some(vx => vx.atracaoNome === `transporte:${transpNome}`);
              if (!temVoucher) {
                pendenciasEmissoes.push({
                  texto: `Falta bilhete/voucher de ${transpNome}${trechoValido ? `: ${origem} ➔ ${destino}` : ''} (${diaLabel}).`,
                  tipo: "error",
                  labelAcao: "Anexar",
                  onclick: `window.switchClientTab('vouchers', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
                });
              }
            }
          } else if (el.tipo === 'experiencia') {
            const e = el.expInfo || {};
            // nomeExp e campos ficam direto em el.*
            const nomeExp = el.nomeExp || e.nomeExp || el.titulo || 'Experiência';
            // Ignorar itens sem nome real (evita "Experiência (Dia X ())")
            if (!nomeExp || nomeExp === 'Experiência') return;
            const hora = el.horaPartida || e.horaPartida || el.horaEncontro || e.horaEncontro;

            // 1. Experiência sem horário (apenas se realmente não tiver)
            if (!hora || hora === 'Definir' || hora.trim() === '') {
              pendenciasEmissoes.push({
                texto: `Horário não definido: ${nomeExp} (${diaLabel}).`,
                tipo: "warning",
                labelAcao: "Ver Roteiro",
                onclick: `window.switchClientTab('roteiros', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
              });
            }

            // 2. Comprado Heian sem voucher
            const compradoPelaHeian = el.compradoHeian !== false && e.compradoHeian !== false;
            if (compradoPelaHeian) {
              const expKey = `experiencia:${nomeExp}:d${dIdx}`;
              const temVoucher = vouchers.some(vx => vx.atracaoNome === expKey)
                || vouchers.some(vx => vx.atracaoNome === `experiencia:${nomeExp}`);
              if (!temVoucher) {
                pendenciasEmissoes.push({
                  texto: `Falta ingresso/voucher: ${nomeExp} (${diaLabel}).`,
                  tipo: "error",
                  labelAcao: "Anexar",
                  onclick: `window.switchClientTab('vouchers', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
                });
              }
            }
          }
        });
      }
    });
  }

  // --- RENDERIZAÇÃO DO GRID ---
  let html = `<div class="pendencias-grid">`;

  // 1. Coluna Viajantes & Dados
  html += `
    <div class="pendencias-block">
      <div class="pendencias-block-title" style="display:inline-flex; align-items:center; gap:6px;"><svg class="v-icon" style="stroke:var(--gold-dk); width:1.15em; height:1.15em; margin-right:0;"><use href="#icon-users"></use></svg> Viajantes & Dados Gerais</div>
      <div class="pendencias-list">
  `;
  if (pendenciasDados.length === 0) {
    html += `
      <div class="pendencia-empty-state">
        <span style="color:#2ecc71; font-weight:bold; margin-right:4px;">✓</span> Viajantes e dados 100% preenchidos!
      </div>
    `;
  } else {
    pendenciasDados.forEach(p => {
      html += `
        <div class="pendencia-item-row">
          <span class="pendencia-item-badge ${p.tipo}">${p.tipo === 'error' ? 'Pendente' : 'Aviso'}</span>
          <span style="flex:1;">${p.texto}</span>
          <button class="pendencia-btn-action" onclick="${p.onclick}">${p.labelAcao}</button>
        </div>
      `;
    });
  }
  html += `</div></div>`;

  // 2. Coluna Hospedagem
  html += `
    <div class="pendencias-block">
      <div class="pendencias-block-title" style="display:inline-flex; align-items:center; gap:6px;"><svg class="v-icon" style="stroke:var(--gold-dk); width:1.15em; height:1.15em; margin-right:0;"><use href="#icon-home"></use></svg> Hospedagem (Estadias)</div>
      <div class="pendencias-list">
  `;
  if (pendenciasHospedagem.length === 0) {
    html += `
      <div class="pendencia-empty-state">
        <span style="color:#2ecc71; font-weight:bold; margin-right:4px;">✓</span> Hotéis e estadias 100% cobertos!
      </div>
    `;
  } else {
    pendenciasHospedagem.forEach(p => {
      html += `
        <div class="pendencia-item-row">
          <span class="pendencia-item-badge ${p.tipo}">${p.tipo === 'error' ? 'Pendente' : 'Aviso'}</span>
          <span style="flex:1;">${p.texto}</span>
          <button class="pendencia-btn-action" onclick="${p.onclick}">${p.labelAcao}</button>
        </div>
      `;
    });
  }
  html += `</div></div>`;

  // 3. Coluna Roteiro & Emissões
  html += `
    <div class="pendencias-block">
      <div class="pendencias-block-title" style="display:inline-flex; align-items:center; gap:6px;"><svg class="v-icon" style="stroke:var(--gold-dk); width:1.15em; height:1.15em; margin-right:0;"><use href="#icon-map"></use></svg> Roteiro & Emissões (Heian)</div>
      <div class="pendencias-list">
  `;
  if (pendenciasEmissoes.length === 0) {
    html += `
      <div class="pendencia-empty-state">
        <span style="color:#2ecc71; font-weight:bold; margin-right:4px;">✓</span> Roteiro e emissões concluídos com sucesso!
      </div>
    `;
  } else {
    pendenciasEmissoes.forEach(p => {
      html += `
        <div class="pendencia-item-row">
          <span class="pendencia-item-badge ${p.tipo}">${p.tipo === 'error' ? 'Pendente' : 'Aviso'}</span>
          <span style="flex:1;">${p.texto}</span>
          <button class="pendencia-btn-action" onclick="${p.onclick}">${p.labelAcao}</button>
        </div>
      `;
    });
  }
  html += `</div></div>`;

  html += `</div>`;
  contentDiv.innerHTML = html;
};

window.switchClientTab = async function(tabName, clienteId, estadiasJson, viajantesJson, emailsJson) {
  // Guarda a aba ativa: renderizações assíncronas conferem antes de escrever,
  // para não sobrescrever o conteúdo de outra aba (corrida de carregamento).
  window.__activeClientTab = tabName;
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

  // Pré-carrega vouchers em background para garantir dados atualizados nas abas
  try {
    const localRes = await fetch(`/api/clientes/local/${clienteId}?t=${Date.now()}`);
    const localData = await localRes.json();
    window.currentEditingVouchers = localData.vouchers || [];
  } catch (e) {
    console.error("Erro ao pré-carregar vouchers:", e);
  }

  if (tabName === 'resumo') {
    window.renderAbaResumoCliente(cliente, estadias, viajantes);
  } else if (tabName === 'dados') {
    renderAbaDadosCliente(cliente, estadias, viajantes, emails);
  } else if (tabName === 'roteiros') {
    renderAbaRoteiros(cliente);
  } else if (tabName === 'cotacoes') {
    renderAbaCotacoes(cliente);
  } else if (tabName === 'vouchers') {
    window.renderAbaVouchersCliente(cliente, viajantes);
  }
};

window.renderAbaVouchersCliente = async function(cliente, viajantes = []) {
  const contentDiv = document.getElementById('clientTabContent');
  if (!contentDiv) return;

  contentDiv.innerHTML = `<div style="text-align:center; padding: 20px;"><strong style="color:var(--crimson)">Carregando Vouchers...</strong></div>`;

  try {
    const localRes = await fetch(`/api/clientes/local/${cliente.id}?t=${Date.now()}`);
    const localData = await localRes.json();
    const vouchers = localData.vouchers || [];
    
    window.currentEditingVouchers = vouchers;

    const templatesRes = await fetch('/api/templates-vouchers');
    const templates = await templatesRes.json();

    const clienteNome = cliente.nome || '';
    const roteiroVinculado = typeof dbRotas !== 'undefined' ? Object.values(dbRotas).find(rot => {
      return rot.notionClienteId === cliente.id || (rot.cliente && rot.cliente.nome === clienteNome);
    }) : null;

    let itensRoteiro = [];
    let emissoesHeian = [];

    if (roteiroVinculado && roteiroVinculado.dias) {
      roteiroVinculado.dias.forEach((dia, dIdx) => {
        const diaLabel = `Dia ${dIdx + 1} (${dia.cidade || ''})`;
        itensRoteiro.push({ val: `dia:${dIdx + 1}`, label: diaLabel });

        let dataDoDiaStr = '';
        if (cliente.dataInicio) {
          try {
            const dt = new Date(cliente.dataInicio + 'T00:00:00');
            if (!isNaN(dt.getTime())) {
              dt.setDate(dt.getDate() + dIdx);
              const y = dt.getFullYear();
              const m = String(dt.getMonth() + 1).padStart(2, '0');
              const d = String(dt.getDate()).padStart(2, '0');
              dataDoDiaStr = `${y}-${m}-${d}`;
            }
          } catch(err) {
            console.error("Erro ao calcular data do dia na aba vouchers:", err);
          }
        }

        if (dia.elementos) {
          dia.elementos.forEach(el => {
            if (el.tipo === 'sequencia' && el.atracoesDoDia) {
              el.atracoesDoDia.forEach(atr => {
                itensRoteiro.push({ val: `atracao:${atr}`, label: `Atração: ${atr} (${diaLabel})` });
              });
            } else if (el.tipo === 'experiencia') {
              const e = el.expInfo || {};
              // nomeExp vive direto em el.nomeExp — expInfo é apenas fallback
              const nomeExp = el.nomeExp || e.nomeExp || el.titulo || 'Experiência';
              itensRoteiro.push({ val: `experiencia:${nomeExp}`, label: `Exp: ${nomeExp} (${diaLabel})` });

              const compradoPelaHeian = el.compradoHeian !== false && e.compradoHeian !== false;
              if (compradoPelaHeian) {
                // Chave única: tipo + nome + dia — evita falso match entre itens iguais em dias diferentes
                const expKey = `experiencia:${nomeExp}:d${dIdx}`;
                // Compatibilidade retroativa: aceita chave nova (com dia) OU chave antiga (sem dia, apenas includes)
                const v = vouchers.find(x => x.atracaoNome === expKey)
                  || vouchers.find(x => x.atracaoNome && x.atracaoNome.startsWith('experiencia:') && x.atracaoNome === `experiencia:${nomeExp}`);
                const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : '');
                emissoesHeian.push({
                  tipo: 'experiencia',
                  tipoLabel: 'Experiência',
                  tituloItem: nomeExp,
                  desc: nomeExp,
                  diaLabel: diaLabel,
                  key: expKey,
                  voucher: v,
                  dataSugerida: el.dataDoTour || e.dataDoTour || dataDoDiaStr || '',
                  horario: el.horaPartida || e.horaPartida || '',
                  local: el.localEncontro || e.localEncontro || '',
                  pessoasText: pText,
                  instrucoesPreCompra: el.instrucoesPreCompra || ''
                });
              }
            } else if (el.tipo === 'transporte') {
              const t = el.transportInfo || {};
              // tipoTransporte vive direto em el.tipoTransporte
              const transpNome = el.tipoTransporte || t.tipoTransporte || el.tipoServico || 'Transporte';
              const origem = el.cidadeOrigem || t.origem || '';
              const destino = el.cidadeDestino || t.destino || '';
              const desc = `${transpNome}${origem && destino ? ` (${origem} ➔ ${destino})` : ''}`;
              itensRoteiro.push({ val: `transporte:${transpNome}`, label: `Transp: ${desc} (${diaLabel})` });

              const compradoPelaHeian = el.compradoHeian !== false && t.compradoHeian !== false;
              if (compradoPelaHeian) {
                // Chave única: tipo + nome + trecho + dia — cada trecho em cada dia é independente
                const trechoSlug = origem && destino ? `|${origem}>${destino}` : '';
                const transpKey = `transporte:${transpNome}${trechoSlug}:d${dIdx}`;
                // Compatibilidade retroativa: aceita chave nova (com dia+trecho) OU chave antiga (só tipo, sem dia)
                const v = vouchers.find(x => x.atracaoNome === transpKey)
                  || vouchers.find(x => x.atracaoNome && x.atracaoNome === `transporte:${transpNome}` && emissoesHeian.every(prev => prev.voucher?.atracaoNome !== x.atracaoNome));
                const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : '');
                emissoesHeian.push({
                  tipo: 'transporte',
                  tipoLabel: transpNome,
                  tituloItem: transpNome,
                  desc: desc,
                  origemDestino: `${origem || 'A definir'} ➔ ${destino || 'A definir'}`,
                  diaLabel: diaLabel,
                  key: transpKey,
                  voucher: v,
                  dataSugerida: el.data || dataDoDiaStr || '',
                  linha: el.linha || t.linha || '',
                  categoria: el.categoria || t.categoria || '',
                  horario: el.horario || t.horario || '',
                  duracao: el.tempo || t.tempo || '',
                  pessoasText: pText,
                  instrucoesPreCompra: el.instrucoesPreCompra || ''
                });
              }
            }
          });
        }
      });
    }

    // --- RENDERIZAR TABELA DE EMISSÕES HEIAN ---
    let emissoesHTML = '';
    if (emissoesHeian.length === 0) {
      emissoesHTML = `<p style="color:var(--ink-lt); font-size:13px; font-style:italic; padding:10px 0;">Não há nenhum item marcado para emissão pela Heian neste roteiro.</p>`;
    } else {
      emissoesHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 16px; margin-top: 8px;">
          ${emissoesHeian.map(eh => {
            let statusBadge = '';
            let acaoHTML = '';
            let cardBorderColor = '#e5e7eb';
            let cardBg = '#fff';
            let cardBorderLeft = '#C4A35A';

            if (eh.voucher) {
              cardBorderColor = '#10b981';
              cardBg = '#f6fdf9';
              cardBorderLeft = '#10b981';
              statusBadge = `<span style="background:#d1fae5; color:#065f46; padding:3px 8px; font-size:10px; font-weight:700; text-transform:uppercase; border-radius:4px; letter-spacing:0.04em;">✔ Emitido</span>`;

              let linkHTML = '';
              if (eh.voucher.arquivos && eh.voucher.arquivos.length > 0) {
                linkHTML = eh.voucher.arquivos.map((arq, idx) => {
                  return `<a href="${arq.url}" target="_blank" style="color:var(--gold-dk); font-weight:600; font-size:11.5px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border:1px solid var(--gold-lt); border-radius:4px; background:#fff; margin-right:6px;"><svg class="v-icon" style="stroke:var(--gold-dk); width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-file"></use></svg> Doc ${idx+1}</a>`;
                }).join('');
              } else if (eh.voucher.url) {
                linkHTML = `<a href="${eh.voucher.url}" target="_blank" style="color:var(--gold-dk); font-weight:600; font-size:11.5px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border:1px solid var(--gold-lt); border-radius:4px; background:#fff;"><svg class="v-icon" style="stroke:var(--gold-dk); width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-link"></use></svg> Abrir Link</a>`;
              } else {
                linkHTML = `<span style="color:var(--ink-lt); font-size:11.5px; font-style:italic; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="stroke:var(--ink-lt); width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-file-text"></use></svg> Instrução escrita</span>`;
              }

              const editAction = `window.uploadRapidoVoucherAdmin('${cliente.id}', '${eh.voucher.atracaoNome.replace(/'/g, "\\'")}', '${eh.voucher.nome.replace(/'/g, "\\'")}', '${eh.voucher.dataUso || ''}', '${eh.voucher.id}')`;
              acaoHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #d1fae5; padding-top:10px; margin-top:10px; gap:8px;">
                  <div style="flex:1; display:flex; flex-wrap:wrap; gap:4px;">${linkHTML}</div>
                  <button onclick="${editAction}" style="padding:4px 10px; font-size:11px; cursor:pointer; background:#fff; border:1px solid #a7f3d0; border-radius:4px; color:#065f46; font-weight:600; white-space:nowrap; flex-shrink:0; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon no-margin" style="stroke:#065f46; width:1.1em; height:1.1em;"><use href="#icon-edit"></use></svg> Alterar</button>
                </div>
              `;
            } else {
              cardBorderColor = '#fca5a5';
              cardBorderLeft = '#ef4444';
              statusBadge = `<span style="background:#fee2e2; color:#991b1b; padding:3px 8px; font-size:10px; font-weight:700; text-transform:uppercase; border-radius:4px; letter-spacing:0.04em;">Pendente</span>`;

              const suggestionsName = eh.tipo === 'transporte' ? `Bilhete - ${eh.tituloItem || eh.desc}` : `Ingresso - ${eh.tituloItem || eh.desc}`;
              const actionClick = `window.uploadRapidoVoucherAdmin('${cliente.id}', '${eh.key.replace(/'/g, "\\'")}', '${suggestionsName.replace(/'/g, "\\'")}', '${eh.dataSugerida}')`;

              acaoHTML = `
                <div style="border-top:1px solid #fee2e2; padding-top:10px; margin-top:10px;">
                  <button onclick="${actionClick}" style="padding:7px 0; font-size:12px; border-radius:6px; font-weight:600; cursor:pointer; background:var(--crimson); border:none; color:white; width:100%; display:flex; align-items:center; justify-content:center; gap:6px;">
                    <svg class="v-icon no-margin" style="stroke:white; width:1.1em; height:1.1em;"><use href="#icon-plus"></use></svg> Anexar Bilhete / Ingresso
                  </button>
                </div>
              `;
            }

            // Detalhes extras por tipo
            let detalhesPrincipais = '';
            if (eh.tipo === 'transporte') {
              // Sanitização: só mostrar trecho se origem ≠ destino
              const [trechoOrigem, trechoDestino] = (eh.origemDestino || '').split(' ➔ ').map(s => s.trim());
              const trechoValido = trechoOrigem && trechoDestino && trechoOrigem.toLowerCase() !== trechoDestino.toLowerCase();
              // Sanitização: ignorar categoria se for puramente numérica (ex: preço "40000")
              const categoriaValida = eh.categoria && !/^\d+$/.test(String(eh.categoria).trim()) && eh.categoria !== '-';
              detalhesPrincipais = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px;">
                  ${trechoValido ? `<div style="grid-column:span 2; background:#f0f4f9; border-radius:6px; padding:8px 10px;">
                    <div style="font-size:10px; font-weight:600; color:var(--ink-lt); text-transform:uppercase; margin-bottom:3px;">Trecho</div>
                    <div style="font-size:14px; color:var(--ink-dk); font-weight:700;">${eh.origemDestino}</div>
                  </div>` : ''}
                  ${eh.linha ? `<div style="background:#f9f9f9; border-radius:6px; padding:8px 10px;">
                    <div style="font-size:10px; font-weight:600; color:var(--ink-lt); text-transform:uppercase; margin-bottom:3px;">Trem / Voo / Linha</div>
                    <div style="font-size:13px; color:var(--ink-dk); font-weight:700;">${eh.linha}</div>
                  </div>` : ''}
                  ${categoriaValida ? `<div style="background:#f5f0ff; border:1px solid #ede9fe; border-radius:6px; padding:8px 10px;">
                    <div style="font-size:10px; font-weight:600; color:#6d28d9; text-transform:uppercase; margin-bottom:3px;">Classe / Tipo</div>
                    <div style="font-size:13px; color:#4c1d95; font-weight:700;">${eh.categoria}</div>
                  </div>` : ''}
                  ${eh.horario ? `<div style="background:#fff8e6; border:1px solid #fef3c7; border-radius:6px; padding:8px 10px;">
                    <div style="font-size:10px; font-weight:600; color:#b45309; text-transform:uppercase; margin-bottom:3px;">Horário de Partida</div>
                    <div style="font-size:22px; color:#92400e; font-weight:800; line-height:1;">${eh.horario}</div>
                  </div>` : ''}
                  ${eh.duracao ? `<div style="background:#f9f9f9; border-radius:6px; padding:8px 10px;">
                    <div style="font-size:10px; font-weight:600; color:var(--ink-lt); text-transform:uppercase; margin-bottom:3px;">Duração</div>
                    <div style="font-size:13px; color:var(--ink-dk); font-weight:600;">${eh.duracao}</div>
                  </div>` : ''}
                </div>
              `;
            } else {
              detalhesPrincipais = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px;">
                  ${eh.horario ? `<div style="background:#fff8e6; border:1px solid #fef3c7; border-radius:6px; padding:8px 10px;">
                    <div style="font-size:10px; font-weight:600; color:#b45309; text-transform:uppercase; margin-bottom:2px;">Horário</div>
                    <div style="font-size:16px; color:#000; font-weight:800;">${eh.horario}</div>
                  </div>` : ''}
                  ${eh.local ? `<div style="background:#f9f9f9; border-radius:6px; padding:8px 10px; grid-column:${eh.horario ? '1' : 'span 2'};">
                    <div style="font-size:10px; font-weight:600; color:var(--ink-lt); text-transform:uppercase; margin-bottom:2px;">Local de Encontro</div>
                    <div style="font-size:12px; color:var(--ink-dk); font-weight:600;">${eh.local}</div>
                  </div>` : ''}
                </div>
              `;
            }

            // Passageiros
            const nomesViajantes = viajantes.length > 0 ? viajantes.map(v => v.nomeCompleto || v.nome || '').filter(Boolean).join(', ') : '';
            const passageirosLabel = eh.pessoasText || (nomesViajantes ? `${viajantes.length} passageiro(s)` : '');
            const passageirosDetalhe = nomesViajantes ? `<div style="font-size:11px; color:var(--ink-lt); margin-top:2px;">${nomesViajantes}</div>` : '';

            // Nota de compra
            let notaCompra = '';
            if (eh.instrucoesPreCompra) {
              notaCompra = `
                <div style="background:#fffbeb; border-left:3px solid #f59e0b; padding:8px 10px; border-radius:0 6px 6px 0; margin-top:10px;">
                  <div style="font-size:10px; font-weight:700; color:#92400e; text-transform:uppercase; margin-bottom:3px;">Nota de Compra</div>
                  <div style="font-size:12px; color:#78350f;">${eh.instrucoesPreCompra}</div>
                </div>
              `;
            }

            return `
              <div style="border: 1px solid ${cardBorderColor}; border-left: 4px solid ${cardBorderLeft}; border-radius: 10px; padding: 14px; background: ${cardBg}; display: flex; flex-direction: column; box-shadow: 0 1px 4px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px;">
                  <div style="flex:1;">
                    <div style="font-size:16px; font-weight:800; color:var(--ink-dk); letter-spacing:-0.02em;">${eh.dataSugerida ? fmtDataBR(eh.dataSugerida) : 'Sem data definida'}</div>
                    <div style="font-size:11.5px; color:var(--ink-lt); font-weight:500; margin-top:1px;">${eh.diaLabel}</div>
                  </div>
                  ${statusBadge}
                </div>

                <div style="font-size:11px; color:${eh.tipo === 'transporte' ? '#9c8248' : 'var(--crimson)'}; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px;">${eh.tipoLabel}</div>
                <div style="font-size:15px; font-weight:700; color:var(--ink-dk); line-height:1.3;">${(eh.tituloItem && eh.tituloItem !== 'Transporte') ? eh.tituloItem : (eh.desc && eh.desc !== 'Transporte' ? eh.desc : 'Transfer')}</div>

                ${detalhesPrincipais}

                ${passageirosLabel ? `<div style="margin-top:10px; background:#f0f4ff; border-radius:6px; padding:8px 10px;">
                  <div style="font-size:10px; font-weight:600; color:#3730a3; text-transform:uppercase; margin-bottom:2px;">Passageiros</div>
                  <div style="font-size:12.5px; color:#1e1b4b; font-weight:600;">${passageirosLabel}</div>
                  ${passageirosDetalhe}
                </div>` : ''}

                ${notaCompra}
                ${acaoHTML}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // --- RENDERIZAR TABELA DE VOUCHERS GERAIS ---
    let vouchersHTML = '';
    if (vouchers.length === 0) {
      vouchersHTML = `<p style="text-align:center; color:var(--ink-lt); padding: 20px; font-size:13.5px;">Nenhum voucher cadastrado para este cliente.</p>`;
    } else {
      vouchersHTML = `
        <div style="overflow-x:auto;">
          <table class="data-table" style="width:100%;">
            <thead>
              <tr>
                <th>Nome / Item</th>
                <th>Tipo</th>
                <th>Associação</th>
                <th>Data</th>
                <th style="width: 80px; text-align:center;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${vouchers.map(v => {
                let badgeColor = '#6b7280';
                if (v.tipo === 'qr_code') badgeColor = '#10b981';
                else if (v.tipo === 'pdf') badgeColor = '#ef4444';
                else if (v.tipo === 'link') badgeColor = '#3b82f6';
                else if (v.tipo === 'instrucao') badgeColor = '#f59e0b';

                let assocLabel = 'Nenhuma';
                if (v.atracaoNome) {
                  if (v.atracaoNome.startsWith('dia:')) assocLabel = `Dia ${v.atracaoNome.split(':')[1]}`;
                  else if (v.atracaoNome.startsWith('atracao:')) assocLabel = v.atracaoNome.split(':')[1];
                  else if (v.atracaoNome.startsWith('experiencia:')) assocLabel = v.atracaoNome.split(':')[1];
                  else if (v.atracaoNome.startsWith('transporte:')) assocLabel = v.atracaoNome.split(':')[1];
                  else assocLabel = v.atracaoNome;
                }

                let filesCount = 1;
                if (v.arquivos && Array.isArray(v.arquivos)) {
                  filesCount = v.arquivos.length;
                } else if (v.url) {
                  filesCount = 1;
                } else {
                  filesCount = 0;
                }
                const filesLabel = filesCount > 1 ? `<span style="font-size:10.5px; padding: 2px 5px; background: #eee; border-radius: 4px; color: #555; margin-left: 6px; font-weight: normal;">${filesCount} arquivos</span>` : '';

                return `
                  <tr>
                    <td>
                      <strong>${v.nome}</strong> ${filesLabel}
                      ${v.instrucao ? `<div style="font-size:11px; color:var(--ink-lt); margin-top:2px; white-space:pre-line;">${v.instrucao.substring(0, 100)}${v.instrucao.length > 100 ? '...' : ''}</div>` : ''}
                    </td>
                    <td><span class="meta-badge" style="background:${badgeColor}22; color:${badgeColor}; border:none; padding:2px 8px; font-size:11px; font-weight:600;">${v.tipo.toUpperCase()}</span></td>
                    <td style="font-size:12.5px;">${assocLabel}</td>
                    <td style="font-size:12.5px;">${v.dataUso ? fmtDataBR(v.dataUso) : '—'}</td>
                    <td style="text-align:center;">
                      <div style="display:inline-flex; gap:6px; justify-content:center; align-items:center;">
                        <button class="btn-secondary" onclick="window.uploadRapidoVoucherAdmin('${cliente.id}', '${v.atracaoNome || ''}', '${v.nome.replace(/'/g, "\\'")}', '${v.dataUso || ''}', '${v.id}')" style="padding:4px 8px; font-size:11px; color:#3b82f6; border-color:#eff6ff; cursor:pointer;" title="Editar"><svg class="v-icon no-margin"><use href="#icon-edit"></use></svg></button>
                        <button class="btn-secondary" onclick="window.excluirVoucherCliente('${cliente.id}', '${v.id}')" style="padding:4px 8px; font-size:11px; color:#c00; border-color:#fee; cursor:pointer;" title="Excluir"><svg class="v-icon no-margin" style="stroke:#c00;"><use href="#icon-trash"></use></svg></button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Se o usuário já trocou de aba enquanto os vouchers carregavam, não sobrescreve
    if (window.__activeClientTab && window.__activeClientTab !== 'vouchers') return;

    contentDiv.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <!-- Controle de Emissões Heian (Roteiro) -->
        <div class="info-card" style="padding:16px; border: 1px solid rgba(196,163,90,0.22); background: linear-gradient(to bottom, #fdfaf5, #ffffff);">
          <h3 class="info-card-title" style="margin-bottom:12px; font-size:14px; font-weight:600; color:var(--crimson); display:flex; justify-content:space-between; align-items:center;">
            <span>Controle de Emissões Heian (Roteiro)</span>
            <span style="font-size:11px; color:var(--ink-lt); font-weight:normal;">Mapeado dinamicamente do roteiro</span>
          </h3>
          ${emissoesHTML}
        </div>

        <!-- Lista de Vouchers -->
        <div class="info-card" style="padding:16px;">
          <h3 class="info-card-title" style="margin-bottom:12px; font-size:14px; font-weight:600; display:flex; justify-content:space-between; align-items:center;">
            <span>Todos os Ingressos e Vouchers Enviados</span>
            <span style="font-size:11px; color:var(--ink-lt); font-weight:normal;">${vouchers.length} item(ns)</span>
          </h3>
          ${vouchersHTML}
        </div>

        <!-- Formulário de Cadastro -->
        <div class="info-card" style="padding:16px; border:1px dashed var(--border); background:#fdfdfd;">
          <h3 class="info-card-title" style="margin-bottom:12px; font-size:14px; font-weight:600; color:var(--crimson);">Cadastrar Novo Voucher Avulso</h3>
          
          <form id="formNovoVoucher" onsubmit="window.salvarNovoVoucherCliente(event, '${cliente.id}')" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            
            <div style="display:flex; flex-direction:column; gap:4px; grid-column:span 2;">
              <label style="font-size:12px; font-weight:600; color:var(--ink-mid);">Nome do Ingresso / Reserva</label>
              <input type="text" id="vchNome" required placeholder="Ex: Entrada Disneyland Tokyo, Bilhete Shinkansen Kyoto" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; font-weight:600; color:var(--ink-mid);">Tipo de Voucher</label>
              <select id="vchTipo" onchange="window.toggleVchFields()" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:#fff;">
                <option value="qr_code">QR Code (Imagem)</option>
                <option value="pdf">Documento PDF</option>
                <option value="link">Link Externo (Google Drive, etc)</option>
                <option value="instrucao">Apenas Instruções por escrito</option>
              </select>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; font-weight:600; color:var(--ink-mid);">Data de Uso (Opcional)</label>
              <input type="date" id="vchDataUso" style="padding:7px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
            </div>

            <!-- Campo de Arquivo (Imagens/PDF) -->
            <div id="vchFileWrapper" style="display:flex; flex-direction:column; gap:4px; grid-column:span 2;">
              <label style="font-size:12px; font-weight:600; color:var(--ink-mid);">Upload do Arquivo (Imagem ou PDF)</label>
              <input type="file" id="vchFile" accept="image/*,application/pdf" multiple style="padding:6px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:#fff;">
              <span style="font-size:11px; color:var(--ink-lt);">Selecione um ou mais arquivos (imagens de QR Code ou PDFs). Tamanho máximo individual recomendado: 3MB.</span>
            </div>

            <!-- Campo de URL (Para Links) -->
            <div id="vchUrlWrapper" style="display:none; flex-direction:column; gap:4px; grid-column:span 2;">
              <label style="font-size:12px; font-weight:600; color:var(--ink-mid);">Link Externo (URL)</label>
              <input type="url" id="vchUrl" placeholder="https://drive.google.com/..." style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
            </div>

            <div style="display:flex; flex-direction:column; gap:4px; grid-column:span 2;">
              <label style="font-size:12px; font-weight:600; color:var(--ink-mid);">Vincular a Item do Roteiro (Opcional)</label>
              <select id="vchAtracaoNome" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:#fff;">
                <option value="">-- Selecionar item do roteiro --</option>
                ${itensRoteiro.map(item => `<option value="${item.val}">${item.label}</option>`).join('')}
              </select>
            </div>

            <!-- Dropdown de Templates de Instruções do Sheets -->
            <div style="display:flex; flex-direction:column; gap:4px; grid-column:span 2;">
              <label style="font-size:12px; font-weight:600; color:var(--ink-mid);">Carregar Modelo de Instrução do Google Sheets</label>
              <select id="vchTemplate" onchange="window.aplicarTemplateInstrucao()" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:#fff; border-color:var(--accent);">
                <option value="">-- Escolha um modelo para autocompletar --</option>
                ${templates.map(t => `<option value="${t.id}">${t.titulo}</option>`).join('')}
              </select>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px; grid-column:span 2;">
              <label style="font-size:12px; font-weight:600; color:var(--ink-mid);">Instruções Específicas para o Cliente</label>
              <textarea id="vchInstrucao" rows="4" placeholder="Ex: Apresente o QR code no celular para entrar..." style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; font-family:var(--ff-body); resize:vertical;"></textarea>
            </div>

            <div style="grid-column:span 2; display:flex; justify-content:flex-end; margin-top:8px;">
              <button type="submit" class="btn-primary" style="padding:10px 20px; font-size:13px; font-weight:600; border-radius:6px;">
                Adicionar e Salvar Ficha
              </button>
            </div>
            
          </form>
        </div>

      </div>
    `;

    window.vchTemplatesCache = templates;

  } catch(e) {
    console.error(e);
    contentDiv.innerHTML = `<div style="text-align:center; padding: 20px; color:#c00;">Erro ao carregar a aba de Vouchers: ${e.message}</div>`;
  }
};

window.toggleVchFields = function() {
  const tipo = document.getElementById('vchTipo').value;
  const fileWrapper = document.getElementById('vchFileWrapper');
  const urlWrapper = document.getElementById('vchUrlWrapper');

  if (tipo === 'qr_code' || tipo === 'pdf') {
    if (fileWrapper) fileWrapper.style.display = 'flex';
    if (urlWrapper) urlWrapper.style.display = 'none';
  } else if (tipo === 'link') {
    if (fileWrapper) fileWrapper.style.display = 'none';
    if (urlWrapper) urlWrapper.style.display = 'flex';
  } else {
    if (fileWrapper) fileWrapper.style.display = 'none';
    if (urlWrapper) urlWrapper.style.display = 'none';
  }
};

window.aplicarTemplateInstrucao = function() {
  const templateId = document.getElementById('vchTemplate').value;
  if (!templateId || !window.vchTemplatesCache) return;
  const template = window.vchTemplatesCache.find(t => t.id === templateId);
  if (template) {
    const el = document.getElementById('vchInstrucao');
    if (el) el.value = template.instrucoes || '';
  }
};

window.excluirVoucherCliente = async function(clienteId, voucherId) {
  if (!confirm('Deseja realmente excluir este voucher/ingresso? Isso não poderá ser desfeito.')) return;

  try {
    const resLocal = await fetch(`/api/clientes/local/${clienteId}?t=${Date.now()}`);
    const localData = await resLocal.json();
    
    localData.vouchers = (localData.vouchers || []).filter(v => v.id !== voucherId);
    
    window.currentEditingVouchers = localData.vouchers;

    const saveRes = await fetch('/api/clientes/local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localData)
    });

    if (!saveRes.ok) throw new Error('Erro ao persistir exclusão');
    alert('Voucher excluído com sucesso!');
    
    const cliente = typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === clienteId) : { id: clienteId };
    window.renderAbaVouchersCliente(cliente);

  } catch (err) {
    console.error(err);
    alert('Erro ao excluir voucher: ' + err.message);
  }
};

window.salvarNovoVoucherCliente = async function(e, clienteId) {
  e.preventDefault();

  const btn = e.target.querySelector('button[type="submit"]');
  const oldText = btn.innerText;
  btn.disabled = true;
  btn.innerText = 'Processando e Salvando...';

  try {
    const nome = document.getElementById('vchNome').value.trim();
    const tipo = document.getElementById('vchTipo').value;
    const dataUso = document.getElementById('vchDataUso').value;
    const atracaoNome = document.getElementById('vchAtracaoNome').value;
    const instrucao = document.getElementById('vchInstrucao').value.trim();
    
    let url = '';
    let fileName = '';
    let arquivos = [];

    if (tipo === 'qr_code' || tipo === 'pdf') {
      const fileInput = document.getElementById('vchFile');
      if (fileInput.files.length > 0) {
        const promessasLeitura = Array.from(fileInput.files).map(file => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({
              id: String(Date.now() + Math.random()),
              url: reader.result,
              fileName: file.name
            });
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
          });
        });
        
        arquivos = await Promise.all(promessasLeitura);
        
        // Mantém compatibilidade com campos raiz de arquivo único (compatibilidade de fallback)
        url = arquivos[0].url;
        fileName = arquivos[0].fileName;
      } else {
        throw new Error('Por favor, selecione ao menos um arquivo de imagem ou PDF para fazer upload.');
      }
    } else if (tipo === 'link') {
      url = document.getElementById('vchUrl').value.trim();
      if (!url) throw new Error('Por favor, digite a URL para o link externo.');
      arquivos = [{ id: String(Date.now()), url, fileName: 'Link Externo' }];
    }

    const resLocal = await fetch(`/api/clientes/local/${clienteId}?t=${Date.now()}`);
    const localData = await resLocal.json();
    
    if (!localData.vouchers) localData.vouchers = [];

    const novoVoucher = {
      id: String(Date.now() + Math.random()),
      nome,
      tipo,
      url,
      fileName,
      arquivos, // Injeta o array de múltiplos arquivos
      atracaoNome,
      dataUso,
      instrucao
    };

    localData.vouchers.push(novoVoucher);
    
    window.currentEditingVouchers = localData.vouchers;

    const saveRes = await fetch('/api/clientes/local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localData)
    });

    if (!saveRes.ok) throw new Error('Erro ao salvar no banco');
    
    alert('Voucher cadastrado e salvo com sucesso!');
    
    const cliente = typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === clienteId) : { id: clienteId };
    window.renderAbaVouchersCliente(cliente);

  } catch(err) {
    console.error(err);
    alert('Erro ao salvar voucher: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = oldText;
  }
};

// Modal dinâmico de upload rápido de voucher (Suporta Criação e Edição)
window.uploadRapidoVoucherAdmin = async function(clienteId, atracaoNome, nomeSugestionado, dataUso, voucherId = null) {
  let modal = document.getElementById('modalUploadRapidoVoucher');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalUploadRapidoVoucher';
    modal.style.position = 'fixed';
    modal.style.zIndex = '9999';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    document.body.appendChild(modal);
  }

  // Feedback visual de carregamento
  modal.innerHTML = `
    <div style="background:#fff; padding:24px; border-radius:12px; width:90%; max-width:500px; box-shadow:0 10px 30px rgba(0,0,0,0.25); display:flex; align-items:center; justify-content:center; min-height:200px;">
      <strong style="color:var(--crimson)">Carregando informações do voucher...</strong>
    </div>
  `;
  modal.style.display = 'flex';

  let templates = [];
  let voucherExistente = null;
  
  try {
    const templatesRes = await fetch('/api/templates-vouchers');
    templates = await templatesRes.json();
    
    const resLocal = await fetch(`/api/clientes/local/${clienteId}?t=${Date.now()}`);
    const localData = await resLocal.json();
    if (voucherId && localData.vouchers) {
      voucherExistente = localData.vouchers.find(v => v.id === voucherId);
    }
  } catch(e) {
    console.error(e);
  }

  const isEdit = !!voucherExistente;
  const nomeVal = isEdit ? voucherExistente.nome : nomeSugestionado;
  const tipoVal = isEdit ? voucherExistente.tipo : 'qr_code';
  const dataVal = isEdit ? (voucherExistente.dataUso || '') : (dataUso || '');
  const instrucoesVal = isEdit ? (voucherExistente.instrucao || '') : '';
  const urlVal = (isEdit && voucherExistente.tipo === 'link') ? (voucherExistente.url || '') : '';
  const targetAtracao = isEdit ? (voucherExistente.atracaoNome || atracaoNome) : atracaoNome;

  let labelVinculo = 'Nenhum';
  if (targetAtracao) {
    if (targetAtracao.startsWith('dia:')) labelVinculo = `Dia ${targetAtracao.split(':')[1]}`;
    else if (targetAtracao.startsWith('atracao:')) labelVinculo = `Atração: ${targetAtracao.split(':')[1]}`;
    else if (targetAtracao.startsWith('experiencia:')) labelVinculo = `Experiência: ${targetAtracao.split(':')[1]}`;
    else if (targetAtracao.startsWith('transporte:')) labelVinculo = `Transporte: ${targetAtracao.split(':')[1]}`;
    else labelVinculo = targetAtracao;
  }

  let arquivosFeedbackHTML = '';
  if (isEdit && (tipoVal === 'qr_code' || tipoVal === 'pdf') && voucherExistente.arquivos && voucherExistente.arquivos.length > 0) {
    const nomesFls = voucherExistente.arquivos.map(a => a.fileName || 'Arquivo').join(', ');
    arquivosFeedbackHTML = `
      <div id="vchRapidoFileFeedback" style="font-size:11px; color:#1e40af; background:#eff6ff; border:1px solid #bfdbfe; padding:8px 10px; border-radius:6px; margin-top:4px;">
        <strong>Arquivos atuais:</strong> ${nomesFls}
        <br><span style="color:#6b7280; font-size:10px;">Selecione novos arquivos para substituir, ou deixe em branco para manter os atuais.</span>
      </div>
    `;
  }

  modal.innerHTML = `
    <div style="background:#fff; padding:24px; border-radius:12px; width:90%; max-width:500px; box-shadow:0 10px 30px rgba(0,0,0,0.25); display:flex; flex-direction:column; gap:16px; position:relative;" onclick="event.stopPropagation()">
      <span onclick="window.fecharModalUploadRapido()" style="position:absolute; top:12px; right:16px; font-size:20px; font-weight:bold; cursor:pointer; color:#7f7f7f;">✕</span>
      <h3 style="margin:0; font-family:var(--ff-display); color:var(--crimson); font-size:16px; font-weight:600;">
        ${isEdit ? 'Editar Ingresso / Passagem' : 'Enviar Ingresso / Passagem'}
      </h3>
      
      <div style="font-size:12px; color:var(--text-sec); border-bottom:1px solid var(--border); padding-bottom:8px; margin-bottom:4px;">
        <strong>Vínculo:</strong> <span style="color:var(--crimson); font-weight:600;">${labelVinculo}</span>
      </div>
      
      <form id="formUploadRapido" onsubmit="window.salvarUploadRapidoVoucher(event, '${clienteId}', '${targetAtracao.replace(/'/g, "\\'")}', '${voucherId || ''}')" style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Nome do Ingresso / Voucher</label>
          <input type="text" id="vchRapidoNome" required value="${nomeVal.replace(/"/g, '&quot;')}" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:11.5px; font-weight:600; color:#555;">Tipo</label>
            <select id="vchRapidoTipo" onchange="window.toggleVchRapidoFields()" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:#fff;">
              <option value="qr_code" ${tipoVal === 'qr_code' ? 'selected' : ''}>QR Code (Imagem)</option>
              <option value="pdf" ${tipoVal === 'pdf' ? 'selected' : ''}>Documento PDF</option>
              <option value="link" ${tipoVal === 'link' ? 'selected' : ''}>Link Externo</option>
              <option value="instrucao" ${tipoVal === 'instrucao' ? 'selected' : ''}>Apenas Instruções por escrito</option>
            </select>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:11.5px; font-weight:600; color:#555;">Data de Uso (Opcional)</label>
            <input type="date" id="vchRapidoData" value="${dataVal}" style="padding:7px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
          </div>
        </div>

        <div id="vchRapidoFileWrapper" style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Upload de Arquivos</label>
          <input type="file" id="vchRapidoFile" accept="image/*,application/pdf" multiple style="padding:6px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:#fff;">
          ${arquivosFeedbackHTML}
        </div>

        <div id="vchRapidoUrlWrapper" style="display:none; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Link do Documento (URL)</label>
          <input type="url" id="vchRapidoUrl" value="${urlVal}" placeholder="https://drive.google.com/..." style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
        </div>

        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Modelo de Instrução (Sheets)</label>
          <select id="vchRapidoTemplate" onchange="window.aplicarTemplateRapido()" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:#fff; border-color:var(--accent);">
            <option value="">-- Escolha um modelo para preencher --</option>
            ${templates.map(t => `<option value="${t.id}">${t.titulo}</option>`).join('')}
          </select>
        </div>

        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Instruções ao Cliente</label>
          <textarea id="vchRapidoInstrucoes" rows="3" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; font-family:var(--ff-body); resize:vertical;">${instrucoesVal}</textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
          <button type="button" onclick="window.fecharModalUploadRapido()" class="btn-secondary" style="padding:8px 16px; font-size:12.5px;">Cancelar</button>
          <button type="submit" class="btn-primary" style="padding:8px 20px; font-size:12.5px; font-weight:600;">
            ${isEdit ? 'Salvar Alterações' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  `;

  window.vchRapidoTemplatesCache = templates;
  window.toggleVchRapidoFields();
};

window.fecharModalUploadRapido = function() {
  const modal = document.getElementById('modalUploadRapidoVoucher');
  if (modal) modal.style.display = 'none';
};

window.toggleVchRapidoFields = function() {
  const tipo = document.getElementById('vchRapidoTipo').value;
  const fileWrapper = document.getElementById('vchRapidoFileWrapper');
  const urlWrapper = document.getElementById('vchRapidoUrlWrapper');
  if (tipo === 'qr_code' || tipo === 'pdf') {
    if (fileWrapper) fileWrapper.style.display = 'flex';
    if (urlWrapper) urlWrapper.style.display = 'none';
  } else if (tipo === 'link') {
    if (fileWrapper) fileWrapper.style.display = 'none';
    if (urlWrapper) urlWrapper.style.display = 'flex';
  } else {
    if (fileWrapper) fileWrapper.style.display = 'none';
    if (urlWrapper) urlWrapper.style.display = 'none';
  }
};

window.aplicarTemplateRapido = function() {
  const tId = document.getElementById('vchRapidoTemplate').value;
  if (!tId || !window.vchRapidoTemplatesCache) return;
  const template = window.vchRapidoTemplatesCache.find(t => t.id === tId);
  if (template) {
    document.getElementById('vchRapidoInstrucoes').value = template.instrucoes || '';
  }
};

window.salvarUploadRapidoVoucher = async function(e, clienteId, atracaoNome, voucherId = null) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerText = 'Processando...';

  try {
    const nome = document.getElementById('vchRapidoNome').value.trim();
    const tipo = document.getElementById('vchRapidoTipo').value;
    const dataUso = document.getElementById('vchRapidoData').value;
    const instrucao = document.getElementById('vchRapidoInstrucoes').value.trim();
    
    // Obter dados locais atualizados do cliente
    const resLocal = await fetch(`/api/clientes/local/${clienteId}?t=${Date.now()}`);
    const localData = await resLocal.json();
    if (!localData.vouchers) localData.vouchers = [];

    let voucherExistente = null;
    if (voucherId) {
      voucherExistente = localData.vouchers.find(v => v.id === voucherId);
    }

    let url = '';
    let fileName = '';
    let arquivos = [];

    if (tipo === 'qr_code' || tipo === 'pdf') {
      const fileInput = document.getElementById('vchRapidoFile');
      if (fileInput.files.length > 0) {
        // Lemos novos arquivos em paralelo
        const promessasLeitura = Array.from(fileInput.files).map(file => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({
              id: String(Date.now() + Math.random()),
              url: reader.result,
              fileName: file.name
            });
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
          });
        });
        
        arquivos = await Promise.all(promessasLeitura);
        url = arquivos[0].url;
        fileName = arquivos[0].fileName;
      } else {
        // Se for edição e não forneceu novos arquivos, mantém os arquivos anteriores
        if (voucherExistente && (voucherExistente.tipo === 'qr_code' || voucherExistente.tipo === 'pdf')) {
          arquivos = voucherExistente.arquivos || [];
          url = voucherExistente.url || '';
          fileName = voucherExistente.fileName || '';
        } else {
          throw new Error('Por favor, selecione ao menos um arquivo.');
        }
      }
    } else if (tipo === 'link') {
      url = document.getElementById('vchRapidoUrl').value.trim();
      if (!url) throw new Error('Por favor, insira a URL.');
      arquivos = [{ id: String(Date.now()), url, fileName: 'Link Externo' }];
    }

    if (voucherExistente) {
      // Editar existente
      voucherExistente.nome = nome;
      voucherExistente.tipo = tipo;
      voucherExistente.url = url;
      voucherExistente.fileName = fileName;
      voucherExistente.arquivos = arquivos;
      voucherExistente.atracaoNome = atracaoNome;
      voucherExistente.dataUso = dataUso;
      voucherExistente.instrucao = instrucao;
    } else {
      // Criar novo
      const novoVoucher = {
        id: String(Date.now() + Math.random()),
        nome,
        tipo,
        url,
        fileName,
        arquivos,
        atracaoNome,
        dataUso,
        instrucao
      };
      localData.vouchers.push(novoVoucher);
    }

    window.currentEditingVouchers = localData.vouchers;

    const saveRes = await fetch('/api/clientes/local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localData)
    });

    if (!saveRes.ok) throw new Error('Erro ao salvar no banco');
    
    alert(voucherExistente ? 'Ingresso atualizado com sucesso!' : 'Ingresso anexado com sucesso!');
    window.fecharModalUploadRapido();
    
    // Atualizar visualização simulando o clique do botão ativo de abas para recarregar com dados novos
    const activeTabBtn = document.querySelector('.tab-client-btn.active');
    if (activeTabBtn) {
      activeTabBtn.click();
    } else {
      const cli = typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === clienteId) : { id: clienteId };
      renderAbaRoteiros(cli);
    }

  } catch(err) {
    console.error(err);
    alert('Erro ao salvar ingresso: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = voucherId ? 'Salvar Alterações' : 'Enviar';
  }
};

window.visualizarVoucherAdmin = function(voucherId) {
  const tabBtn = document.querySelector('.tab-client-btn[data-tab="vouchers"]');
  if (tabBtn) {
    tabBtn.click();
    setTimeout(() => {
      const rows = document.querySelectorAll('.data-table tbody tr');
      rows.forEach(row => {
        if (row.innerHTML.includes(voucherId) || row.innerHTML.includes(`excluirVoucherCliente`)) {
          row.style.background = '#e6f7ed';
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            row.style.transition = 'background 1s';
            row.style.background = '';
          }, 3000);
        }
      });
    }, 400);
  }
};

function buildPreferenciasHTML(preferencias) {
  let prioridadesHTML = '';
  if (preferencias.prioridades && preferencias.prioridades.length > 0) {
    const prioArr = Array.isArray(preferencias.prioridades) ? preferencias.prioridades : [preferencias.prioridades];
    prioridadesHTML = prioArr.map(p => `
      <span style="display:inline-block; font-size:12px; background:rgba(196,163,90,0.06); border:1px solid rgba(196,163,90,0.25); color:var(--gold-dk); padding:4px 10px; border-radius:12px; margin-right:6px; margin-bottom:6px; font-weight:500;">${p}</span>
    `).join('');
  } else {
    prioridadesHTML = '<span style="font-size:12px; color:var(--ink-lt); font-style:italic;">Nenhuma prioridade selecionada</span>';
  }

  let toursHTML = '';
  if (preferencias.interessesTour && preferencias.interessesTour.length > 0) {
    const tourArr = Array.isArray(preferencias.interessesTour) ? preferencias.interessesTour : [preferencias.interessesTour];
    toursHTML = tourArr.map(t => `
      <span style="display:inline-block; font-size:12px; background:rgba(107,31,42,0.04); border:1px solid rgba(107,31,42,0.12); color:var(--crimson); padding:4px 10px; border-radius:12px; margin-right:6px; margin-bottom:6px; font-weight:500;">${t}</span>
    `).join('');
  }

  return `
    <div style="margin-top: 16px; border-top: 1px solid var(--border); padding-top: 24px;">
      <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold-dk); margin-bottom: 16px; font-weight: 600; display:inline-flex; align-items:center; gap:4px;">
        <svg class="v-icon" style="width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-star"></use></svg> Preferências & Perfil de Viagem
      </h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
        <!-- Card 1: Ritmo & Perfil Físico -->
        <div style="background: rgba(196,163,90,0.02); border: 1px solid var(--border); border-radius: 12px; padding: 16px; box-sizing: border-box;">
          <h4 style="font-size: 12px; color: var(--crimson); text-transform: uppercase; margin-top: 0; margin-bottom: 12px; font-weight: 600; letter-spacing:0.04em;">🏃 Ritmo & Estilo</h4>
          <div style="font-size: 13px; display: flex; flex-direction: column; gap: 8px; color: var(--ink-dk); line-height: 1.4;">
            <div><strong>Ritmo dos dias:</strong> ${preferencias.ritmo || 'Não informado'}</div>
            <div><strong>Visitas a Templos:</strong> ${preferencias.templos || 'Não informado'}</div>
            <div><strong>Caminhadas Diárias:</strong> ${preferencias.caminhada || 'Não informado'}</div>
            <div><strong>Alimentação no Dia a Dia:</strong> ${preferencias.refeicoes || 'Não informado'}</div>
          </div>
        </div>

        <!-- Card 2: Foco & Interesses -->
        <div style="background: rgba(196,163,90,0.02); border: 1px solid var(--border); border-radius: 12px; padding: 16px; box-sizing: border-box;">
          <h4 style="font-size: 12px; color: var(--crimson); text-transform: uppercase; margin-top: 0; margin-bottom: 12px; font-weight: 600; letter-spacing:0.04em;">🎯 Prioridades & Focos</h4>
          <div style="margin-bottom: 10px;">
            <div style="font-size: 11px; color: var(--ink-lt); margin-bottom: 6px; font-weight:500; text-transform: uppercase; letter-spacing: 0.05em;">Prioridades Gerais:</div>
            <div>${prioridadesHTML}</div>
          </div>
          ${toursHTML ? `
          <div>
            <div style="font-size: 11px; color: var(--ink-lt); margin-bottom: 6px; font-weight:500; text-transform: uppercase; letter-spacing: 0.05em;">Foco nos Tours Guiados:</div>
            <div>${toursHTML}</div>
          </div>
          ` : ''}
        </div>

        <!-- Card 3: Informações de Onboarding & Especial -->
        <div style="background: rgba(196,163,90,0.02); border: 1px solid var(--border); border-radius: 12px; padding: 16px; box-sizing: border-box;">
          <h4 style="font-size: 12px; color: var(--crimson); text-transform: uppercase; margin-top: 0; margin-bottom: 12px; font-weight: 600; letter-spacing:0.04em;">✨ Detalhes do Grupo</h4>
          <div style="font-size: 13px; display: flex; flex-direction: column; gap: 8px; color: var(--ink-dk); line-height: 1.4;">
            <div><strong>Primeira vez no Japão?</strong> ${preferencias.primeiraVez || 'Não informado'}</div>
            <div><strong>Interesse Sazonal:</strong> ${preferencias.experienciasSazonais || 'Não informado'}</div>
            ${preferencias.profissoes ? `<div><strong>Profissão dos Viajantes:</strong> ${preferencias.profissoes}</div>` : ''}
            ${preferencias.ocasiaoEspecial ? `<div style="background: rgba(196,163,90,0.06); padding: 8px 12px; border-radius: 6px; border-left: 3px solid var(--gold); margin-top: 4px; font-size: 12.5px; color: var(--ink-dk);">🎉 <strong>Celebração:</strong> ${preferencias.ocasiaoEspecial}</div>` : ''}
            ${preferencias.necessidadesEspeciais ? `<div style="background: rgba(220,53,69,0.03); padding: 8px 12px; border-radius: 6px; border-left: 3px solid var(--crimson); margin-top: 4px; font-size: 12.5px; color: var(--ink-dk);">⚠️ <strong>Necessidades Especiais:</strong> ${preferencias.necessidadesEspeciais}</div>` : ''}
          </div>
        </div>
      </div>

      ${preferencias.experienciasImperdiveis ? `
      <!-- Destaque: Experiências dos Sonhos -->
      <div style="background: rgba(107,31,42,0.02); border: 1px dashed rgba(107,31,42,0.25); border-radius: 12px; padding: 16px; margin-top: 16px; box-sizing: border-box;">
        <h4 style="font-size: 12px; color: var(--crimson); text-transform: uppercase; margin-top: 0; margin-bottom: 8px; font-weight: 600; letter-spacing:0.04em; display:flex; align-items:center; gap:4px;">🌸 Experiência dos Sonhos / Imperdível</h4>
        <p style="font-size: 13px; color: var(--ink-dk); font-style: italic; margin: 0; line-height: 1.5;">"${preferencias.experienciasImperdiveis}"</p>
      </div>
      ` : ''}
    </div>
  `;
}

function renderAbaDadosCliente(cliente, estadias, viajantes, emails) {
  if (!Array.isArray(estadias)) estadias = [];
  if (!Array.isArray(viajantes)) viajantes = [];
  if (!Array.isArray(emails)) emails = [];
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
        const tipo = (parseInt(v.idade) < 12 && !isNaN(parseInt(v.idade))) ? 'Criança:' : 'Adulto:';
        const ageStr = v.idade ? `${v.idade} anos` : '';
        return `<div style="padding:8px 12px; background:rgba(196,163,90,0.04); border:1px solid var(--border); border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:13px; color:var(--ink-dk);">${tipo} ${nomeCompleto}</span>
          <span style="font-size:12px; color:var(--ink-lt);">${ageStr}</span>
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
      return `<div style="font-size:13px; color:var(--ink-dk); padding:4px 0;">${e.email}${badge}</div>`;
    }).join('');
  } else if (cliente.email) {
    emailsHTML = `<div style="font-size:13px; color:var(--ink-dk); white-space:pre-wrap;">${cliente.email}</div>`;
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
            ${est.dataInicio && est.dataFim ? `${fmtDataBR(est.dataInicio)} a ${fmtDataBR(est.dataFim)}` : 'Sem período informado'}
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
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-lt); margin-bottom: 4px; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-plane"></use></svg> Voo de Chegada</div>
          <div style="font-size: 14px; color: var(--ink-dk); font-weight: 500;">${vooChegadaStr}</div>
        </div>
        <div>
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-lt); margin-bottom: 4px; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-plane"></use></svg> Voo de Partida</div>
          <div style="font-size: 14px; color: var(--ink-dk); font-weight: 500;">${vooPartidaStr}</div>
        </div>
      </div>

      <div>
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold-dk); margin-bottom: 12px; font-weight: 600; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon"><use href="#icon-users"></use></svg> Viajantes</h3>
        ${viajantesHTML}
      </div>

      <div>
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold-dk); margin-bottom: 12px; font-weight: 600; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon"><use href="#icon-file"></use></svg> E-mails</h3>
        ${emailsHTML}
      </div>

      <div>
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold-dk); margin-bottom: 12px; font-weight: 600;">Estadias e Hotéis</h3>
        <div class="preview-estadias-list">
          ${estadiasHTML}
        </div>
      </div>
      
      <div id="preferenciasContainer"></div>
    </div>
  `;

  // Busca assincronamente as preferências locais do cliente
  fetch(`/api/clientes/local/${cliente.id}?t=${Date.now()}`)
    .then(res => res.json())
    .then(localData => {
      if (localData && localData.preferencias) {
        const container = document.getElementById('preferenciasContainer');
        if (container) {
          container.innerHTML = buildPreferenciasHTML(localData.preferencias);
        }
      }
    })
    .catch(err => console.error("Erro ao carregar preferências locais no painel:", err));
}

function renderAbaRoteiros(cliente) {
  const contentDiv = document.getElementById('clientTabContent');
  if (!contentDiv) return;

  const clienteNome = cliente.nome || '';
  // Normaliza nomes para comparação (ignora acentos, caixa e espaços duplicados)
  const normNome = (n) => (n || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
  const alvoNome = normNome(clienteNome);
  const idNorm = (v) => (v || '').toString().replace(/-/g, '').toLowerCase();
  const alvoId = idNorm(cliente.id);

  // Roteiros vinculados a este cliente através das cotações (por nome e por ID imutável)
  const cotacoesDoCliente = (typeof state !== 'undefined' && state && Array.isArray(state.orcamentosDB) ? state.orcamentosDB : [])
    .filter(o => o && idNorm(o.notionClienteId) === alvoId);
  const roteirosViaCotacao = new Set(
    cotacoesDoCliente.filter(o => o.orcRoteiroVinculado || o.roteiroVinculado)
      .map(o => o.orcRoteiroVinculado || o.roteiroVinculado)
  );
  const roteiroIdsViaCotacao = new Set(
    cotacoesDoCliente.filter(o => o.roteiroId).map(o => o.roteiroId)
  );

  const roteiros = typeof dbRotas !== 'undefined' ? Object.entries(dbRotas)
    .filter(([nome, rot]) => {
      if (!rot) return false;
      if (rot.id && roteiroIdsViaCotacao.has(rot.id)) return true;
      if (idNorm(rot.notionClienteId) === alvoId) return true;
      if (rot.cliente && idNorm(rot.cliente.notionClienteId) === alvoId) return true;
      if (rot.cliente && alvoNome && normNome(rot.cliente.nome) === alvoNome) return true;
      if (roteirosViaCotacao.has(nome)) return true;
      return false;
    })
    .map(([nome, rot]) => ({ nome, ...rot })) : [];

  if (roteiros.length === 0) {
    contentDiv.innerHTML = `
      <div style="text-align:center; padding: 40px 20px;">
        <p style="color:var(--ink-lt); font-size:14px; margin-bottom:16px;">Nenhum roteiro vinculado a este cliente.</p>
        <button class="btn-primary" onclick="window.criarRoteiroParaCliente('${cliente.id}')" style="display:inline-flex; align-items:center; gap:8px; padding: 10px 18px; border-radius: 8px;">
          Criar Roteiro
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
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <span style="font-size:13px; color:var(--ink-lt); font-weight:500;">Histórico de Roteiros</span>
      <button class="btn-primary" onclick="window.criarRoteiroParaCliente('${cliente.id}')" style="display:inline-flex; align-items:center; gap:6px; padding: 6px 12px; font-size:12px; border-radius: 6px;">
        Novo Roteiro
      </button>
    </div>
    <div class="compact-cards-grid" style="margin-bottom:16px;">
      ${cardsHTML}
    </div>
    <div id="roteiroActivePreviewHeader" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding: 12px; background: #fafafa; border-radius: 8px; border: 1px solid var(--border);">
      <strong id="roteiroActiveTitle" style="color:var(--crimson); font-size:15px;"></strong>
      <div style="display:flex; gap:8px;">
        <button class="btn-secondary" id="btnSincronizarCalendarioPreview" style="padding: 6px 12px; font-size:12px; background:var(--crimson); color:white; border-color:var(--crimson); cursor:pointer; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="stroke:#fff; margin-right:2px;"><use href="#icon-calendar"></use></svg>Sincronizar Calendário</button>
        <button class="btn-secondary" id="btnAbrirRoteiroPreview" style="padding: 6px 12px; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="margin-right:2px;"><use href="#icon-edit"></use></svg>Abrir Editor</button>
        <button class="btn-secondary" id="btnExcluirRoteiroPreview" style="padding: 6px 12px; font-size:12px; color:#c00; border-color:#fee; cursor:pointer; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="stroke:#c00; margin-right:2px;"><use href="#icon-trash"></use></svg>Excluir</button>
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
        
        // Limpa o preview ativo
        const previewDiv = document.getElementById('roteiroActivePreview');
        if (previewDiv) {
          previewDiv.innerHTML = '<div style="color:var(--ink-lt); padding:20px; text-align:center;">Selecione um roteiro para ver a prévia.</div>';
        }
        if (typeof renderListaRoteiros === 'function') {
          renderListaRoteiros();
        }
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
          Criar Cotação
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
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <span style="font-size:13px; color:var(--ink-lt); font-weight:500;">Histórico de Cotações</span>
      <button class="btn-primary" onclick="window.criarCotacaoParaCliente('${cliente.id}')" style="display:inline-flex; align-items:center; gap:6px; padding: 6px 12px; font-size:12px; border-radius: 6px;">
        Nova Cotação
      </button>
    </div>
    <div class="compact-cards-grid" style="margin-bottom:16px;">
      ${cardsHTML}
    </div>
    <div id="cotacaoActivePreviewHeader" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding: 12px; background: #fafafa; border-radius: 8px; border: 1px solid var(--border);">
      <strong id="cotacaoActiveTitle" style="color:var(--crimson); font-size:15px;"></strong>
      <div style="display:flex; gap:8px;">
        <button class="btn-secondary" id="btnAbrirCotacaoPreview" style="padding: 6px 12px; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="margin-right:2px;"><use href="#icon-edit"></use></svg>Abrir Editor</button>
        <button class="btn-secondary" id="btnExcluirCotacaoPreview" style="padding: 6px 12px; font-size:12px; color:#c00; border-color:#fee; cursor:pointer; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="stroke:#c00; margin-right:2px;"><use href="#icon-trash"></use></svg>Excluir</button>
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

  const orc = state.orcamentosDB.find(o => String(o.id) === String(cotacaoId));
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
        
        // Limpa o preview ativo
        const previewDiv = document.getElementById('cotacaoActivePreview');
        if (previewDiv) {
          previewDiv.innerHTML = '<div style="color:var(--ink-lt); padding:20px; text-align:center;">Selecione uma cotação para ver o resumo.</div>';
        }
        if (typeof renderListaOrcamentos === 'function') {
          renderListaOrcamentos();
        }
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
  
  const btnImport = document.getElementById('btnImportNotion');
  if (btnImport) btnImport.style.display = 'none';
  ['clienteNome', 'clienteAdultos', 'clienteCriancas'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.readOnly = true; el.style.cssText = 'background:#f1f5f9; cursor:not-allowed'; }
  });
  const btnEditarCot = document.getElementById('btnEditarClienteCotacao');
  if(btnEditarCot) btnEditarCot.innerHTML = '👤 Editar Cliente';

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
  const orc = state.orcamentosDB.find(o => String(o.id) === String(orcId));
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

async function sincronizarCalendarioDoNotion() {
  const btn = document.getElementById('btnSyncNotionCalendario');
  if (!btn) return;

  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⌛ Sincronizando...';
  document.body.style.cursor = 'wait';

  try {
    const response = await fetch('/api/calendario/sincronizar-do-notion', {
      method: 'POST'
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Erro na requisição');
    }

    const data = await response.json();
    alert(`Calendário sincronizado com sucesso! ${data.count} eventos carregados do Notion.`);
    
    if (typeof renderCalendario === 'function') {
      renderCalendario();
    }
  } catch (err) {
    console.error(err);
    alert('Erro ao sincronizar calendário do Notion: ' + err.message);
  } finally {
    document.body.style.cursor = 'default';
    btn.disabled = false;
    btn.innerHTML = oldText;
  }
}
window.sincronizarCalendarioDoNotion = sincronizarCalendarioDoNotion;

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

function gerarEventCardHTML(ev, simplificado = false) {
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
  if (simplificado) {
    const guiasNomes = ev.assignee && ev.assignee.length > 0 ? ev.assignee.map(a => a.name).join(', ') : 'Nenhum guia designado';
    footerGuiaHTML = `
      <div style="border-top:1px solid var(--border); padding-top:4.2px; font-size:8.2px; color:var(--ink-mid); display:flex; align-items:center; gap:4px;">
        <span style="color:var(--ink-lt); display:inline-flex; align-items:center; gap:2px;"><svg class="v-icon no-margin" style="width:1em; height:1em;"><use href="#icon-user"></use></svg> Guia:</span> <strong>${guiasNomes}</strong>
      </div>
    `;
  } else {
    if (ev.assignee && ev.assignee.length > 1) {
      const chips = ev.assignee.map(a => 
        `<span class="colab-card-chip" style="background:rgba(107,31,42,0.06); color:var(--crimson); font-size:8px; font-weight:700; padding:1px 5px; border-radius:4px; display:inline-flex; align-items:center; gap:2px; border:1px solid rgba(107,31,42,0.12);">
          <svg class="v-icon no-margin" style="width:1em; height:1em;"><use href="#icon-user"></use></svg> ${a.name}
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
        return `<option value="${col.id}" ${col.id === guiaIdAtual ? 'selected' : ''}>${col.name}</option>`;
      }).join('');
      
      footerGuiaHTML = `
        <div style="border-top:1px solid var(--border); padding-top:4px; display:flex; align-items:center; justify-content:space-between; width:100%; gap:4px;" onclick="event.stopPropagation();">
          <div style="display:flex; align-items:center; gap:4px; flex-grow:1;">
            <span style="font-size:8px; font-weight:600; color:var(--ink-mid); white-space:nowrap; display:inline-flex; align-items:center; gap:2px;"><svg class="v-icon no-margin" style="width:1em; height:1em;"><use href="#icon-user"></use></svg> Guia:</span>
            <select onchange="atualizarGuiaRapidoLista('${ev.id}', this)" class="calendar-card-select" style="flex-grow:1; max-width:110px;">
              <option value="">Nenhum guia designado</option>
              ${optionsColaboradores}
            </select>
          </div>
          <button class="btn-secondary" style="margin:0; padding:1px 4px; font-size:8px; height:18px; line-height:1; border-radius:3px; border-color:var(--border);" onclick="abrirCalendarioEventModal('${ev.id}')" title="Designar múltiplos colaboradores">
            +
          </button>
        </div>
      `;
    }
  }

  // Badges e Cores
  let badgeBg = 'rgba(107,31,42,0.06)';
  let badgeColor = 'var(--crimson)';
  const tLower = ev.tipoServico ? ev.tipoServico.toLowerCase() : '';
  
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

  // Se for simplificado (popover), removemos o onclick do card para não atrapalhar no hover
  const clickAttr = simplificado ? '' : `onclick="abrirCalendarioEventModal('${ev.id}')"`;

  return `
    <div class="calendar-list-event-card card-type-${tipoClassSuffix}" ${clickAttr} style="${simplificado ? 'box-shadow:none; border:none; background:transparent; padding:0; margin:0;' : ''}">
      <!-- Parte Superior do Card -->
      <div style="display:flex; flex-direction:column; gap:3px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px;">
          <span class="compact-card-status" style="background:${badgeBg}; color:${badgeColor}; font-size:8px; text-transform:uppercase; padding:1px 4px; border-radius:3px; font-weight:600;">
            ${ev.tipoServico || 'Serviço'}
          </span>
          <span style="font-size:9px; font-weight:700; color:var(--ink-mid);">
            ${meetingTime}
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
}

function criarEventPopover() {
  let popover = document.getElementById('calendarioEventPopover');
  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'calendarioEventPopover';
    popover.className = 'calendar-event-popover';
    popover.style.display = 'none';
    document.body.appendChild(popover);
  }
}

function showEventPopover(e, eventId) {
  const badge = e.currentTarget;
  const ev = calEventos.find(item => item.id === eventId);
  if (!ev) return;

  criarEventPopover();
  const popover = document.getElementById('calendarioEventPopover');
  if (!popover) return;

  // Injetar o HTML do card simplificado
  popover.innerHTML = gerarEventCardHTML(ev, true);

  // Posicionar
  const rect = badge.getBoundingClientRect();
  let topPos = rect.bottom + 8;
  let leftPos = rect.left;

  // Ajustar se passar da altura ou largura da tela
  if (topPos + 180 > window.innerHeight) {
    topPos = rect.top - 190;
  }
  if (leftPos + 300 > window.innerWidth) {
    leftPos = window.innerWidth - 320;
  }
  if (leftPos < 10) leftPos = 10;

  popover.style.top = topPos + 'px';
  popover.style.left = leftPos + 'px';
  popover.style.display = 'block';
  // Forçar reflow para ativar transição de opacidade
  popover.offsetHeight; 
  popover.classList.add('visible');
}

function hideEventPopover() {
  const popover = document.getElementById('calendarioEventPopover');
  if (popover) {
    popover.classList.remove('visible');
    popover.style.display = 'none';
  }
}

async function atualizarDataEvento(eventId, novaData) {
  showToast('Atualizando data do serviço...');
  try {
    const res = await fetch(`/api/calendario/eventos/${eventId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dataServico: novaData })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Falha ao atualizar data no servidor');
    }
    
    // Atualizar no cache local de eventos
    const evIndex = calEventos.findIndex(e => e.id === eventId);
    if (evIndex > -1) {
      calEventos[evIndex].dataServico = novaData;
    }
    
    showToast('Data atualizada com sucesso!');
    await renderCalendario(); // Re-renderizar calendário
  } catch (err) {
    console.error('Erro ao mover evento:', err);
    alert('Erro ao alterar data do evento: ' + err.message);
    await renderCalendario(); // Resetar visual em caso de erro
  }
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
        window.calColaboradores = calColaboradores;
        // Popular dropdown no modal de edição
        const select = document.getElementById('calEventModalAssigneeSelect');
        if (select) {
          select.innerHTML = '<option value="">Nenhum guia designado</option>';
          calColaboradores.forEach(col => {
            select.innerHTML += `<option value="${col.id}">${col.name}</option>`;
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
  const hoje = new Date();
  const hojeReset = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  if (calViewMode === 'grid') {
    gridEl.innerHTML = '';

    const primeiroDiaSemana = new Date(ano, mes, 1).getDay(); // 0 (Dom) a 6 (Sáb)
    const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
    const totalDiasMesAnterior = new Date(ano, mes, 0).getDate();

    // Dias do Mês Anterior (células vazias/cinza)
    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
      const diaNum = totalDiasMesAnterior - i;
      let anoAnt = ano;
      let mesAnt = mes - 1;
      if (mesAnt < 0) {
        mesAnt = 11;
        anoAnt--;
      }
      const diaDataAnt = new Date(anoAnt, mesAnt, diaNum);
      const isPastAnt = diaDataAnt < hojeReset;

      gridEl.innerHTML += `
        <div class="calendar-cell other-month ${isPastAnt ? 'past-day' : ''}">
          <span class="calendar-cell-num">${diaNum}</span>
          <div class="calendar-events-list"></div>
        </div>
      `;
    }

    // Dias do Mês Atual
    for (let dia = 1; dia <= totalDiasMes; dia++) {
      const dateKey = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const isToday = hoje.getFullYear() === ano && hoje.getMonth() === mes && hoje.getDate() === dia;
      
      // Filtrar eventos do dia
      const eventosDia = calEventos.filter(ev => ev.dataServico === dateKey);

      let eventosHTML = eventosDia.map(ev => {
        let tipoClass = 'event-type-transfer';
        const tLower = ev.tipoServico ? ev.tipoServico.toLowerCase() : '';
        const titleLower = ev.titulo ? ev.titulo.toLowerCase() : '';
        const idLower = ev.id ? ev.id.toLowerCase() : '';

        if (idLower.startsWith('cal_exp_') || tLower.includes('experiência') || tLower.includes('experiencia') || titleLower.includes('disney') || titleLower.includes('universal') || titleLower.includes('teamlab') || titleLower.includes('sky') || titleLower.includes('museum') || titleLower.includes('ingresso') || titleLower.includes('atração') || titleLower.includes('atracao')) {
          tipoClass = 'event-type-experiencia';
        } else if (tLower.includes('roteiro') || tLower.includes('guia') || tLower.includes('tour') || titleLower.includes('tour') || titleLower.includes('guiado') || titleLower.includes('clássica') || titleLower.includes('classica') || titleLower.includes('oeste') || titleLower.includes('moderna')) {
          tipoClass = 'event-type-roteiro';
        } else {
          tipoClass = 'event-type-transfer';
        }
        
        const guiaText = ev.assignee.length > 0 ? ` [${ev.assignee.map(a => a.name).join(', ')}]` : '';
        return `
          <div class="calendar-event-badge calendar-event-item ${tipoClass} draggable-event" draggable="true" data-event-id="${ev.id}" onclick="event.stopPropagation(); abrirCalendarioEventModal('${ev.id}')">
            ${ev.titulo}${guiaText}
          </div>
        `;
      }).join('');

      const diaData = new Date(ano, mes, dia);
      const isPast = diaData < hojeReset;

      gridEl.innerHTML += `
        <div class="calendar-cell drop-zone-cell ${isToday ? 'today' : ''} ${isPast ? 'past-day' : ''}" data-date="${dateKey}">
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
      let anoSeg = ano;
      let mesSeg = mes + 1;
      if (mesSeg > 11) {
        mesSeg = 0;
        anoSeg++;
      }
      const diaDataSeg = new Date(anoSeg, mesSeg, dia);
      const isPastSeg = diaDataSeg < hojeReset;

      gridEl.innerHTML += `
        <div class="calendar-cell other-month ${isPastSeg ? 'past-day' : ''}">
          <span class="calendar-cell-num">${dia}</span>
          <div class="calendar-events-list"></div>
        </div>
      `;
    }

    // Adicionar listeners do Popover nas badges da grade
    gridEl.querySelectorAll('.calendar-event-badge').forEach(badge => {
      badge.addEventListener('mouseenter', (e) => {
        const evId = badge.getAttribute('data-event-id');
        showEventPopover(e, evId);
      });
      badge.addEventListener('mouseleave', hideEventPopover);
    });

    // Configurar listeners de Drag & Drop nas badges
    gridEl.querySelectorAll('.draggable-event').forEach(badge => {
      badge.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', badge.getAttribute('data-event-id'));
        badge.classList.add('dragging');
        hideEventPopover(); // Ocultar o popover no início do arraste
      });
      badge.addEventListener('dragend', () => {
        badge.classList.remove('dragging');
      });
    });

    // Configurar drop zones nas células de dia
    gridEl.querySelectorAll('.drop-zone-cell').forEach(cell => {
      cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        cell.classList.add('drag-over');
      });
      cell.addEventListener('dragleave', () => {
        cell.classList.remove('drag-over');
      });
      cell.addEventListener('drop', async (e) => {
        cell.classList.remove('drag-over');
        const eventId = e.dataTransfer.getData('text/plain');
        const novaData = cell.getAttribute('data-date');
        if (eventId && novaData) {
          await atualizarDataEvento(eventId, novaData);
        }
      });
    });
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

      const isPast = dateObj < hojeReset;

      let diaRowHTML = `
        <div class="calendar-list-day-row ${isPast ? 'past-day' : ''}">
          <!-- Coluna da Esquerda: Informações do Dia -->
          <div class="calendar-list-day-header">
            <div class="calendar-list-day-date">
              ${dataFormatada}
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
        diaRowHTML += gerarEventCardHTML(ev);
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
  document.getElementById('calEventModalData').innerText = fmtDataBR(ev.dataServico);

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
        specHTML += `<div style="font-weight:700; color:var(--crimson); font-size:12px; margin-bottom:12px; text-transform:uppercase;">Roteiro do Dia:</div>`;

        const parts = [];
        if (ev.horaEncontro) parts.push(`Encontro: <strong>${ev.horaEncontro}</strong><br>`);
        if (ev.localEncontro) parts.push(`Local: <strong>${ev.localEncontro}</strong><br>`);
        if (ev.duracaoTour) parts.push(`Duração: <strong>${ev.duracaoTour}</strong>`);
        
        if (parts.length > 0) {
          specHTML += `<div style="font-size:12px; background:#f9f6f6; border-left:3px solid var(--crimson); padding:8px 12px; border-radius:6px; margin-bottom:12px; color:var(--ink-mid); display:block; line-height:1.4;">${parts.join('')}</div>`;
        }

        if (ev.rotas && ev.rotas.length > 0) {
          specHTML += `<div style="font-size:12px; margin-bottom:8px; color:var(--ink);"><strong>Rotas:</strong> ${ev.rotas.join(' ➔ ')}</div>`;
        }
        
        if (ev.atracoes && ev.atracoes.length > 0) {
          const chipsHTML = ev.atracoes.map(atr => 
            `<span style="background:rgba(196,163,90,0.12); color:#8a703b; border:1px solid rgba(196,163,90,0.2); padding:3px 8px; border-radius:12px; font-size:11px; font-weight:600; display:inline-block; margin:2px 4px 2px 0;">${atr}</span>`
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
        specHTML += `<div style="font-weight:700; color:#9c8248; font-size:12px; margin-bottom:12px; text-transform:uppercase;">Detalhes do Transporte:</div>`;
        
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
        specHTML += `<div style="font-weight:700; color:#a3522b; font-size:12px; margin-bottom:12px; text-transform:uppercase;">Tickets & Experiências:</div>`;
        
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
              specHTML += `<div style="font-weight:700; color:var(--crimson); font-size:12px; margin-bottom:8px; text-transform:uppercase;">Roteiro do Dia:</div>`;

              infos.forEach(inf => {
                const parts = [];
                if (inf.horarioEncontro) parts.push(`${inf.horarioEncontro}`);
                if (inf.localEncontro) parts.push(`Encontro: ${inf.localEncontro}`);
                if (inf.duracaoTour) parts.push(`${inf.duracaoTour}`);
                if (parts.length > 0) {
                  specHTML += `<div style="font-size:11px; background:#f5f7fa; padding:6px 10px; border-radius:6px; margin-bottom:8px; color:var(--ink-mid);">${parts.join(' &nbsp;|&nbsp; ')}</div>`;
                }
              });

              sequencias.forEach(seq => {
                const cidadeName = seq.cidade ? `<strong style="color:var(--gold-dk);">${seq.cidade}:</strong> ` : '';
                const atrs = seq.atracoesDoDia && seq.atracoesDoDia.length > 0
                  ? seq.atracoesDoDia.map(a => `<span style="background:rgba(196,163,90,0.1); color:#9c8248; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600; display:inline-block; margin:2px 2px 2px 0;">${a.nome}</span>`).join(' ')
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
              specHTML += `<div style="font-weight:700; color:#9c8248; font-size:12px; margin-bottom:8px; text-transform:uppercase;">Detalhes do Transporte:</div>`;
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
              specHTML += `<div style="font-weight:700; color:#a3522b; font-size:12px; margin-bottom:8px; text-transform:uppercase;">Tickets & Experiências:</div>`;
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
    if (typeof filtrarDashColaborador === 'function') {
      filtrarDashColaborador();
    }
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
    if (typeof filtrarDashColaborador === 'function') {
      filtrarDashColaborador();
    }
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
      <div style="font-size:32px; margin-bottom:12px; animation:spin 2s linear infinite; display:inline-flex; align-items:center; justify-content:center;"><svg class="v-icon v-icon-lg" style="stroke:var(--gold-dk); width:40px; height:40px; margin-right:0;"><use href="#icon-clock"></use></svg></div>
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
let colabDashOrdemData = 'desc'; // Começa decrescente por padrão

window.alternarOrdemDataColab = function() {
  colabDashOrdemData = colabDashOrdemData === 'asc' ? 'desc' : 'asc';
  
  const icones = [document.getElementById('colabOrdemDataIcon'), document.getElementById('colabOrdemDataIconFin')];
  icones.forEach(icon => {
    if (icon) icon.innerText = colabDashOrdemData === 'asc' ? ' ▲' : ' ▼';
  });
  
  filtrarDashColaborador();
};

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
  if (typeof window.mostrarDetailMobile === 'function') {
    window.mostrarDetailMobile('page-colaboradores');
  }
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
        const cleanDate = ev.dataServico.includes('T') ? ev.dataServico.split('T')[0] : ev.dataServico;
        const [y, m] = cleanDate.split('-');
        periodos.add(`${y}-${m}`);
      }
    });
    
    const prevVal = filtroPeriodo.value || 'all';
    const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    let optionsHTML = '<option value="all">Todo o período</option>';
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
      const cleanDate = ev.dataServico.includes('T') ? ev.dataServico.split('T')[0] : ev.dataServico;
      const [y, m] = cleanDate.split('-');
      return `${y}-${m}` === periodSelected;
    });
  }
  
  // Ordenar tours por data (crescente ou decrescente)
  tours.sort((a, b) => {
    return colabDashOrdemData === 'asc'
      ? a.dataServico.localeCompare(b.dataServico)
      : b.dataServico.localeCompare(a.dataServico);
  });
  
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
        const dataFormatada = fmtDataBR(ev.dataServico);
        
        let localStr = ev.localEncontro || '-';
        if (!localStr && ev.cidade) localStr = ev.cidade;
        
        return `
          <tr style="border-bottom:1px solid var(--border); transition: background 0.15s;">
            <td style="padding:12px 16px; font-size:12px; color:var(--ink-dk); font-weight:600;">${dataFormatada}</td>
            <td style="padding:12px 16px; font-size:12px; color:var(--ink-dk); font-weight:600;">${ev.clienteNome || 'Cliente'}</td>
            <td style="padding:12px 16px; font-size:12px; cursor:pointer;" class="colab-servico-popover" data-id="${ev.id}" onclick="abrirCalendarioEventModal('${ev.id}')">
              <span class="compact-card-status" style="font-size:8px; text-transform:uppercase; padding:1px 4px; border-radius:3px; font-weight:600; background:rgba(0,0,0,0.04); color:var(--ink-mid);">
                ${ev.tipoServico}
              </span>
              <strong style="margin-left:4px; font-size:12px; color:var(--ink-dk);">${ev.titulo}</strong>
            </td>
            <td style="padding:12px 16px; font-size:12px; color:var(--ink-mid);">${ev.horaEncontro || '-'}</td>
            <td style="padding:12px 16px; font-size:12px; color:var(--ink-mid);">${localStr}</td>
            <td style="padding:12px 16px; font-size:12px; text-align:right;">
              <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center;">
                <button class="btn-secondary" style="margin:0; padding:4px 8px; font-size:11px; border-radius:4px; border-color:var(--border);" onclick="enviarLembreteTrabalho('${ev.id}', 'email')">
                  E-mail
                </button>
                <button class="btn-secondary" style="margin:0; padding:4px 8px; font-size:11px; border-radius:4px; border-color:#25D366; color:#25D366; background:#f0fff4;" onclick="enviarLembreteTrabalho('${ev.id}', 'whatsapp')">
                  WhatsApp
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
      
      const dataFormatada = fmtDataBR(ev.dataServico);
      
      return `
        <tr style="border-bottom:1px solid var(--border); transition: background 0.15s;">
          <td style="padding:12px 16px; font-size:12px; color:var(--ink-dk); font-weight:600;">${dataFormatada}</td>
          <td style="padding:12px 16px; font-size:12px; color:var(--ink-dk); font-weight:600;">${ev.clienteNome || 'Cliente'}</td>
          <td style="padding:12px 16px; font-size:12px; cursor:pointer;" class="colab-servico-popover" data-id="${ev.id}" onclick="abrirCalendarioEventModal('${ev.id}')">
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
              <option value="false" ${!isPago ? 'selected' : ''}>Pendente</option>
               <option value="true" ${isPago ? 'selected' : ''}>Pago</option>
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

    // Adicionar listeners para o popover flutuante nos serviços
    tbodyFinanceiro.querySelectorAll('.colab-servico-popover').forEach(el => {
      el.addEventListener('mouseenter', (e) => showEventPopover(e, el.getAttribute('data-id')));
      el.addEventListener('mouseleave', hideEventPopover);
    });
  }
  
  // Adicionar listeners para o popover flutuante nos serviços da tabela de escala também
  if (tbodyEscala) {
    tbodyEscala.querySelectorAll('.colab-servico-popover').forEach(el => {
      el.addEventListener('mouseenter', (e) => showEventPopover(e, el.getAttribute('data-id')));
      el.addEventListener('mouseleave', hideEventPopover);
    });
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
  
  // Buscar evento original para checar status anterior
  const ev = typeof calEventos !== 'undefined' ? calEventos.find(e => e.id === eventoId) : null;
  const colab = typeof calColaboradores !== 'undefined' ? calColaboradores.find(x => x.id === colabId) : null;
  const colabName = colab ? colab.name : 'Colaborador';
  const isOriginallyPago = ev && ev.pagoColab && ev.pagoColab[colabId] === true;

  // Se o usuário mudou para Pago mas antes não estava Pago, abre o modal de Pagamento do Notion
  if (pago && !isOriginallyPago) {
    if (typeof window.iniciarPagamentoGuia === 'function') {
      window.iniciarPagamentoGuia(eventoId, colabId, colabName, ev ? ev.titulo : 'Serviço', valor, ev ? ev.clienteId : null);
      return;
    }
  }
  
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
  
  const dataFormatada = fmtDataBR(ev.dataServico);
  
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

// ── FUNÇÕES PARA CADASTRO MANUAL DE EVENTOS OPERACIONAIS ───────────────────
console.log("[Novo Evento] Script app.js com cadastro de eventos carregado (v20260612_v2).");

window.abrirModalCriarEventoCalendario = function() {
  console.log("[Novo Evento] abrirModalCriarEventoCalendario() chamada.");
  // 1. Carregar clientes no select
  const selectCli = document.getElementById('modalCriarEvCliente');
  if (selectCli) {
    selectCli.innerHTML = '<option value="cliente_desconhecido">Nenhum / Cliente Avulso</option>';
    if (typeof notionClients !== 'undefined' && notionClients.length > 0) {
      notionClients.forEach(c => {
        selectCli.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
      });
    }
  }

  // 2. Carregar colaboradores no container
  const containerGuias = document.getElementById('modalCriarEvGuiasContainer');
  if (containerGuias) {
    if (typeof calColaboradores !== 'undefined' && calColaboradores.length > 0) {
      containerGuias.innerHTML = calColaboradores.map(col => `
        <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--ink-dk); cursor:pointer; margin:0;">
          <input type="checkbox" class="modal-criar-ev-guia-checkbox" value="${col.id}" style="width:14px; height:14px; margin:0; cursor:pointer;">
          <span>${col.name}</span>
        </label>
      `).join('');
    } else {
      containerGuias.innerHTML = '<span style="font-size:11px; color:var(--ink-lt);">Nenhum colaborador carregado</span>';
    }
  }

  // 3. Carregar contas do Notion no select contábil
  const selectConta = document.getElementById('modalCriarEvConta');
  if (selectConta) {
    selectConta.innerHTML = '<option value="">Carregando contas...</option>';
    fetch('/api/notion/contas')
      .then(res => res.json())
      .then(contas => {
        selectConta.innerHTML = '';
        if (contas && contas.length > 0) {
          contas.forEach(c => {
            selectConta.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
          });
        } else {
          selectConta.innerHTML = '<option value="">Nenhuma conta encontrada</option>';
        }
      })
      .catch(err => {
        console.error('Erro ao carregar contas:', err);
        selectConta.innerHTML = '<option value="">Erro ao obter contas</option>';
      });
  }

  // 4. Resetar inputs e campos
  document.getElementById('modalCriarEvTitulo').value = '';
  document.getElementById('modalCriarEvCidade').value = '';
  document.getElementById('modalCriarEvValorDiaria').value = '';
  document.getElementById('modalCriarEvTourHora').value = '';
  document.getElementById('modalCriarEvTourLocal').value = '';
  document.getElementById('modalCriarEvTourDuracao').value = '';
  document.getElementById('modalCriarEvTranspHora').value = '';
  document.getElementById('modalCriarEvTranspOrigem').value = '';
  document.getElementById('modalCriarEvTranspDestino').value = '';
  document.getElementById('modalCriarEvTranspLinha').value = '';
  document.getElementById('modalCriarEvTranspCategoria').value = '';
  document.getElementById('modalCriarEvTranspTempo').value = '';
  document.getElementById('modalCriarEvExpNome').value = '';
  document.getElementById('modalCriarEvExpHora').value = '';
  document.getElementById('modalCriarEvExpLocalEncontro').value = '';
  document.getElementById('modalCriarEvPassageiros').value = '2';
  document.getElementById('modalCriarEvObservacoes').value = '';

  // Resetar contabilidade
  document.getElementById('modalCriarEvCustoValor').value = '';
  const checkLancar = document.getElementById('modalCriarEvLancarFinanceiro');
  if (checkLancar) checkLancar.checked = false;
  window.onLancarFinanceiroChange();

  // Resetar data
  const inputData = document.getElementById('modalCriarEvData');
  if (inputData) {
    const hoje = new Date();
    const y = hoje.getFullYear();
    const m = String(hoje.getMonth() + 1).padStart(2, '0');
    const d = String(hoje.getDate()).padStart(2, '0');
    inputData.value = `${y}-${m}-${d}`;
  }

  // Forçar Roteiro padrão
  document.getElementById('modalCriarEvTipoServico').value = 'Roteiro';
  window.onTipoServicoCriarChange();

  // Exibir Modal
  const modal = document.getElementById('modalAdicionarEventoCalendario');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    modal.classList.add('active');
  }
};

window.fecharModalCriarEventoCalendario = function() {
  const modal = document.getElementById('modalAdicionarEventoCalendario');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
    modal.classList.remove('active');
  }
};

window.onTipoServicoCriarChange = function() {
  const tipo = document.getElementById('modalCriarEvTipoServico').value;
  document.getElementById('modalCriarEvPainelTour').style.display = tipo === 'Roteiro' ? 'block' : 'none';
  document.getElementById('modalCriarEvPainelTransporte').style.display = tipo === 'Transporte' ? 'block' : 'none';
  document.getElementById('modalCriarEvPainelExperiencia').style.display = tipo === 'Experiência' ? 'block' : 'none';
  
  // Atualizar contabilidade
  window.atualizarVisibilidadeSecaoContabil();
};

window.atualizarVisibilidadeSecaoContabil = function() {
  const tipo = document.getElementById('modalCriarEvTipoServico').value;
  let emitidoHeian = false;

  if (tipo === 'Transporte') {
    const radio = document.querySelector('input[name="modalCriarEvTranspCompradoHeian"]:checked');
    emitidoHeian = radio ? radio.value === 'sim' : true;
  } else if (tipo === 'Experiência') {
    const radio = document.querySelector('input[name="modalCriarEvExpCompradoHeian"]:checked');
    emitidoHeian = radio ? radio.value === 'sim' : true;
  }

  const secao = document.getElementById('modalCriarEvSecaoContabil');
  if (secao) {
    secao.style.display = (emitidoHeian && (tipo === 'Transporte' || tipo === 'Experiência')) ? 'block' : 'none';
  }
};

window.onLancarFinanceiroChange = function() {
  const checkbox = document.getElementById('modalCriarEvLancarFinanceiro');
  const contaWrapper = document.getElementById('modalCriarEvContaWrapper');
  if (contaWrapper) {
    contaWrapper.style.display = checkbox && checkbox.checked ? 'block' : 'none';
  }
};

window.salvarNovoEventoCalendario = function() {
  const titulo = document.getElementById('modalCriarEvTitulo').value.trim();
  const tipoServico = document.getElementById('modalCriarEvTipoServico').value;
  const dataServico = document.getElementById('modalCriarEvData').value;

  if (!titulo || !dataServico) {
    alert('Por favor, preencha os campos obrigatórios (*): Título e Data do Serviço.');
    return;
  }

  const clienteId = document.getElementById('modalCriarEvCliente').value;
  const cidade = document.getElementById('modalCriarEvCidade').value.trim();
  const passageiros = document.getElementById('modalCriarEvPassageiros').value || 2;
  const observacoes = document.getElementById('modalCriarEvObservacoes').value.trim();

  let richData = {};
  let valorDiaria = null;
  let assigneeIds = [];
  
  // Coletar dados contábeis se visíveis
  let lancarFinanceiro = false;
  let contaFinanceiraId = null;
  let valorCusto = null;

  const secaoContabil = document.getElementById('modalCriarEvSecaoContabil');
  if (secaoContabil && secaoContabil.style.display !== 'none') {
    valorCusto = Number(document.getElementById('modalCriarEvCustoValor').value) || null;
    const checkLancar = document.getElementById('modalCriarEvLancarFinanceiro');
    lancarFinanceiro = checkLancar ? checkLancar.checked : false;
    if (lancarFinanceiro) {
      contaFinanceiraId = document.getElementById('modalCriarEvConta').value;
      if (!contaFinanceiraId || !valorCusto) {
        alert('Por favor, defina o Valor do Custo e selecione a Conta de Origem para lançar na contabilidade.');
        return;
      }
    }
  }

  if (tipoServico === 'Roteiro') {
    valorDiaria = Number(document.getElementById('modalCriarEvValorDiaria').value) || null;
    richData = {
      horaEncontro: document.getElementById('modalCriarEvTourHora').value.trim(),
      localEncontro: document.getElementById('modalCriarEvTourLocal').value.trim(),
      duracaoTour: document.getElementById('modalCriarEvTourDuracao').value.trim()
    };
    const checkboxes = document.querySelectorAll('.modal-criar-ev-guia-checkbox:checked');
    checkboxes.forEach(cb => assigneeIds.push(cb.value));
  } else if (tipoServico === 'Transporte') {
    const radioComp = document.querySelector('input[name="modalCriarEvTranspCompradoHeian"]:checked');
    richData = {
      tipoTransporte: document.getElementById('modalCriarEvTranspTipo').value,
      horario: document.getElementById('modalCriarEvTranspHora').value.trim(),
      origem: document.getElementById('modalCriarEvTranspOrigem').value.trim(),
      destino: document.getElementById('modalCriarEvTranspDestino').value.trim(),
      linha: document.getElementById('modalCriarEvTranspLinha').value.trim(),
      categoria: document.getElementById('modalCriarEvTranspCategoria').value.trim(),
      tempo: document.getElementById('modalCriarEvTranspTempo').value.trim(),
      adultos: passageiros,
      compradoHeian: radioComp ? radioComp.value === 'sim' : true
    };
  } else if (tipoServico === 'Experiência') {
    const radioComp = document.querySelector('input[name="modalCriarEvExpCompradoHeian"]:checked');
    richData = {
      nomeExp: document.getElementById('modalCriarEvExpNome').value.trim() || titulo,
      horaPartida: document.getElementById('modalCriarEvExpHora').value.trim(),
      localEncontro: document.getElementById('modalCriarEvExpLocalEncontro').value.trim(),
      adultos: passageiros,
      compradoHeian: radioComp ? radioComp.value === 'sim' : true,
      observacoes: observacoes
    };
  }

  const btn = document.getElementById('btnConfirmarCriarEvento');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Salvando...';
  }

  fetch('/api/calendario/eventos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      titulo,
      tipoServico,
      dataServico,
      clienteId,
      cidade,
      valorDiaria,
      assigneeIds,
      observacoes,
      richData,
      lancarFinanceiro,
      contaFinanceiraId,
      valorCusto
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success && data.event) {
      alert('Evento cadastrado e sincronizado com sucesso!');
      if (typeof calEventos !== 'undefined') {
        calEventos.push(data.event);
      }
      window.fecharModalCriarEventoCalendario();
      if (typeof carregarCalendario !== 'undefined') {
        carregarCalendario();
      } else {
        window.location.reload();
      }
    } else {
      alert('Erro ao salvar o evento: ' + (data.error || 'Erro desconhecido'));
    }
  })
  .catch(err => {
    console.error('Erro na requisição:', err);
    alert('Erro ao conectar com o servidor para salvar o evento.');
  })
  .finally(() => {
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Salvar Evento';
    }
  });
};


