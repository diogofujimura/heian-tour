// Solicitações Internas — task tracker Diogo↔Deborah (Kanban + Lista).
// Dados: /api/solicitacoes (config Supabase). Opções editáveis: /api/solic-config. Clientes: window.notionClients.
(function () {
  'use strict';
  var DEFAULTS = {
    pessoas: ['Diogo', 'Deborah', 'Os dois'],
    tipos: ['Pesquisa', 'Pagamento', 'Reserva', 'Contato', 'Outro'],
    status: [{ k: 'A fazer', c: '#7A6568' }, { k: 'Fazendo', c: '#C4A35A' }, { k: 'Aguardando', c: '#b07d2a' }, { k: 'Feito', c: '#3f7d55' }],
    prioridades: [{ k: 'Alta', c: '#c0392b' }, { k: 'Média', c: '#C4A35A' }, { k: 'Baixa', c: '#8a9a8f' }]
  };
  var OPC = JSON.parse(JSON.stringify(DEFAULTS));
  var CLIENTS = [], DB = [], loaded = false, view = 'kanban';
  var PALETA = ['#6B1F2A', '#C4A35A', '#9C8248', '#3f7d55', '#b07d2a', '#7A6568', '#8a9a8f', '#c0392b'];

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function ini(p) { p = (p || '').trim(); if (!p) return '?'; var w = p.split(/\s+/); return (w.length > 1 ? (w[0][0] + w[1][0]) : p.slice(0, 2)).toUpperCase(); }
  function corPessoa(p) { var i = OPC.pessoas.indexOf(p); return i >= 0 ? PALETA[i % PALETA.length] : '#7A6568'; }
  function statusObj(k) { for (var i = 0; i < OPC.status.length; i++) if (OPC.status[i].k === k) return OPC.status[i]; return { k: k || 'A fazer', c: '#7A6568' }; }
  function prioObj(k) { for (var i = 0; i < OPC.prioridades.length; i++) if (OPC.prioridades[i].k === k) return OPC.prioridades[i]; return { k: k || 'Média', c: '#C4A35A' }; }
  function tipoClasse(t) { return (t || '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, ''); }
  function fmtData(d) { if (!d) return ''; var p = String(d).slice(0, 10).split('-'); return p.length === 3 ? (p[2] + '/' + p[1]) : d; }
  function atrasado(d, status) { if (!d || status === 'Feito') return false; try { var h = new Date(); h.setHours(0, 0, 0, 0); return new Date(String(d).slice(0, 10) + 'T00:00:00') < h; } catch (e) { return false; } }

  function optsSimples(list) { return list.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('') + '<option value="__novo__">➕ Adicionar...</option>'; }
  function optsObj(list) { return list.map(function (o) { return '<option>' + esc(o.k) + '</option>'; }).join('') + '<option value="__novo__">➕ Adicionar...</option>'; }
  function optsClientes(sel) { return '<option value="">— nenhum —</option>' + CLIENTS.map(function (c) { return '<option value="' + esc(c.id) + '"' + (String(c.id) === String(sel) ? ' selected' : '') + '>' + esc(c.nome || '(sem nome)') + '</option>'; }).join(''); }
  function optsForCampo(campo) { return (campo === 'status' || campo === 'prioridades') ? optsObj(OPC[campo]) : optsSimples(OPC[campo]); }
  function setSelect(id, campo, val) { var el = document.getElementById(id); if (!el) return; el.innerHTML = optsForCampo(campo); if (val != null) el.value = val; }

  async function carregarOpcoes() {
    try {
      var c = await fetch('/api/solic-config').then(function (r) { return r.json(); });
      ['pessoas', 'tipos', 'status', 'prioridades'].forEach(function (k) { if (c && Array.isArray(c[k]) && c[k].length) OPC[k] = c[k]; });
    } catch (e) { }
  }
  async function carregarClientes() {
    if (Array.isArray(window.notionClients) && window.notionClients.length) { CLIENTS = window.notionClients; return; }
    try { var r = await fetch('/api/notion/clientes').then(function (x) { return x.json(); }); CLIENTS = Array.isArray(r) ? r : []; if (!window.notionClients || !window.notionClients.length) window.notionClients = CLIENTS; } catch (e) { CLIENTS = []; }
  }
  async function salvarOpcoes() { try { await fetch('/api/solic-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(OPC) }); } catch (e) { } }

  async function carregar() {
    await carregarOpcoes();
    await carregarClientes();
    try { DB = await fetch('/api/solicitacoes').then(function (r) { return r.json(); }); } catch (e) { DB = []; }
    if (!Array.isArray(DB)) DB = [];
    loaded = true;
    popularFiltros();
    _render();
  }

  function popularFiltros() {
    var fr = document.getElementById('solicFiltroResp'); if (fr) fr.innerHTML = '<option value="">Responsável: todos</option>' + OPC.pessoas.map(function (p) { return '<option>' + esc(p) + '</option>'; }).join('');
    var ft = document.getElementById('solicFiltroTipo'); if (ft) ft.innerHTML = '<option value="">Tipo: todos</option>' + OPC.tipos.map(function (p) { return '<option>' + esc(p) + '</option>'; }).join('');
    var fs = document.getElementById('solicFiltroStatus'); if (fs) fs.innerHTML = '<option value="">Status: todos</option>' + OPC.status.map(function (o) { return '<option>' + esc(o.k) + '</option>'; }).join('');
  }

  function filtradas() {
    var g = function (i) { var el = document.getElementById(i); return el ? el.value : ''; };
    var fr = g('solicFiltroResp'), ft = g('solicFiltroTipo'), fs = g('solicFiltroStatus'), q = (g('solicBusca') || '').toLowerCase();
    return DB.filter(function (t) {
      if (fr && t.faz !== fr) return false;
      if (ft && t.tipo !== ft) return false;
      if (fs && (t.status || OPC.status[0].k) !== fs) return false;
      if (q && [t.titulo, t.cliente, t.detalhes, t.tipo].join(' ').toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  function av(p) { return '<span class="av" style="background:' + corPessoa(p) + '">' + ini(p) + '</span>'; }
  function cardHTML(t) {
    var pr = prioObj(t.prioridade), atr = atrasado(t.prazo, t.status);
    return '<div class="solic-card" onclick="abrirModalSolic(\'' + esc(t.id) + '\')">' +
      '<div class="sc-top">' + (t.tipo ? '<span class="sc-tipo t-' + tipoClasse(t.tipo) + '">' + esc(t.tipo) + '</span>' : '') +
        '<span class="sc-prio"><span class="pd" style="background:' + pr.c + '"></span>' + esc(pr.k) + '</span></div>' +
      '<div class="sc-titulo">' + esc(t.titulo || '(sem título)') + '</div>' +
      (t.cliente ? '<div class="sc-cli">' + esc(t.cliente) + '</div>' : '') +
      '<div class="sc-foot"><span class="sc-who">' + av(t.pediu) + '<span class="ar">→</span>' + av(t.faz) + '</span>' +
        (t.prazo ? '<span class="sc-prazo' + (atr ? ' atr' : '') + '">' + fmtData(t.prazo) + '</span>' : '') +
      '</div></div>';
  }

  function renderKanban() {
    var lista = filtradas(), el = document.getElementById('solicKanban'); if (!el) return;
    el.innerHTML = OPC.status.map(function (s) {
      var cards = lista.filter(function (t) { return (t.status || OPC.status[0].k) === s.k; });
      return '<div class="solic-col"><div class="sc-col-h"><span class="t"><span class="dot" style="background:' + s.c + '"></span>' + esc(s.k) + '</span><span class="n">' + cards.length + '</span></div>' +
        (cards.length ? cards.map(cardHTML).join('') : '<div class="sc-vazio">—</div>') + '</div>';
    }).join('');
  }

  function renderLista() {
    var lista = filtradas(), el = document.getElementById('solicLista'); if (!el) return;
    var rows = lista.map(function (t) {
      var s = statusObj(t.status), pr = prioObj(t.prioridade), atr = atrasado(t.prazo, t.status);
      return '<tr onclick="abrirModalSolic(\'' + esc(t.id) + '\')">' +
        '<td><strong>' + esc(t.titulo || '') + '</strong></td>' +
        '<td>' + (t.tipo ? '<span class="sc-tipo t-' + tipoClasse(t.tipo) + '">' + esc(t.tipo) + '</span>' : '—') + '</td>' +
        '<td>' + (esc(t.cliente) || '—') + '</td>' +
        '<td><span class="sc-who">' + av(t.pediu) + ' <span class="ar">→</span> ' + av(t.faz) + '</span></td>' +
        '<td><span class="sc-prazo' + (atr ? ' atr' : '') + '">' + (fmtData(t.prazo) || '—') + '</span></td>' +
        '<td><span class="sc-prio"><span class="pd" style="background:' + pr.c + '"></span>' + esc(pr.k) + '</span></td>' +
        '<td><span class="sc-stpill" style="color:' + s.c + ';background:' + s.c + '1f;">' + esc(s.k) + '</span></td></tr>';
    }).join('');
    el.innerHTML = '<table class="solic-table"><thead><tr><th>O que fazer</th><th>Tipo</th><th>Cliente</th><th>Pediu → Faz</th><th>Prazo</th><th>Prioridade</th><th>Status</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7" class="sc-vazio">Nenhuma solicitação ainda. Clique em "+ Nova solicitação".</td></tr>') + '</tbody></table>';
  }

  function _render() { if (view === 'kanban') renderKanban(); else renderLista(); }

  window.renderSolicitacoes = function () { if (!loaded) { carregar(); return; } _render(); };

  window.setSolicView = function (v) {
    view = v; var k = v === 'kanban';
    var kb = document.getElementById('solicKanban'), ls = document.getElementById('solicLista'), fl = document.getElementById('solicFiltros');
    if (kb) kb.style.display = k ? 'grid' : 'none';
    if (ls) ls.style.display = k ? 'none' : 'block';
    if (fl) fl.style.display = k ? 'none' : 'flex';
    var bk = document.getElementById('solicBtnKanban'), bl = document.getElementById('solicBtnLista');
    if (bk) bk.classList.toggle('on', k); if (bl) bl.classList.toggle('on', !k);
    _render();
  };

  // Adicionar nova opção direto no select (pessoa / tipo / status / prioridade)
  window.solicSelNovo = function (el, campo) {
    if (!el || el.value !== '__novo__') return;
    var nome = (prompt('Nova opção para ' + campo + ':') || '').trim();
    if (!nome) { el.selectedIndex = 0; return; }
    if (campo === 'status' || campo === 'prioridades') {
      if (!OPC[campo].some(function (o) { return o.k === nome; })) OPC[campo].push({ k: nome, c: PALETA[OPC[campo].length % PALETA.length] });
    } else {
      if (OPC[campo].indexOf(nome) === -1) OPC[campo].push(nome);
    }
    salvarOpcoes();
    if (campo === 'pessoas') {
      var vP = document.getElementById('sol_pediu'), vF = document.getElementById('sol_faz');
      var valP = (el.id === 'sol_pediu') ? nome : (vP ? vP.value : '');
      var valF = (el.id === 'sol_faz') ? nome : (vF ? vF.value : '');
      setSelect('sol_pediu', 'pessoas', valP); setSelect('sol_faz', 'pessoas', valF);
    } else if (campo === 'tipos') { setSelect('sol_tipo', 'tipos', nome); }
    else if (campo === 'status') { setSelect('sol_status', 'status', nome); }
    else if (campo === 'prioridades') { setSelect('sol_prio', 'prioridades', nome); }
  };

  window.abrirModalSolic = function (id) {
    var t = id ? (DB.find(function (x) { return String(x.id) === String(id); }) || {}) : {};
    var mc = document.getElementById('modalContent'); if (!mc) return;
    mc.innerHTML =
      '<h3 class="modal-title">' + (id ? 'Editar solicitação' : 'Nova solicitação') + '</h3>' +
      '<div class="form-grid solic-form">' +
        '<div class="field full-width"><label>O que fazer</label><input id="sol_titulo" value="' + esc(t.titulo || '') + '" placeholder="Ex: Pesquisar hotel em Kanazawa"></div>' +
        '<div class="field full-width"><label>Detalhes (opcional)</label><textarea id="sol_detalhes" rows="2" placeholder="Contexto, links, referências...">' + esc(t.detalhes || '') + '</textarea></div>' +
        '<div class="field"><label>Quem pediu</label><select id="sol_pediu" onchange="solicSelNovo(this,\'pessoas\')">' + optsSimples(OPC.pessoas) + '</select></div>' +
        '<div class="field"><label>Quem faz</label><select id="sol_faz" onchange="solicSelNovo(this,\'pessoas\')">' + optsSimples(OPC.pessoas) + '</select></div>' +
        '<div class="field"><label>Cliente (opcional)</label><select id="sol_cliente">' + optsClientes(t.cliente_id || '') + '</select></div>' +
        '<div class="field"><label>Tipo</label><select id="sol_tipo" onchange="solicSelNovo(this,\'tipos\')">' + optsSimples(OPC.tipos) + '</select></div>' +
        '<div class="field"><label>Prazo</label><input type="date" id="sol_prazo" value="' + esc(String(t.prazo || '').slice(0, 10)) + '"></div>' +
        '<div class="field"><label>Prioridade</label><select id="sol_prio" onchange="solicSelNovo(this,\'prioridades\')">' + optsObj(OPC.prioridades) + '</select></div>' +
        '<div class="field full-width"><label>Status</label><select id="sol_status" onchange="solicSelNovo(this,\'status\')">' + optsObj(OPC.status) + '</select></div>' +
      '</div>' +
      '<div class="modal-footer">' +
        (id ? '<button class="btn-secondary" style="margin-right:auto;color:#c0392b;border-color:rgba(192,57,43,.3);" onclick="apagarSolic(\'' + esc(id) + '\')">Apagar</button>' : '') +
        '<button class="btn-secondary" onclick="closeModal()">Cancelar</button>' +
        '<button class="btn-primary" onclick="salvarSolic(' + (id ? "'" + esc(id) + "'" : 'null') + ')">Salvar</button>' +
      '</div>';
    // pré-seleciona valores atuais
    var sv = function (i, v) { var e = document.getElementById(i); if (e && v != null && v !== '') e.value = v; };
    sv('sol_pediu', t.pediu || 'Diogo'); sv('sol_faz', t.faz || 'Deborah'); sv('sol_tipo', t.tipo || 'Pesquisa');
    sv('sol_prio', t.prioridade || 'Média'); sv('sol_status', t.status || OPC.status[0].k);
    if (typeof openModal === 'function') openModal();
  };

  window.salvarSolic = async function (id) {
    var g = function (i) { var el = document.getElementById(i); return el ? el.value : ''; };
    var cid = g('sol_cliente');
    var cobj = CLIENTS.find(function (c) { return String(c.id) === String(cid); });
    var dados = {
      titulo: g('sol_titulo').trim(), detalhes: g('sol_detalhes').trim(),
      pediu: g('sol_pediu'), faz: g('sol_faz'),
      cliente_id: cid || '', cliente: cobj ? (cobj.nome || '') : '',
      tipo: g('sol_tipo'), prazo: g('sol_prazo'), prioridade: g('sol_prio'), status: g('sol_status')
    };
    if (dados.pediu === '__novo__' || dados.faz === '__novo__' || dados.tipo === '__novo__' || dados.status === '__novo__' || dados.prioridade === '__novo__') { alert('Termine de adicionar a opção nova antes de salvar.'); return; }
    if (!dados.titulo) { alert('Escreva o que precisa ser feito.'); return; }
    try {
      var url = id ? '/api/solicitacoes/' + encodeURIComponent(id) : '/api/solicitacoes';
      await fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
      if (typeof closeModal === 'function') closeModal();
      await carregar();
      if (typeof showToast === 'function') showToast('Solicitação salva!');
    } catch (e) { alert('Erro ao salvar: ' + e.message); }
  };

  window.apagarSolic = async function (id) {
    if (!confirm('Apagar esta solicitação?')) return;
    try { await fetch('/api/solicitacoes/' + encodeURIComponent(id), { method: 'DELETE' }); if (typeof closeModal === 'function') closeModal(); await carregar(); }
    catch (e) { alert('Erro ao apagar: ' + e.message); }
  };
})();
