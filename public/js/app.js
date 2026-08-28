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
  const respostas = [tRes, eRes, aRes, rRes, hRes];
  const nomes = ['Transportes','Experiências','Atrações','Rotas','Hotéis'];
  for (let i = 0; i < respostas.length; i++) {
    if (!respostas[i].ok) throw new Error(`${nomes[i]} indisponível (HTTP ${respostas[i].status})`);
  }
  const dados = await Promise.all(respostas.map(r => r.json()));
  for (let i = 0; i < dados.length; i++) {
    if (!Array.isArray(dados[i])) throw new Error(`${nomes[i]} retornou um formato inválido`);
  }
  [state.transportesDB, state.experienciasDB, state.atracoesDB, state.rotasDB, state.hoteisDB] = dados;
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

// ── Indicador de status de salvamento da cotação (Salvando / Salvo / Não salvou) ──
function setSaveStatus(status) {
  const ind = document.getElementById('autoSaveIndicator');
  if (!ind) return;
  const map = {
    pending: { t: '• Alterações não salvas…',          c: '#b8860b', b: '600' },
    saving:  { t: 'Salvando…',                          c: '#b8860b', b: '700' },
    saved:   { t: '✓ Salvo',                            c: '#2e7d32', b: '600' },
    error:   { t: '⚠ NÃO salvou — clique para tentar',  c: '#c0392b', b: '700' }
  };
  const st = map[status] || map.saved;
  ind.textContent = st.t;
  ind.style.color = st.c;
  ind.style.opacity = '1';
  ind.style.fontWeight = st.b;
  ind.style.cursor = (status === 'error') ? 'pointer' : 'default';
  ind.onclick = (status === 'error') ? function(){ const o = (typeof montarOrcParaSalvar === 'function') ? montarOrcParaSalvar() : state.orcamento; _persistOrc(o); } : null;
  if (status === 'saved') { setTimeout(function(){ if (ind.textContent === '✓ Salvo') ind.style.opacity = '0.5'; }, 2000); }
}
async function _persistOrc(orc) {
  setSaveStatus('saving');
  let ok = false;
  try { ok = await saveOrcamentoToCloud(orc); } catch (e) { ok = false; }
  setSaveStatus(ok ? 'saved' : 'error');
  return ok;
}

function salvarOrcamentoAtual() {
  const nome = document.getElementById('orcNome').value.trim() || ('Cotação ' + fmtDate(nowISO()));
  const orc = {
    ...state.orcamento,
    id: state.orcamento.id || (state.orcamento.roteiroId ? ('cot_' + state.orcamento.roteiroId) : Date.now()),
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
  
  _persistOrc(orc);
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
    id: state.orcamento.id || (state.orcamento.roteiroId ? ('cot_' + state.orcamento.roteiroId) : Date.now()),
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
  setSaveStatus('pending'); // feedback imediato: há mudança ainda não gravada
  _autoSaveTimer = setTimeout(async () => {
    if (typeof window.registrarEstadoCotacao === 'function') {
      window.registrarEstadoCotacao(state.orcamento);
    }
    const temConteudoPre = document.getElementById('clienteNome').value.trim();
    const orc = montarOrcParaSalvar();
    const temConteudo = orc.tours.length || orc.transportes.length
      || orc.experiencias.length || (orc.estadias || []).length
      || temConteudoPre;
    if (!temConteudo) { setSaveStatus('saved'); return; }

    // Nada mudou desde a última gravação? Não grava.
    const sig = orcSignature(orc);
    if (sig && sig === _lastSavedOrcSig) { setSaveStatus('saved'); return; }

    const idx = state.orcamentosDB.findIndex(o => o.id === orc.id);
    if (idx > -1) state.orcamentosDB[idx] = orc;
    else state.orcamentosDB.unshift(orc);
    state.orcamento = orc;
    const ok = await _persistOrc(orc);
    if (ok) _lastSavedOrcSig = sig;
    renderListaOrcamentos();
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
  if (state && state.orcamento) normalizeOrcamentoIds(state.orcamento);

  let linkedRoteiroNome = orc.orcRoteiroVinculado || orc.roteiroVinculado;
  // FASE 2 — fallback por roteiroId: cotações como a do Haddad têm só `roteiroId` (nome vazio).
  // Sem isto, a cotação NUNCA re-deriva do roteiro e as duas divergem (cópia velha na tela).
  if (!linkedRoteiroNome && orc.roteiroId && typeof window.chaveRoteiroPorId === 'function') {
    linkedRoteiroNome = window.chaveRoteiroPorId(orc.roteiroId);
  }
  if (linkedRoteiroNome && typeof dbRotas !== 'undefined' && dbRotas[linkedRoteiroNome] && typeof window.roteiroParaCotacao === 'function') {
    window.roteiroParaCotacao(dbRotas[linkedRoteiroNome], linkedRoteiroNome, false, { silent: true });
  }

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
  if (state && state.orcamento) normalizeOrcamentoIds(state.orcamento);
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
                 onclick="abrirOrcamento('${orc.id}', false)">
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
  if (targetPg === 'solicitacoes' && typeof renderSolicitacoes === 'function') renderSolicitacoes();
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
    } else if (restore === 'roteiros') {
      navToPage('roteiros');
      const lastRotNome = localStorage.getItem('heian_last_roteiro_nome') || localStorage.getItem('heian_last_roteiro');
      if (lastRotNome) {
        setTimeout(() => {
          if (typeof dbRotas !== 'undefined' && dbRotas[lastRotNome] && typeof window.editarRoteiroCard === 'function') {
            window.editarRoteiroCard(lastRotNome);
          }
        }, 150);
      }
    } else navToPage(restore);
  } else {
    history.replaceState({ page: 'dashboard' }, '', '#dashboard');
    navToPage('dashboard');
  }
}

// ── CONSTRUTOR DE COTAÇÃO → movido para public/js/app-cotacao.js (Fatia 5, 2026-07-28) ──


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
// Agrupamento por cidade nas tabelas da Base (cabeçalho estilizado + itens). rowFn = função que monta o <tr>.
function _baseGrupoHeader(colspan, texto) {
  return '<tr class="categoria-header-row" style="background: rgba(196, 163, 90, 0.06); pointer-events: none;"><td colspan="' + colspan + '" style="color: var(--gold-dk); font-weight: 700; padding: 12px 16px; font-size: 11px; font-family: var(--ff-display); text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid rgba(196,163,90,0.25);">' + texto + '</td></tr>';
}
function _agrupaBaseCidade(lista, getCidade, colspan, rowFn) {
  const grupos = {};
  lista.forEach(function (it) { var c = String(getCidade(it) || '').trim(); c = c || 'Geral'; (grupos[c] = grupos[c] || []).push(it); });
  const cidades = Object.keys(grupos).sort(function (a, b) { if (a === 'Geral') return 1; if (b === 'Geral') return -1; return a.localeCompare(b); });
  let html = '';
  cidades.forEach(function (cid) { html += _baseGrupoHeader(colspan, '📍 ' + cid + ' (' + grupos[cid].length + ')'); html += grupos[cid].map(rowFn).join(''); });
  return html;
}
function renderTabelaTransportes(filtro) {
  if (filtro === undefined) {
    const el = document.getElementById('searchTransporte');
    filtro = el ? el.value : '';
  }
  const tbody = document.querySelector('#tabelaTransportes tbody');
  if(!tbody) return;
  const lista = filtro ? state.transportesDB.filter(t=>[t.trecho,t.tipo,t.linha,t.categoria].join(' ').toLowerCase().includes(filtro.toLowerCase())) : state.transportesDB;
  
  const getTransportCategory = (t) => {
    const tipo = String(t.tipo || '').toLowerCase();
    const linha = String(t.linha || '').toLowerCase();
    const cat = String(t.categoria || '').toLowerCase();
    
    // 1. Shinkansen / Trem Bala / Limited Express / Romancecar
    if (tipo.includes('trem bala') || tipo.includes('shinkansen') || linha.includes('shinkansen') || 
        tipo.includes('limited express') || linha.includes('limited express') || cat.includes('limited express') ||
        tipo.includes('romancecar') || linha.includes('romancecar')) {
      return { id: 1, name: 'Shinkansen & Limited Express' };
    }
    // 2. Transfer / Carro Privado / Táxi / Taxi
    if (tipo.includes('transfer') || tipo.includes('carro privado') || tipo.includes('táxi') || tipo.includes('taxi') || 
        linha.includes('transfer') || linha.includes('privado')) {
      return { id: 2, name: 'Transfers & Carros Privados' };
    }
    // 3. Ônibus
    if (tipo.includes('ônibus') || tipo.includes('onibus') || linha.includes('ônibus') || linha.includes('onibus')) {
      return { id: 3, name: 'Ônibus' };
    }
    // 4. Outros
    return { id: 4, name: 'Outros Meios de Transporte (Metrô, Trem Local, etc.)' };
  };

  // Separa por categoria
  const categorias = {
    1: { name: 'Shinkansen & Limited Express', items: [] },
    2: { name: 'Transfers & Carros Privados', items: [] },
    3: { name: 'Ônibus', items: [] },
    4: { name: 'Outros Meios de Transporte (Metrô, Trem Local, etc.)', items: [] }
  };

  lista.forEach(t => {
    const cat = getTransportCategory(t);
    categorias[cat.id].items.push(t);
  });

  // Ordena os itens dentro de cada categoria por Trecho, depois por Tipo, depois por Idade
  const sortItems = (arr) => {
    return arr.sort((a, b) => {
      const treA = String(a.trecho || '').trim().toLowerCase();
      const treB = String(b.trecho || '').trim().toLowerCase();
      if (treA !== treB) return treA.localeCompare(treB);
      const tipA = String(a.tipo || '').trim().toLowerCase();
      const tipB = String(b.tipo || '').trim().toLowerCase();
      if (tipA !== tipB) return tipA.localeCompare(tipB);
      const idaA = String(a.idade || '').trim().toLowerCase();
      const idaB = String(b.idade || '').trim().toLowerCase();
      return idaA.localeCompare(idaB);
    });
  };

  let html = '';
  [1, 2, 3, 4].forEach(catId => {
    const cat = categorias[catId];
    if (cat.items.length > 0) {
      // Cabeçalho da categoria visual estilizado
      html += `<tr class="categoria-header-row" style="background: rgba(196, 163, 90, 0.06); pointer-events: none;">
        <td colspan="8" style="color: var(--gold-dk); font-weight: 700; padding: 12px 16px; font-size: 11px; font-family: var(--ff-display); text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid rgba(196,163,90,0.25);">
          ${cat.name} (${cat.items.length})
        </td>
      </tr>`;
      
      // Itens da categoria
      const sorted = sortItems(cat.items);
      html += sorted.map(t=>`<tr><td>${t.trecho}</td><td>${t.idade||''}</td><td>${t.tipo}</td><td>${t.linha}</td><td>${t.categoria}</td><td class="preco-cell">¥${fmt(t.preco_jpy)}</td><td>${t.tempo||'—'}</td><td><button class="btn-icon" onclick="abrirModalTransporte('${t.id}')" title="Editar"><svg class="v-icon no-margin"><use href="#icon-edit"></use></svg></button> <button class="btn-icon" onclick="deletarTransporte('${t.id}')" title="Excluir"><svg class="v-icon no-margin" style="stroke:#c00;"><use href="#icon-trash"></use></svg></button></td></tr>`).join('');
    }
  });

  tbody.innerHTML = html;
}
function renderTabelaExperiencias(filtro) {
  if (filtro === undefined) {
    const el = document.getElementById('searchExperiencia');
    filtro = el ? el.value : '';
  }
  const tbody = document.querySelector('#tabelaExperiencias tbody');
  if(!tbody) return;
  const lista = filtro ? state.experienciasDB.filter(e=>[e.nome, e.cidade||'', e.tipo||''].join(' ').toLowerCase().includes(filtro.toLowerCase())) : state.experienciasDB;
  
  // Agrupar por cidade
  const grupos = {};
  lista.forEach(e => {
    const cidRaw = String(e.cidade || '').trim();
    const cidName = cidRaw ? cidRaw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : 'Geral';
    if (!grupos[cidName]) {
      grupos[cidName] = [];
    }
    grupos[cidName].push(e);
  });

  // Ordenar os nomes das cidades
  const cidadesOrdenadas = Object.keys(grupos).sort((a, b) => {
    if (a === 'Geral') return 1; // Geral vai por último
    if (b === 'Geral') return -1;
    return a.localeCompare(b);
  });

  let html = '';
  cidadesOrdenadas.forEach(cid => {
    const items = grupos[cid];
    // Cabeçalho da Cidade visual estilizado
    html += `<tr class="categoria-header-row" style="background: rgba(196, 163, 90, 0.06); pointer-events: none;">
      <td colspan="5" style="color: var(--gold-dk); font-weight: 700; padding: 12px 16px; font-size: 11px; font-family: var(--ff-display); text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid rgba(196,163,90,0.25);">
        📍 Experiências em ${cid} (${items.length})
      </td>
    </tr>`;

    // Ordenar itens da cidade pelo nome
    const sortedItems = [...items].sort((a, b) => {
      const nomA = String(a.nome || '').trim().toLowerCase();
      const nomB = String(b.nome || '').trim().toLowerCase();
      return nomA.localeCompare(nomB);
    });

    html += sortedItems.map(e=>`<tr><td>${e.nome}</td><td>${e.tipo}</td><td class="preco-cell">¥${fmt(e.preco_jpy)}</td><td>${e.observacao||'—'}</td><td><button class="btn-icon" onclick="abrirModalExperiencia('${e.id}')" title="Editar"><svg class="v-icon no-margin"><use href="#icon-edit"></use></svg></button> <button class="btn-icon" onclick="deletarExperiencia('${e.id}')" title="Excluir"><svg class="v-icon no-margin" style="stroke:#c00;"><use href="#icon-trash"></use></svg></button></td></tr>`).join('');
  });

  tbody.innerHTML = html;
}
async function apiBaseRequest(url, options = {}) {
  const response = await fetch(url, options);
  let data = null;
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Erro HTTP ${response.status}`);
  }
  return data;
}
function feedbackBase(data, label) {
  if (data?._syncSheets?.queued) {
    showToast(`${label} salvo no App. Sheets entrou na fila de recuperação.`, '#b45309');
  } else if (data?._syncSheets && data._syncSheets.ok === false) {
    showToast(`${label} salvo no App, mas o Sheets precisa de atenção.`, '#b91c1c');
  } else {
    showToast(`${label} salvo com sucesso.`);
  }
}
function optionTags(opcoes, atual, permitirNova = false) {
  const lista = [...new Set([...(opcoes || []), ...(atual ? [atual] : [])])];
  const tags = lista.map(op => {
    const seguro = escapeHtml(String(op));
    return `<option value="${seguro}" ${String(atual || '') === String(op) ? 'selected' : ''}>${seguro}</option>`;
  }).join('');
  return tags + (permitirNova ? '<option value="__nova__">＋ Adicionar nova opção</option>' : '');
}
async function selecionarOpcaoBase(select, type, campo) {
  if (select.value !== '__nova__') return;
  const valor = prompt('Digite o nome da nova opção:');
  if (!valor || !valor.trim()) {
    select.selectedIndex = 0;
    return;
  }
  select.disabled = true;
  try {
    const salvo = await apiBaseRequest('/api/base/opcoes', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ type, campo, valor: valor.trim() })
    });
    const sentinela = [...select.options].find(o => o.value === '__nova__');
    let option = [...select.options].find(o => o.value.toLowerCase() === salvo.valor.toLowerCase());
    if (!option) {
      option = new Option(salvo.valor, salvo.valor);
      select.insertBefore(option, sentinela || null);
    }
    select.value = salvo.valor;
    if (salvo._syncSheets?.ok === false) {
      showToast('Opção salva no App. A lista do Sheets será atualizada no próximo backup.', '#b45309');
    } else {
      showToast(`Opção “${salvo.valor}” adicionada.`);
    }
  } catch (e) {
    select.selectedIndex = 0;
    alert('Não foi possível adicionar a opção: ' + e.message);
  } finally {
    select.disabled = false;
  }
}
async function abrirModalTransporte(id) {
  const item = id ? state.transportesDB.find(t=>t.id==id) : {};
  const linhas = [...new Set(state.transportesDB.map(t => String(t.linha || '').trim()).filter(Boolean))].sort();
  let opcoes = {
    idade: ['Adulto','Infantil'],
    tipo: ['Transfer','Shinkansen','Romancecar','Limited Express','Skyliner','Trem','Ônibus','Balsa','Multiplos transportes','Ingresso','Carro'],
    categoria: ['Reservado','Green Car','Ordinary','GranClass']
  };
  try {
    const schemas = await apiBaseRequest('/api/base/schema');
    opcoes = schemas?.transportes?.options || opcoes;
  } catch (_) {}
  document.getElementById('modalContent').innerHTML = `
    <h3 class="modal-title">${id?'Editar':'Novo'} Transporte</h3>
    <div class="form-grid">
      <div class="field full-width"><label>Trecho</label><input id="m_trecho" value="${item.trecho||''}"></div>
      <div class="field"><label>Idade</label><select id="m_idade" onchange="selecionarOpcaoBase(this,'transportes','idade')">${optionTags(opcoes.idade, item.idade || 'Adulto', true)}</select></div>
      <div class="field"><label>Tipo</label><select id="m_tipo" onchange="selecionarOpcaoBase(this,'transportes','tipo')">${optionTags(opcoes.tipo, item.tipo, true)}</select></div>
      <div class="field"><label>Linha / Subtipo</label><input id="m_linha" list="m_linhas_opcoes" value="${item.linha||''}"><datalist id="m_linhas_opcoes">${linhas.map(x=>`<option value="${x}">`).join('')}</datalist></div>
      <div class="field"><label>Categoria</label><select id="m_categoria" onchange="selecionarOpcaoBase(this,'transportes','categoria')">${optionTags(opcoes.categoria, item.categoria, true)}</select></div>
      <div class="field"><label>Preço ¥</label><input id="m_preco" type="number" value="${item.preco_jpy||0}"></div>
      <div class="field"><label>Tempo</label><input id="m_tempo" value="${item.tempo||''}"></div>
      <div class="field full-width"><label>Observações</label><input id="m_obs" value="${item.observacao||''}"></div>
      <div class="field"><label>Link Klook (Compra Fácil / Recomendada)</label><input id="m_link_klook" type="url" placeholder="https://www.klook.com/..." value="${item.link_klook||''}"></div>
      <div class="field"><label>Link Oficial (Smart-EX / JR / Ferrovia)</label><input id="m_link" type="url" placeholder="https://..." value="${item.link||''}"></div>
      <div class="field full-width"><label>Instrução de Compra (Pré-compra)</label><textarea id="m_compra" rows="3" style="width:100%; border:1px solid var(--border); border-radius:4px; padding:8px; font-family:inherit;">${item.compra||''}</textarea></div>
      <div class="field full-width"><label>Instrução de Uso (Embarque)</label><textarea id="m_uso" rows="3" style="width:100%; border:1px solid var(--border); border-radius:4px; padding:8px; font-family:inherit;">${item.uso||''}</textarea></div>
    </div>
    <div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-primary" onclick="salvarTransporte('${id||'null'}')">Salvar</button></div>`;
  openModal();
}
async function salvarTransporte(id) {
  const parsedId = id && id !== 'null' ? id : null;
  const dados={
    trecho:v('m_trecho'),
    idade:v('m_idade'),
    tipo:v('m_tipo'),
    linha:v('m_linha'),
    categoria:v('m_categoria'),
    preco_jpy:parseFloat(v('m_preco'))||0,
    tempo:v('m_tempo'),
    observacao:v('m_obs'),
    link_klook:v('m_link_klook'),
    link:v('m_link'),
    compra:v('m_compra').trim(),
    uso:v('m_uso').trim()
  };
  try {
    let salvo;
    if(parsedId){
      salvo=await apiBaseRequest(`/api/transportes/${encodeURIComponent(parsedId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});
    } else {
      salvo=await apiBaseRequest('/api/transportes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});
    }
    await loadDB();
    window.dbTransportesCache = null;
    closeModal();
    feedbackBase(salvo, 'Transporte');
  } catch (e) {
    alert('Não foi possível salvar o transporte: ' + e.message);
  }
}
async function deletarTransporte(id){if(!confirm('Remover?'))return;try{await apiBaseRequest(`/api/transportes/${encodeURIComponent(id)}`,{method:'DELETE'});await loadDB();window.dbTransportesCache=null;showToast('Transporte removido.');}catch(e){alert('Não foi possível remover: '+e.message);}}
function abrirModalExperiencia(id) {
  const item = id ? state.experienciasDB.find(e=>e.id==id) : {};
  document.getElementById('modalContent').innerHTML = `
    <h3 class="modal-title">${id?'Editar':'Nova'} Experiência</h3>
    <div class="form-grid">
      <div class="field full-width"><label>Nome</label><input id="m_nome" value="${item.nome||''}"></div>
      <div class="field"><label>Tipo</label><input id="m_tipo" value="${item.tipo||'Ingresso'}"></div>
      <div class="field"><label>Cidade</label><input id="m_cidade" value="${item.cidade||''}"></div>
      <div class="field"><label>Preço adulto ¥</label><input id="m_preco" type="number" value="${item.preco_jpy||0}"></div>
      <div class="field"><label>Preço infantil ¥</label><input id="m_preco_crianca" type="number" value="${item.preco_crianca_jpy||0}"></div>
      <div class="field"><label>Duração</label><input id="m_duracao" value="${item.duracao||''}"></div>
      <div class="field"><label>Horários</label><input id="m_horarios" value="${item.horarios||''}"></div>
      <div class="field"><label>Janela abre (dias)</label><input id="m_janela" type="number" value="${item.janelaAbreDias||''}"></div>
      <div class="field"><label>Prazo (dias)</label><input id="m_prazo" type="number" value="${item.prazoDias||''}"></div>
      <div class="field"><label>Público</label><input id="m_publico" value="${item.publico||''}"></div>
      <div class="field"><label>Sazonalidade</label><input id="m_sazonalidade" value="${item.sazonalidade||''}"></div>
      <div class="field full-width"><label>Descrição</label><textarea id="m_descricao" rows="3">${item.descricao||''}</textarea></div>
      <div class="field full-width"><label>Observações</label><textarea id="m_obs" rows="2">${item.observacao||''}</textarea></div>
      <div class="field full-width"><label>Comprar (URL)</label><input id="m_link" type="url" value="${item.link||''}"></div>
      <div class="field full-width"><label>Instrução de Compra (Pré-compra)</label><textarea id="m_compra" rows="3" style="width:100%; border:1px solid var(--border); border-radius:4px; padding:8px; font-family:inherit;" placeholder="Ex: Abre 30 dias antes à meia-noite (horário do Japão). Selecionar ingresso Sunset.">${item.compra||item.instrucoesPreCompra||''}</textarea></div>
      <div class="field full-width"><label>Instrução de Visita / Uso (No dia do evento)</label><textarea id="m_uso" rows="3" style="width:100%; border:1px solid var(--border); border-radius:4px; padding:8px; font-family:inherit;" placeholder="Ex: Entrada descalço, água até a canela. Vestir roupas dobráveis.">${item.uso||item.instrucoesPosCompra||''}</textarea></div>
    </div>
    <div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn-primary" onclick="salvarExperiencia('${id||'null'}')">Salvar</button></div>`;
  openModal();
}
async function salvarExperiencia(id){
  const parsedId = id && id !== 'null' ? id : null;
  const dados={
    nome:v('m_nome'), tipo:v('m_tipo'), cidade:v('m_cidade'), descricao:v('m_descricao').trim(),
    preco_jpy:parseFloat(v('m_preco'))||0, preco_crianca_jpy:parseFloat(v('m_preco_crianca'))||0,
    duracao:v('m_duracao'), link:v('m_link'), janelaAbreDias:parseInt(v('m_janela'),10)||0,
    prazoDias:parseInt(v('m_prazo'),10)||0, horarios:v('m_horarios'), publico:v('m_publico'),
    sazonalidade:v('m_sazonalidade'), observacao:v('m_obs'),
    compra:v('m_compra').trim(),
    uso:v('m_uso').trim()
  };
  try {
    const url=parsedId?`/api/experiencias/${encodeURIComponent(parsedId)}`:'/api/experiencias';
    const salvo=await apiBaseRequest(url,{method:parsedId?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});
    await loadDB(); window.dbExperienciasCache=null; closeModal(); feedbackBase(salvo, 'Experiência');
  } catch(e) { alert('Não foi possível salvar a experiência: '+e.message); }
}
async function deletarExperiencia(id){if(!confirm('Remover?'))return;try{await apiBaseRequest(`/api/experiencias/${encodeURIComponent(id)}`,{method:'DELETE'});await loadDB();window.dbExperienciasCache=null;showToast('Experiência removida.');}catch(e){alert('Não foi possível remover: '+e.message);}}

function renderTabelaAtracoes(filtro) {
  if (filtro === undefined) {
    const el = document.getElementById('searchAtracao');
    filtro = el ? el.value : '';
  }
  const tbody = document.querySelector('#tabelaAtracoes tbody');
  if(!tbody) return;
  const lista = filtro ? state.atracoesDB.filter(a=>[a['Nome da Atração'],a['Bairro'],a['Cidade']].join(' ').toLowerCase().includes(filtro.toLowerCase())) : state.atracoesDB;
  
  const sortedLista = [...lista].sort((a, b) => {
    const cidA = String(a['Cidade'] || '').trim().toLowerCase();
    const cidB = String(b['Cidade'] || '').trim().toLowerCase();
    if (cidA !== cidB) return cidA.localeCompare(cidB);
    const barA = String(a['Bairro'] || '').trim().toLowerCase();
    const barB = String(b['Bairro'] || '').trim().toLowerCase();
    if (barA !== barB) return barA.localeCompare(barB);
    const nomA = String(a['Nome da Atração'] || '').trim().toLowerCase();
    const nomB = String(b['Nome da Atração'] || '').trim().toLowerCase();
    return nomA.localeCompare(nomB);
  });
  
  tbody.innerHTML = _agrupaBaseCidade(sortedLista, function(x){return x['Cidade'];}, 5, a=>`<tr><td>${a['Cidade']||''}</td><td>${a['Bairro']||''}</td><td><div class="chip-atracao" style="display: inline-block;" data-id="${a['Nome da Atração'].replace(/"/g, '&quot;')}">${a['Nome da Atração']}</div></td><td>${a['Preço (Ingresso)']||'—'}</td><td><button class="btn-icon" onclick="abrirModalAtracao('${String(a.id).replace(/'/g, "\\'")}')" title="Editar"><svg class="v-icon no-margin"><use href="#icon-edit"></use></svg></button> <button class="btn-icon" onclick="deletarAtracao('${String(a.id).replace(/'/g, "\\'")}')" title="Excluir"><svg class="v-icon no-margin" style="stroke:#c00;"><use href="#icon-trash"></use></svg></button></td></tr>`);

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
      <div class="field full-width"><label>Google Maps (Link / Como Chegar - Opcional)</label><input id="m_a_maps" type="url" placeholder="https://maps.app.goo.gl/... ou https://google.com/maps/..." value="${item['Google Maps']||item['Link do Google Maps']||item.mapsUrl||item.linkMaps||item.link||''}"></div>
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
  const mapsVal = v('m_a_maps').trim();

  const dados={
    'Cidade':v('m_a_cidade'),
    'Bairro':v('m_a_bairro'),
    'Nome da Atração':v('m_a_nome'),
    'Preço (Ingresso)':v('m_a_preco'),
    'Google Maps': mapsVal,
    'Link do Google Maps': mapsVal,
    'mapsUrl': mapsVal,
    'Descrição Detalhada':v('m_a_desc').trim(),
    'Foto (URL)':v('m_a_foto').trim(),
    'diasFechados': diasFechados,
    'manutencaoInicio': manutencaoInicio,
    'manutencaoFim': manutencaoFim,
    'manutencaoMotivo': manutencaoMotivo
  };
  try {
    const url=idOrName?`/api/atracoes/${encodeURIComponent(idOrName)}`:'/api/atracoes';
    const salvo=await apiBaseRequest(url,{method:idOrName?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});
    await loadDB(); closeModal();
    if (typeof carregarBases === 'function') await carregarBases();
    feedbackBase(salvo, 'Atração');
  } catch(e) { alert('Não foi possível salvar a atração: '+e.message); }
}
async function deletarAtracao(idOrName){
  if(!confirm('Remover atração?'))return;
  try {
    await apiBaseRequest(`/api/atracoes/${encodeURIComponent(idOrName)}`,{method:'DELETE'});
    await loadDB();
    if (typeof carregarBases === 'function') await carregarBases();
    showToast('Atração removida.');
  } catch(e) { alert('Não foi possível remover: '+e.message); }
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
  
  const sortedLista = [...listaFiltrada].sort((a, b) => {
    const cidA = String(a.Cidade || '').trim().toLowerCase();
    const cidB = String(b.Cidade || '').trim().toLowerCase();
    if (cidA !== cidB) return cidA.localeCompare(cidB);
    const nomA = String(a['Nome do Hotel'] || '').trim().toLowerCase();
    const nomB = String(b['Nome do Hotel'] || '').trim().toLowerCase();
    return nomA.localeCompare(nomB);
  });
  
  tbody.innerHTML = _agrupaBaseCidade(sortedLista, function(x){return x.Cidade;}, 7, h=>{
    const fotoRaw = h['Foto (URL)'] || '';
    const primeiraFoto = fotoRaw ? fotoRaw.split(',')[0].trim() : '';
    const fotoValida = (() => {
      if (!primeiraFoto) return '';
      try {
        const url = new URL(primeiraFoto, window.location.origin);
        const caminho = url.pathname.replace(/\/+$/, '');
        const linkIncompleto =
          /\/v1\/fill\/w_\d+$/i.test(caminho) ||
          /\/image\/upload\/w_\d+$/i.test(caminho);
        return ['http:', 'https:'].includes(url.protocol) && !linkIncompleto ? url.href : '';
      } catch (_) {
        return '';
      }
    })();
    const placeholderFoto = '<span class="hotel-photo-placeholder" aria-label="Hotel sem foto">Sem foto</span>';
    const fotoHtml = fotoValida
      ? `<span class="hotel-photo-slot"><img src="${fotoValida}" class="hotel-photo-thumb" alt="" onerror="this.onerror=null; this.hidden=true; this.nextElementSibling.hidden=false"><span class="hotel-photo-placeholder" aria-label="Hotel sem foto" hidden>Sem foto</span></span>`
      : placeholderFoto;
    const mapsLink = h['Link do Google Maps'] ? `<a href="${h['Link do Google Maps']}" target="_blank" style="color:var(--crimson); text-decoration:underline; font-weight:500;">Ver no Maps</a>` : '—';
    
    return `<tr>
      <td>${h.Cidade||''}</td>
      <td><a href="#" class="ind-nome-link" onclick="window.previewHotelCliente('${h.id}');return false;" title="Ver como o cliente vê">${h['Nome do Hotel']||''}</a></td>
      <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${(h['Descrição']||'').replace(/"/g, '&quot;')}">${h['Descrição']||'—'}</td>
      <td>${h.Comodidades||'—'}</td>
      <td style="text-align:center;">${fotoHtml}</td>
      <td>${mapsLink}</td>
      <td>
        <button class="btn-icon" onclick="abrirModalHotel('${h.id}')" title="Editar"><svg class="v-icon no-margin"><use href="#icon-edit"></use></svg></button> 
        <button class="btn-icon" onclick="deletarHotel('${h.id}')" title="Excluir"><svg class="v-icon no-margin" style="stroke:#c00;"><use href="#icon-trash"></use></svg></button>
      </td>
    </tr>`;
  });
}

function _escH(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function buildHotelPreviewCard(h){
  var fotoRaw = h['Foto (URL)'] || '';
  var fs = fotoRaw.split(',').map(function(s){return s.trim();}).filter(Boolean);
  var nome = h['Nome do Hotel'] || '';
  var ini = (nome||'?').trim().charAt(0).toUpperCase();
  var desc = h['Descrição'] || '';
  var comod = (h.Comodidades||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var maps = h['Link do Google Maps'] || '';
  var hero = fs.length
    ? '<img id="mpHeroH" src="'+_escH(fs[0])+'" alt="'+_escH(nome)+'" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentNode.style.background=\'linear-gradient(135deg,#6B1F2A,#3D0F16)\';this.outerHTML=\'<div style=&quot;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.9);font-family:Plus Jakarta Sans;font-weight:600;font-size:56px;&quot;>'+_escH(ini)+'</div>\';">'
    : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.9);font-family:Plus Jakarta Sans;font-weight:600;font-size:56px;">'+_escH(ini)+'</div>';
  var heroBg = fs.length ? '#eee' : 'linear-gradient(135deg,#6B1F2A,#3D0F16)';
  var thumbs = fs.length>1 ? '<div style="display:flex;gap:8px;padding:12px 22px 0;overflow-x:auto;">'+
    fs.map(function(u,i){return '<img src="'+_escH(u)+'" referrerpolicy="no-referrer" onclick="var hero=document.getElementById(\'mpHeroH\'); if(hero) hero.src=this.src;" style="width:74px;height:56px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid '+(i===0?'#C4A35A':'transparent')+';flex-shrink:0;opacity:'+(i===0?1:0.65)+';">';}).join('')+'</div>' : '';
  var acts = maps ? '<div style="display:flex;gap:12px;margin-top:22px;flex-wrap:wrap;"><a href="'+_escH(maps)+'" target="_blank" rel="noopener" style="flex:1;min-width:140px;text-align:center;padding:12px 16px;border-radius:10px;font-family:Plus Jakarta Sans;font-weight:600;font-size:13.5px;text-decoration:none;background:linear-gradient(135deg,#8a2836,#6B1F2A);color:#fff;">Ver no Google Maps</a></div>' : '';
  return '<div style="position:relative;aspect-ratio:16/9;overflow:hidden;background:'+heroBg+';">'+hero+
    '<span style="position:absolute;top:12px;right:12px;background:rgba(196,163,90,.95);color:#3D0F16;font-family:Inter;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;border-radius:99px;">Prévia · visão do cliente</span>'+
  '</div>'+thumbs+
  '<div style="padding:20px 24px 4px;">'+
    '<h2 style="font-family:Plus Jakarta Sans;font-weight:600;font-size:24px;color:#6B1F2A;margin:0;line-height:1.15;">'+_escH(nome)+'</h2>'+
    (h.Cidade?'<div style="color:#7A6568;font-size:13.5px;font-weight:500;margin:8px 0 14px;">'+_escH(h.Cidade)+'</div>':'')+
    (desc?'<div style="color:#1A1012;font-size:14.5px;line-height:1.65;white-space:pre-wrap;">'+_escH(desc)+'</div>':'')+
    (comod.length?'<div style="margin-top:16px;"><div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#9C8248;font-weight:700;margin-bottom:8px;">Comodidades</div><div style="display:flex;flex-wrap:wrap;gap:7px;">'+comod.map(function(t){return '<span style="font-size:12px;color:#3A282B;background:rgba(196,163,90,.14);padding:5px 12px;border-radius:99px;font-weight:500;">'+_escH(t)+'</span>';}).join('')+'</div></div>':'')+
    acts+
  '</div>';
}
function previewHotelCliente(id){
  var h = (state.hoteisDB||[]).find(function(x){return String(x.id)===String(id);});
  if(!h) return;
  var mc = document.getElementById('modalContent'); if(!mc) return;
  mc.innerHTML = '<h3 class="modal-title">Prévia — como o cliente vê</h3>'+
    '<div style="border-radius:16px;overflow:hidden;border:1px solid rgba(107,31,42,.12);box-shadow:0 10px 30px rgba(61,15,22,.08);">'+buildHotelPreviewCard(h)+'</div>'+
    '<div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Fechar</button>'+
    '<button class="btn-primary" onclick="closeModal(); if(window.abrirModalHotel) window.abrirModalHotel(\''+String(id).replace(/\x27/g,'')+'\')">Editar este hotel</button></div>';
  if(typeof openModal==='function') openModal();
}
window.previewHotelCliente = previewHotelCliente;
(function(){ try{ if(document.getElementById && !document.getElementById('indNomeLinkStyle')){ var st=document.createElement('style'); st.id='indNomeLinkStyle'; st.textContent='.ind-nome-link{color:var(--crimson);font-weight:700;text-decoration:none;cursor:pointer;} .ind-nome-link:hover{text-decoration:underline;}'; (document.head||document.documentElement).appendChild(st);} }catch(e){} })();

window.abrirModalHotel = abrirModalHotel;
function abrirModalHotel(id) {
  const item = id ? state.hoteisDB.find(h=>h.id == id) : {};
  const fotoRaw = item['Foto (URL)'] || '';
  const fotosArr = fotoRaw.split(',').map(s => s.trim()).filter(Boolean);
  const foto1 = fotosArr[0] || '';
  const foto2 = fotosArr[1] || '';
  const foto3 = fotosArr[2] || '';

  document.getElementById('modalContent').innerHTML = `
    <h3 class="modal-title">${id?'Editar':'Novo'} Hotel</h3>
    <div class="form-grid">
      <div class="field"><label>Cidade</label><input id="m_h_cidade" value="${item.Cidade||''}"></div>
      <div class="field full-width"><label>Nome do Hotel</label><input id="m_h_nome" value="${item['Nome do Hotel']||''}"></div>
      <div class="field full-width"><label>Link do Google Maps</label><input id="m_h_maps" value="${item['Link do Google Maps']||''}"></div>
      
      <div class="field full-width" style="margin-top:4px;">
        <label style="font-weight:600; color:var(--ink-dk); margin-bottom:6px; display:block;">FOTOS (NA ORDEM EM QUE APARECEM — A 1ª É A CAPA)</label>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <input id="m_h_foto1" placeholder="Foto 1 (Capa) - https://..." value="${foto1}">
          <input id="m_h_foto2" placeholder="Foto 2 - https://..." value="${foto2}">
          <input id="m_h_foto3" placeholder="Foto 3 - https://..." value="${foto3}">
        </div>
      </div>

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
  const f1 = v('m_h_foto1').trim();
  const f2 = v('m_h_foto2').trim();
  const f3 = v('m_h_foto3').trim();
  const fotosUnidas = [f1, f2, f3].filter(Boolean).join(', ');

  const dados = {
    'Cidade': v('m_h_cidade'),
    'Nome do Hotel': v('m_h_nome'),
    'Link do Google Maps': v('m_h_maps'),
    'Foto (URL)': fotosUnidas,
    'Comodidades': v('m_h_comodidades'),
    'Descrição': v('m_h_desc').trim()
  };

  const parsedId = id !== 'null' ? id : null;
  const btn = document.querySelector('#modalBox .btn-primary');
  btn.disabled = true;
  btn.innerText = 'Salvando...';

  try {
    let salvo;
    if (parsedId) {
      salvo = await apiBaseRequest(`/api/hoteis/${encodeURIComponent(parsedId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });
    } else {
      salvo = await apiBaseRequest('/api/hoteis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });
    }
    await loadDB();
    closeModal();
    feedbackBase(salvo, 'Hotel');
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
    await apiBaseRequest(`/api/hoteis/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadDB();
    showToast('Hotel removido.');
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
    try{const res=await fetch('/api/base/backup-sheets',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const data=await res.json();
      if(!res.ok) throw new Error(data.error||`HTTP ${res.status}`);
      if(data.ok){
        document.getElementById('syncStatus').textContent='Sheets atualizado: '+new Date().toLocaleString('pt-BR');
        showToast('Sheets reconstruído a partir da Base oficial do App.');
      }
      else alert('Algumas abas falharam: '+JSON.stringify(data.resultado||data));
    }catch(e){alert('Erro ao atualizar o Sheets: '+e.message);}
    btn.textContent='↻ Atualizar Sheets pelo App';btn.disabled=false;
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
  // Cotação client-facing: só aparece o que a Heian é responsável (esconde compradoHeian===false).
  const transpHeian = (o.transportes || []).filter(t => t.compradoHeian !== false);
  const expHeian = (o.experiencias || []).filter(e => e.compradoHeian !== false);
  const tTr = transpHeian.reduce((s,t)=>s+calcTotalTransporte(t),0);
  const tEx = expHeian.reduce((s,e)=>s+calcTotalExp(e),0);
  const tItens = (o.itensAdicionais||[]).reduce((s,i)=>s+(i.valor||0),0);
  const cons = consAtiva ? consValor : 0;
  const total = tT+tTr+tEx+tItens+cons;
  const sinal = tT*0.30;
  const saldo = tT*0.70;
  const antecipado = sinal + tTr + tEx + tItens + cons; // entrada = 30% tours + transportes + experiências + itens + consultoria

  const estadiasHTML = (o.estadias || []).length > 0
    ? `<div class="pdf-estadias-grid">${(o.estadias || []).map(e=>{
        const di=e.dataInicio?fmtDataBR(e.dataInicio):''; const df=e.dataFim?fmtDataBR(e.dataFim):'';
        const per=di&&df?`${di} – ${df}`:di||df||'';
        return `<div class="pdf-estadia-item"><div class="pdf-estadia-cidade">${e.cidade||'—'}</div>${per?`<div class="pdf-estadia-datas">${per}</div>`:''} ${e.hotel?`<div class="pdf-estadia-hotel">${e.hotel}</div>`:''}</div>`;
      }).join('')}</div>`
    : '<p style="color:#9A8A78;font-size:13px;font-style:italic">Nenhuma estadia adicionada.</p>';

  const transpRows = transpHeian.map(t=>{
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

  const expRows = expHeian.map(e=>{
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
  <div class="pdf-doc pdf-doc-cotacao">
    <div class="pdf-cover pdf-cover-cotacao">
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
      ${transpHeian.length>0?`<div class="pdf-section">
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

      ${expHeian.length>0?`<div class="pdf-section">
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
              ${cons>0?`<div class="pdf-resumo-row"><span>Roteirização e Suporte — valor integral</span><span class="pdf-resumo-valor">¥${fmt(cons)} &nbsp;·&nbsp; ${fmtUSD(cons*usd)}</span></div>`:''}
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
function openModal() { document.getElementById('modalOverlay').classList.remove('hidden'); document.getElementById('modalClose').onclick=closeModal; /* fechar-ao-clicar-fora REMOVIDO a pedido: só fecha no X, Cancelar ou Salvar (não perde o que foi preenchido) */ document.getElementById('modalOverlay').onclick=null; }
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
  const sugestoes = (sugestoesTexto || '').split('\n').map(s => s.trim()).filter(Boolean);
  const itens = sugestoes.map((sug, idx) => {
    const e = escapeHtml(sug);
    return `<div class="sugestoes-row" style="display:flex;align-items:center;gap:2px;">
      <button type="button" class="sugestoes-dropdown-item" data-texto="${e}" onclick="aplicarSugestao(${id}, '${tipo}', this)" style="flex:1;text-align:left;">${e}</button>
      <button type="button" class="bib-mini" title="Editar frase" onclick="event.stopPropagation(); bibEditar('${tipo}', ${idx}, ${id})" style="border:none;background:none;cursor:pointer;padding:5px;color:var(--ink-lt);"><svg class="v-icon" style="width:1em;height:1em;margin:0;"><use href="#icon-edit"></use></svg></button>
      <button type="button" class="bib-mini" title="Apagar frase" onclick="event.stopPropagation(); bibApagar('${tipo}', ${idx}, ${id})" style="border:none;background:none;cursor:pointer;padding:5px;color:#c0392b;"><svg class="v-icon" style="width:1em;height:1em;margin:0;"><use href="#icon-trash"></use></svg></button>
    </div>`;
  }).join('');
  const vazio = sugestoes.length === 0 ? `<div style="padding:9px 10px;color:var(--ink-lt);font-size:12px;font-style:italic;">Nenhuma frase ainda — escreva a primeira abaixo.</div>` : '';
  const addRow = `<div class="sugestoes-add" onclick="event.stopPropagation()" style="display:flex;gap:5px;padding:5px 5px 8px;border-bottom:1px solid var(--border);margin-bottom:4px;position:sticky;top:0;background:var(--warm-white);z-index:2;">
    <input type="text" id="bibNova-${tipo}-${id}" placeholder="Escrever nova frase..." onclick="event.stopPropagation()" onkeydown="if(event.key==='Enter'){event.preventDefault(); bibAdicionar('${tipo}', ${id});}" style="flex:1;padding:7px 9px;border:1px solid var(--border);border-radius:6px;font-size:12.5px;font-family:inherit;">
    <button type="button" onclick="event.stopPropagation(); bibAdicionar('${tipo}', ${id})" style="border:none;background:var(--crimson);color:#fff;border-radius:6px;padding:7px 12px;cursor:pointer;font-weight:600;font-size:12px;font-family:inherit;">Adicionar</button>
  </div>`;
  const dropdownHtml = `<div class="sugestoes-dropdown" id="dropdown-${tipo}-${id}">${addRow}${vazio}${itens}</div>`;
  return `
    <div class="sugestoes-wrap">
      <button type="button" class="btn-sugestao-menu" onclick="toggleSugestoesDropdown(${id}, '${tipo}', event)" style="display:inline-flex; align-items:center; gap:3.5px;"><svg class="v-icon" style="stroke:var(--ink-mid); width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-file"></use></svg>Biblioteca</button>
      ${dropdownHtml}
    </div>
  `;
}

// -- Biblioteca de frases: adicionar / editar / apagar (persiste em config, compartilhado) --
var _bibKey = { tour: 'sugestoes_tours', transporte: 'sugestoes_transportes', experiencia: 'sugestoes_experiencias' };
function _bibLista(tipo) { return (state.config[_bibKey[tipo]] || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }
function _bibReRender(tipo, id) {
  var dd = document.getElementById('dropdown-' + tipo + '-' + id);
  if (!dd) return;
  var wrap = dd.parentNode; var estavaAberto = dd.classList.contains('show');
  wrap.outerHTML = renderSugestoesHtml(id, tipo, state.config[_bibKey[tipo]] || '');
  if (estavaAberto) { var nd = document.getElementById('dropdown-' + tipo + '-' + id); if (nd) nd.classList.add('show'); }
}
async function _bibSalvar(tipo, lista, id) {
  var key = _bibKey[tipo]; if (!key) return;
  var dados = {}; dados[key] = lista.join('\n');
  Object.assign(state.config, dados);
  _bibReRender(tipo, id);
  try {
    var r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    if (!r || !r.ok) throw new Error('HTTP ' + (r && r.status));
    if (typeof showToast === 'function') showToast('Biblioteca atualizada!');
  } catch (e) { if (typeof showToast === 'function') showToast('Apareceu na tela, mas falhou ao gravar no servidor. Tente de novo.'); }
}
function bibAdicionar(tipo, id) {
  var inp = document.getElementById('bibNova-' + tipo + '-' + id); if (!inp) return;
  var v = (inp.value || '').trim(); if (!v) { inp.focus(); return; }
  var lista = _bibLista(tipo); lista.unshift(v); _bibSalvar(tipo, lista, id);
}
function bibApagar(tipo, idx, id) {
  var lista = _bibLista(tipo); if (idx < 0 || idx >= lista.length) return;
  if (!confirm('Apagar esta frase da biblioteca?\n\n"' + lista[idx] + '"')) return;
  lista.splice(idx, 1); _bibSalvar(tipo, lista, id);
}
function bibEditar(tipo, idx, id) {
  var lista = _bibLista(tipo); if (idx < 0 || idx >= lista.length) return;
  var novo = prompt('Editar frase:', lista[idx]); if (novo === null) return;
  novo = novo.trim();
  if (!novo) { lista.splice(idx, 1); } else { lista[idx] = novo; }
  _bibSalvar(tipo, lista, id);
}
window.bibAdicionar = bibAdicionar; window.bibApagar = bibApagar; window.bibEditar = bibEditar;


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
  
  const sortedLista = [...lista].sort((a, b) => {
    const cidA = String(a.cidade || '').trim().toLowerCase();
    const cidB = String(b.cidade || '').trim().toLowerCase();
    if (cidA !== cidB) return cidA.localeCompare(cidB);
    const nomA = String(a.nomeDaRota || '').trim().toLowerCase();
    const nomB = String(b.nomeDaRota || '').trim().toLowerCase();
    return nomA.localeCompare(nomB);
  });
  
  tbody.innerHTML = _agrupaBaseCidade(sortedLista, function(x){return x.cidade;}, 4, r => `<tr>
    <td>${r.cidade || ''}</td>
    <td>${r.nomeDaRota || ''}</td>
    <td>${(r.atracoesDoDia || []).join(', ')}</td>
      <td>
        <button class="btn-icon" onclick="editarRota(${r.id})" title="Editar"><svg class="v-icon no-margin"><use href="#icon-edit"></use></svg></button>
        <button class="btn-icon" onclick="deletarRota(${r.id})" title="Excluir"><svg class="v-icon no-margin" style="stroke:#c00;"><use href="#icon-trash"></use></svg></button>
      </td>
  </tr>`);
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
    
    // Junta cotações e roteiros num array único (com tipo) pra filtrar/ordenar
    window._lixeiraItens = [
      ...orcs.map(o => ({ tipo: 'cotacao', nome: o.nome || 'Sem título', clienteNome: (o.cliente && o.cliente.nome) || '', deletadoEm: o.deletadoEm || null, restoreKey: String(o.id) })),
      ...rots.map(r => ({ tipo: 'roteiro', nome: r.nome || '', clienteNome: (r.cliente && r.cliente.nome) || '', deletadoEm: r.deletadoEm || null, restoreKey: encodeURIComponent(r.nome || '') }))
    ];

    container.innerHTML = `
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:12px;">
        <input id="lixeiraBusca" type="text" placeholder="Buscar por nome ou cliente..." oninput="_aplicarFiltroLixeira()" style="flex:1; min-width:200px; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;">
        <select id="lixeiraTipo" onchange="_aplicarFiltroLixeira()" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; font-size:13px; background:#fff;">
          <option value="">Todos os tipos</option>
          <option value="cotacao">Cotações</option>
          <option value="roteiro">Roteiros</option>
        </select>
        <select id="lixeiraOrdem" onchange="_aplicarFiltroLixeira()" style="padding:8px 10px; border:1px solid var(--border); border-radius:8px; font-size:13px; background:#fff;">
          <option value="del_desc">Exclusão (mais recente)</option>
          <option value="del_asc">Exclusão (mais antiga)</option>
          <option value="nome_asc">Nome (A→Z)</option>
          <option value="nome_desc">Nome (Z→A)</option>
        </select>
      </div>
      <div id="lixeiraContadorFiltro" style="font-size:11.5px; color:var(--ink-lt); margin-bottom:8px;"></div>
      <div id="lixeiraTabelaWrap"></div>
    `;
    _aplicarFiltroLixeira();
  } catch(e) {
    console.error(e);
    container.innerHTML = '<div style="color:#c00; padding:10px; font-size:13px; text-align:center;">Erro ao carregar a lixeira.</div>';
  }
};

// Aplica busca (nome/cliente) + filtro de tipo + ordenação, e re-renderiza só a tabela.
window._aplicarFiltroLixeira = function() {
  const wrap = document.getElementById('lixeiraTabelaWrap');
  if (!wrap) return;
  const q = (document.getElementById('lixeiraBusca')?.value || '').toLowerCase().trim();
  const tipo = document.getElementById('lixeiraTipo')?.value || '';
  const ordem = document.getElementById('lixeiraOrdem')?.value || 'del_desc';
  const todos = window._lixeiraItens || [];

  let itens = todos.slice();
  if (tipo) itens = itens.filter(i => i.tipo === tipo);
  if (q) itens = itens.filter(i => (i.nome + ' ' + i.clienteNome).toLowerCase().includes(q));

  const ts = x => x.deletadoEm ? new Date(x.deletadoEm).getTime() : 0;
  itens.sort((a, b) => {
    if (ordem === 'del_asc') return ts(a) - ts(b);
    if (ordem === 'nome_asc') return (a.nome || '').localeCompare(b.nome || '');
    if (ordem === 'nome_desc') return (b.nome || '').localeCompare(a.nome || '');
    return ts(b) - ts(a); // del_desc (padrão)
  });

  const cont = document.getElementById('lixeiraContadorFiltro');
  if (cont) cont.textContent = itens.length + ' item(ns)' + ((q || tipo) ? ' · filtrado de ' + todos.length : '');

  if (!itens.length) {
    wrap.innerHTML = '<div style="color:var(--ink-lt); padding:20px; text-align:center; font-size:13px;">Nenhum item encontrado com esse filtro.</div>';
    return;
  }

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rows = itens.map(i => {
    const dataDel = i.deletadoEm ? new Date(i.deletadoEm).toLocaleString('pt-BR') : '—';
    const badge = i.tipo === 'cotacao'
      ? '<span style="background:rgba(107,31,42,0.08); color:var(--crimson); padding:2px 6px; border-radius:4px; font-weight:600; font-size:10px;">Cotação</span>'
      : '<span style="background:rgba(196,163,90,0.08); color:var(--gold-dk); padding:2px 6px; border-radius:4px; font-weight:600; font-size:10px;">Roteiro</span>';
    return `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:8px;">${badge}</td>
        <td style="padding:8px; font-weight:500;">${esc(i.nome)}</td>
        <td style="padding:8px;">${esc(i.clienteNome) || '—'}</td>
        <td style="padding:8px; color:var(--ink-lt);">${dataDel}</td>
        <td style="padding:8px; text-align:right; white-space:nowrap;">
          <button class="btn-secondary" onclick="window.restaurarItemLixeira('${i.tipo}', '${i.restoreKey}')" style="padding:4px 8px; font-size:11px; margin-right:4px;">Restaurar</button>
          <button class="btn-secondary" onclick="window.excluirItemDefinitivoLixeira('${i.tipo}', '${i.restoreKey}')" style="padding:4px 8px; font-size:11px; color:#c00; border-color:#fee;">Definitivo</button>
        </td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:left;">
      <thead>
        <tr style="border-bottom:2px solid var(--border); color:var(--ink-lt); font-weight:600;">
          <th style="padding:8px;">Tipo</th>
          <th style="padding:8px;">Nome / Item</th>
          <th style="padding:8px;">Cliente</th>
          <th style="padding:8px;">Data Exclusão</th>
          <th style="padding:8px; text-align:right;">Ações</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
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

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const maxWidth = 600;
      const maxHeight = 600;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      editFotoPerfilBase64 = canvas.toDataURL('image/jpeg', 0.82);

      const container = document.getElementById('mcFotoPerfilPreview');
      if (container) {
        container.innerHTML = `<img src="${editFotoPerfilBase64}" style="width:100%; height:100%; object-fit:cover;">`;
      }
      const btnRemover = document.getElementById('mcBtnRemoverFoto');
      if (btnRemover) btnRemover.style.display = 'inline-block';
    };
    img.src = e.target.result;
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
  if(btnSalvar) btnSalvar.onclick = salvarClienteNotion;
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

// ── EMAILS (Formulário dinâmico) → movido para public/js/app-emails.js (Fatia 6, 2026-07-28) ──

// ── HUB / FICHA DO CLIENTE → movido para public/js/app-cliente.js (Fatia 4, 2026-07-28) ──


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

// ── ESTADO COMPARTILHADO DO CALENDÁRIO ────────────────────────────────
// As funções do calendário foram movidas para public/js/app-calendario.js (Fatia 2, 2026-07-28).
// `calEventos` e `calColaboradores` PERMANECEM aqui porque a seção Colaboradores/Dashboard
// (logo abaixo) também os usa; app-calendario.js os acessa via escopo global.
let calEventos = [];
let calColaboradores = [];
