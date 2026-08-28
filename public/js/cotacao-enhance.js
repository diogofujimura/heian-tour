/* ============================================================================
   HEIAN TOUR - CAMADA DA COTACAO (nao-destrutiva)
   - Reexibe o cabecalho do editor (Visualizar/Exportar PDF, Voltar, Desfazer)
   - Resumo flutuante recolhivel (pilula de total) + lista "Cotacoes" recolhivel
   - Itens recolhiveis com resumo rico + botoes maiores/espacados
   - Confirmacao ao duplicar e excluir
   - Subtotal por secao + margem/lucro (interno) + alertas
   Reaproveita os calculos existentes; nao altera dados nem integracoes.
   ============================================================================ */
(function () {
  'use strict';
  function el(id) { return document.getElementById(id); }
  var cotActive = false;
  function setCotUI(show) { cotActive = !!show; var f = el('cotFab'), lt = el('cotListToggle'); if (f) f.style.display = show ? '' : 'none'; if (lt) lt.style.display = show ? '' : 'none'; if (!show) { var a = el('cotAside'); if (a) a.classList.remove('open'); } }
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
  function S() { try { return (typeof state !== 'undefined' && state) ? state.orcamento : null; } catch (e) { return null; } }
  function G(name) { try { return (typeof window[name] === 'function') ? window[name] : (eval('typeof ' + name) === 'function' ? eval(name) : null); } catch (e) { return null; } }
  function callTot(fn, item) { var f = G(fn); return f ? num(f(item)) : 0; }
  function getUSDr() { var f = G('getUSD'); return f ? f() : 0.00628; }
  function getBRLr() { try { return parseFloat(state.config.cambio_jpy_brl) || 0.03167; } catch (e) { return 0.03167; } }
  function fmtN(n) { var f = G('fmt'); return f ? f(n) : Math.round(n || 0).toLocaleString('pt-BR'); }
  function fmtY(n) { return '¥ ' + Math.round(n || 0).toLocaleString('pt-BR'); }
  function fmtUSDr(n) { return (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
  function fmtBRLr(n) { return (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  function totals() {
    var s = S() || {};
    var tT = (s.tours || []).reduce(function (a, t) { return a + callTot('calcTotalTour', t); }, 0);
    var tTr = (s.transportes || []).reduce(function (a, t) { return a + callTot('calcTotalTransporte', t); }, 0);
    var tEx = (s.experiencias || []).reduce(function (a, e) { return a + callTot('calcTotalExp', e); }, 0);
    var tIt = (s.itensAdicionais || []).reduce(function (a, i) { return a + num(i.valor); }, 0);
    var cons = 0; var gc = G('getConsultoriaVal'); if (gc) cons = num(gc());
    var total = tT + tTr + tEx + tIt + cons;
    return { tT: tT, tTr: tTr, tEx: tEx, tIt: tIt, cons: cons, total: total, sinal: tT * 0.30 };
  }

  /* ---- resumo flutuante + pilula ---- */
  function ensureFloat() {
    var page = el('page-orcamento'); if (!page) return false;
    if (el('cotFab')) return true;
    var fab = document.createElement('button'); fab.id = 'cotFab'; fab.type = 'button'; fab.className = 'cot-fab';
    fab.innerHTML = '<span class="cot-fab-lbl">Resumo</span><b class="cot-fab-val" id="cotFabVal">¥ 0</b><span class="cot-fab-ic">▴</span>';
    document.body.appendChild(fab);
    var aside = document.createElement('div'); aside.id = 'cotAside'; aside.className = 'cot-aside';
    document.body.appendChild(aside);
    fab.addEventListener('click', function () { toggleAside(); });
    return true;
  }
  function toggleAside(open) {
    var a = el('cotAside'), fab = el('cotFab'); if (!a) return;
    var willOpen = (open === undefined) ? !a.classList.contains('open') : !!open;
    a.classList.toggle('open', willOpen);
    if (fab) { var ic = fab.querySelector('.cot-fab-ic'); if (ic) ic.textContent = willOpen ? '▾' : '▴'; }
  }
  function ensureAside() {
    var aside = el('cotAside'); if (!aside || aside.__built) return;
    aside.__built = true;
    aside.innerHTML =
      '<div class="cot-aside-top"><span>RESUMO FINANCEIRO</span><button type="button" id="cotClose" class="cot-close">✕</button></div>' +
      '<div class="cot-total-box"><div class="cot-total-lbl">TOTAL GERAL</div>' +
      '<div class="cot-total" id="cotTotal">¥ 0</div><div class="cot-total-sub" id="cotTotalSub"></div></div>' +
      '<div class="cot-rows">' +
      '<div class="cot-row"><span>Tours</span><b id="cotRowTours">¥ 0</b></div>' +
      '<div class="cot-row"><span>Transportes</span><b id="cotRowTransp">¥ 0</b></div>' +
      '<div class="cot-row"><span>Experiências</span><b id="cotRowExp">¥ 0</b></div>' +
      '<div class="cot-row" id="cotRowItensWrap"><span>Itens Adicionais</span><b id="cotRowItens">¥ 0</b></div>' +
      '<div class="cot-row" id="cotRowConsWrap"><span>Roteirização</span><b id="cotRowCons">—</b></div>' +
      '</div>' +
      '<div class="cot-sinal"><div class="cot-sinal-lbl">SINAL 30% · TOURS</div><div class="cot-sinal-val" id="cotSinal">¥ 0</div></div>' +
      '<div class="cot-margem"><div class="cot-margem-h">LUCRO &amp; ACERTO <span>· interno</span></div>' +
      '<div class="cot-row"><span>Lucro Heian</span><b id="cotLucroH">—</b></div>' +
      '<div class="cot-row"><span>Acerto cliente</span><b id="cotAcerto">—</b></div>' +
      '<div class="cot-econ-note" id="cotEconNote"></div></div>' +
      '<div class="cot-alertas" id="cotAlertas"></div>';
    var close = el('cotClose'); if (close) close.addEventListener('click', function () { toggleAside(false); });
  }
  function updateMargem() {
    var t = totals().total, custo = num((el('cotCusto') || {}).value);
    var L = el('cotLucro'), M = el('cotMargem'); if (!L || !M) return;
    if (custo > 0) { var l = t - custo; L.textContent = fmtY(l); L.style.color = l < 0 ? '#B23A3A' : '#3E7A53'; M.textContent = (t > 0 ? (l / t * 100) : 0).toFixed(1) + '%'; }
    else { L.textContent = '—'; L.style.color = ''; M.textContent = '—'; }
  }
  function buildAlerts() {
    var s = S() || {}, a = [];
    (s.tours || []).forEach(function (t, i) { if (!(num(t.valor) > 0)) a.push('Tour ' + (i + 1) + ' sem valor.'); });
    (s.transportes || []).forEach(function (t, i) { if (!(callTot('calcTotalTransporte', t) > 0)) a.push('Transporte ' + (i + 1) + ' sem valor.'); });
    (s.experiencias || []).forEach(function (e, i) { if (!(callTot('calcTotalExp', e) > 0)) a.push('Experiência ' + (i + 1) + ' sem valor.'); });
    if ((s.tours || []).length === 0) a.push('Cotação sem nenhum tour.');
    try {
      var rn = s.orcRoteiroVinculado;
      if (rn && window.dbRotas && window.dbRotas[rn]) {
        var rot = window.dbRotas[rn], dias = Array.isArray(rot) ? rot : (rot.dias || []), rT = 0, rE = 0;
        dias.forEach(function (d) { (d.elementos || []).forEach(function (e) { if (e.tipo === 'transporte') rT++; if (e.tipo === 'experiencia') rE++; }); });
        if (rT > (s.transportes || []).length) a.push('Roteiro tem ' + rT + ' deslocamentos; cotação tem ' + (s.transportes || []).length + '.');
        if (rE > (s.experiencias || []).length) a.push('Roteiro tem ' + rE + ' experiências; cotação tem ' + (s.experiencias || []).length + '.');
      }
    } catch (e) {}
    return a;
  }
  function refresh() {
    var t = totals(), u = getUSDr(), b = getBRLr();
    var set = function (id, v) { var e = el(id); if (e) e.textContent = v; };
    set('cotFabVal', fmtY(t.total)); set('cotTotal', fmtY(t.total));
    set('cotTotalSub', fmtBRLr(t.total * b) + ' · ' + fmtUSDr(t.total * u));
    set('cotRowTours', fmtY(t.tT)); set('cotRowTransp', fmtY(t.tTr)); set('cotRowExp', fmtY(t.tEx));
    set('cotRowItens', fmtY(t.tIt)); var iw = el('cotRowItensWrap'); if (iw) iw.style.display = t.tIt > 0 ? '' : 'none';
    set('cotRowCons', t.cons > 0 ? fmtY(t.cons) : '—'); set('cotSinal', fmtY(t.sinal));
    updateEcon();
    var al = buildAlerts(), box = el('cotAlertas'), fab = el('cotFab');
    if (box) box.innerHTML = al.length
      ? '<div class="cot-al-h">' + al.length + ' alerta' + (al.length > 1 ? 's' : '') + '</div>' + al.slice(0, 6).map(function (w) { return '<span class="cot-al-i">• ' + esc(w) + '</span>'; }).join('')
      : '<div class="cot-al-ok">✓ Sem inconsistências.</div>';
    if (fab) fab.classList.toggle('has-alert', al.length > 0);
    refreshTitles(t);
  }
  function setCardSub(listId, total) {
    var c = el(listId); if (!c) return; var card = c.closest('.card'); if (!card) return;
    var title = card.querySelector('.card-title'); if (!title) return;
    var sub = title.querySelector('.cot-card-sub');
    if (!sub) { sub = document.createElement('span'); sub.className = 'cot-card-sub'; title.appendChild(sub); }
    sub.textContent = total > 0 ? fmtY(total) : '';
  }
  function refreshTitles(t) { setCardSub('toursList', t.tT); setCardSub('transportesList', t.tTr); setCardSub('experienciasList', t.tEx); setCardSub('itensAdicionaisList', t.tIt); }

  /* ---- reexibe cabecalho do editor + bota a lista la dentro ---- */
  function ensureHeaderAndListToggle() {
    var listEl = el('orcamentosLista'); if (!listEl) return;
    var layout = listEl.closest('.pane-layout');
    if (layout && !layout.__cotList) { layout.__cotList = true; layout.classList.add('cot-list-hidden'); }
    if (el('cotListToggle') || !layout) return;
    var btn = document.createElement('button'); btn.id = 'cotListToggle'; btn.type = 'button'; btn.className = 'btn-secondary cot-list-toggle';
    btn.innerHTML = '☰ Cotações';
    btn.addEventListener('click', function () { var hidden = layout.classList.toggle('cot-list-hidden'); btn.classList.toggle('on', !hidden); });
    var actions = document.querySelector('#orcamentosEditorWrapper .header-actions') || document.querySelector('#page-orcamento .header-actions');
    if (actions) actions.insertBefore(btn, actions.firstChild); else document.body.appendChild(btn);
  }

  /* ---- resumo rico por item ---- */
  function itemSummary(arrName, item) {
    if (!item) return '<span class="cot-empty">— preencher —</span>';
    if (arrName === 'tours') {
      var parts = []; parts.push('<b>' + esc(item.descricao || 'Tour') + '</b>');
      var city = tourCity(item.data); if (city) parts.push(esc(city));
      if (item.duracao) parts.push(item.duracao);
      parts.push((item.descontoAtivo && num(item.desconto) > 0) ? ('desconto ' + num(item.desconto) + '%') : 'sem desconto');
      return parts.join(' · ');
    }
    if (arrName === 'transportes') {
      var dl = (item.descricao || '').toLowerCase();
      var isTransfer = dl.indexOf('transfer') >= 0 || dl.indexOf('privado') >= 0 || dl.indexOf('privativo') >= 0;
      var modo;
      if (isTransfer) modo = 'preço fixo ¥' + fmtN(num(item.preco));
      else {
        var ps = [];
        if (num(item.adultos)) ps.push(num(item.adultos) + ' ad × ¥' + fmtN(num(item.preco)));
        if (num(item.criancas)) ps.push(num(item.criancas) + ' cr × ¥' + fmtN(num(item.precoInfantil)));
        modo = 'por pessoa (' + (ps.join(' + ') || '—') + ')';
      }
      if (item.taxaAtiva) modo += ' + taxa ¥' + fmtN(num(item.taxaValor) || 3000) + (item.taxaTipo === 'grupo' ? ' (grupo)' : ' (por pessoa)');
      var nome = item.descricao || (isTransfer ? 'Transfer' : 'Transporte');
      return '<b>' + esc(nome) + '</b> · ' + modo;
    }
    if (arrName === 'experiencias') {
      var en = item.nome || item.descricao || 'Experiência';
      var ed = []; if (item.data) ed.push(fmtBRdate(item.data));
      return '<b>' + esc(en) + '</b>' + (ed.length ? ' · ' + ed.join(' · ') : '');
    }
    return '<b>' + esc(item.descricao || item.nome || 'Item') + '</b>' + (num(item.valor) ? ' · ¥' + fmtN(num(item.valor)) : '');
  }
  function fmtBRdate(s) { if (!s) return ''; var p = String(s).split('-'); return p.length < 3 ? s : p[2] + '/' + p[1]; }

  /* ---- itens recolhiveis + duplicar/excluir com confirmacao ---- */
  var RENDER = { toursList: ['tours', 'renderToursForm'], transportesList: ['transportes', 'renderTransportesForm'], experienciasList: ['experiencias', 'renderExperienciasForm'], itensAdicionaisList: ['itensAdicionais', 'renderItensAdicionaisForm'] };
  function listInfoOf(row) { for (var id in RENDER) { var c = el(id); if (c && c.contains(row)) return { id: id, arr: RENDER[id][0], fn: RENDER[id][1] }; } return null; }
  function rowIndex(info, row) { var c = el(info.id); if (!c) return -1; var rows = c.querySelectorAll('.item-row'); for (var i = 0; i < rows.length; i++) if (rows[i] === row) return i; return -1; }
  function itemOf(info, row) { var s = S(); if (!s || !s[info.arr]) return null; var i = rowIndex(info, row); return i >= 0 ? s[info.arr][i] : null; }
  // cidade do tour: derivada do roteiro vinculado, casando a data
  function cityFromDia(dia) { var els = (dia && dia.elementos) || []; var i; for (i = 0; i < els.length; i++) if (els[i].tipo === 'sequencia' && els[i].cidade) return els[i].cidade; for (i = 0; i < els.length; i++) if (els[i].tipo === 'transporte' && (els[i].cidadeDestino || els[i].cidadeOrigem)) return els[i].cidadeDestino || els[i].cidadeOrigem; return ''; }
  function tourCity(dateStr) { try { var s = S(); if (!s || !s.orcRoteiroVinculado || !window.dbRotas) return ''; var rot = window.dbRotas[s.orcRoteiroVinculado]; if (!rot) return ''; var dias = Array.isArray(rot) ? rot : (rot.dias || []); for (var i = 0; i < dias.length; i++) if (dias[i].data && dias[i].data === dateStr) return cityFromDia(dias[i]); } catch (e) {} return ''; }
  function duplicarItem(row) {
    try {
      var info = listInfoOf(row), s = S(); if (!info || !s || !s[info.arr]) return;
      var arr = s[info.arr], idx = rowIndex(info, row);
      if (idx < 0 || !arr[idx]) return;
      if (!window.confirm('Duplicar este item?')) return;
      if (window.registrarEstadoCotacao) try { window.registrarEstadoCotacao(s); } catch (e) {}
      var clone = JSON.parse(JSON.stringify(arr[idx])); clone.id = Date.now() + Math.floor(Math.random() * 1000);
      arr.splice(idx + 1, 0, clone);
      var f = G(info.fn); if (f) f(); var ur = G('updateResumo'); if (ur) ur();
    } catch (e) { console.warn('[cotacao-enhance] duplicar:', e); }
  }
  // ---- Fase 1: custo real + lucro/acerto por item ----
  function taxaTransp(t) { return t.taxaAtiva ? (t.taxaTipo === 'grupo' ? num(t.taxaValor) : num(t.taxaValor) * ((num(t.adultos) + num(t.criancas)) || 1)) : 0; }
  function taxaExp(e) { return e.taxaAtiva ? (e.taxaTipo === 'grupo' ? num(e.taxaValor) : num(e.taxaValor) * (num(e.pessoas) || 1)) : 0; }
  function isTransferItem(t) { var dl = (t.descricao || '').toLowerCase(); return dl.indexOf('transfer') >= 0 || dl.indexOf('privado') >= 0 || dl.indexOf('privativo') >= 0; }
  function itemEcon(arrName, item) {
    var custo = num(item.custoReal), temCusto = custo > 0;
    if (arrName === 'tours') { var v = callTot('calcTotalTour', item); return { policy: 'fechado', venda: v, custo: custo, temCusto: temCusto, lucro: temCusto ? v - custo : 0, acerto: 0 }; }
    if (arrName === 'transportes') {
      var vt = callTot('calcTotalTransporte', item);
      if (isTransferItem(item)) return { policy: 'fechado', venda: vt, custo: custo, temCusto: temCusto, lucro: temCusto ? vt - custo : 0, acerto: 0 };
      var taxa = taxaTransp(item), base = vt - taxa;
      return { policy: 'acerto', venda: vt, taxa: taxa, base: base, custo: custo, temCusto: temCusto, lucro: taxa, acerto: temCusto ? (base - custo) : 0 };
    }
    if (arrName === 'experiencias') { var ve = callTot('calcTotalExp', item), te = taxaExp(item), be = ve - te; return { policy: 'acerto', venda: ve, taxa: te, base: be, custo: custo, temCusto: temCusto, lucro: te, acerto: temCusto ? (be - custo) : 0 }; }
    return { policy: 'fechado', venda: num(item.valor), custo: custo, temCusto: temCusto, lucro: temCusto ? num(item.valor) - custo : 0, acerto: 0 };
  }
  function economicsAll() {
    var s2 = S() || {}, lucro = 0, acerto = 0, pend = 0;
    ['tours', 'transportes', 'experiencias', 'itensAdicionais'].forEach(function (arr) {
      (s2[arr] || []).forEach(function (it) {
        var ec = itemEcon(arr, it);
        if (!ec.temCusto) pend++;
        if (ec.policy === 'acerto') { lucro += num(ec.lucro); if (ec.temCusto) acerto += num(ec.acerto); }
        else if (ec.temCusto) lucro += num(ec.lucro);
      });
    });
    return { lucro: lucro, acerto: acerto, pend: pend };
  }
  function updateEcon() {
    var ec = economicsAll(), L = el('cotLucroH'), A = el('cotAcerto'), N = el('cotEconNote');
    if (L) { L.textContent = fmtY(ec.lucro); L.style.color = ec.lucro < 0 ? '#B23A3A' : '#3E7A53'; }
    if (A) {
      if (ec.acerto > 0) { A.textContent = 'devolver ' + fmtY(ec.acerto); A.style.color = '#B23A3A'; }
      else if (ec.acerto < 0) { A.textContent = 'cobrar ' + fmtY(-ec.acerto); A.style.color = '#3E7A53'; }
      else { A.textContent = '—'; A.style.color = ''; }
    }
    if (N) N.textContent = ec.pend > 0 ? (ec.pend + ' item(ns) sem custo real lançado') : '';
  }
  function fichaField(label, key, val) { return '<label class="cot-ficha-row"><span>' + label + '</span><input type="number" class="cot-ficha-in" data-k="' + key + '" value="' + (val || '') + '" placeholder="0"></label>'; }
  function updateEconLine(box, info, row) {
    var it = itemOf(info, row); if (!it) return; var ec = itemEcon(info.arr, it);
    var line = box.querySelector('.cot-econ'); if (!line) return;
    if (!ec.temCusto) { line.innerHTML = '<span class="cot-econ-pend">custo real não lançado</span>'; return; }
    if (ec.policy === 'fechado') { line.innerHTML = 'Lucro: <b>' + fmtY(ec.lucro) + '</b>'; }
    else {
      var h = 'Sua taxa: <b>' + fmtY(ec.lucro) + '</b> · ';
      if (ec.acerto > 0) h += 'devolver <b>' + fmtY(ec.acerto) + '</b> ao cliente';
      else if (ec.acerto < 0) h += 'cobrar <b>' + fmtY(-ec.acerto) + '</b> do cliente';
      else h += 'sem acerto';
      line.innerHTML = h;
    }
  }
  function pushEcon() { updateEcon(); var as = G('autoSave'); if (as) as(); }
  function injectCusto(body, info, row) {
    if (!info || body.querySelector('.cot-custo')) return;
    var it = itemOf(info, row); if (!it) return;
    var transfer = (info.arr === 'transportes') && isTransferItem(it);
    var box = document.createElement('div'); box.className = 'cot-custo';
    var inner = '<div class="cot-custo-h">\uD83D\uDCB0 Custo real (interno \u2014 nao aparece pro cliente)</div>';
    if (transfer) {
      it.ficha = it.ficha || {};
      inner += '<div class="cot-ficha">' +
        fichaField('Fornecedor / Motorista', 'fornecedor', it.ficha.fornecedor) +
        fichaField('Aluguel do carro', 'aluguel', it.ficha.aluguel) +
        fichaField('Pedagio (Kosoku)', 'kosoku', it.ficha.kosoku) +
        fichaField('Estacionamento', 'estacionamento', it.ficha.estacionamento) +
        '</div><div class="cot-custo-sum">Custo total: <b class="cot-custo-val"></b></div>';
    } else {
      inner += '<label class="cot-custo-row"><span>Custo real \u00a5</span><input type="number" class="cot-custo-in" value="' + (it.custoReal || '') + '" placeholder="0"></label>';
    }
    inner += '<div class="cot-econ"></div>';
    box.innerHTML = inner; body.appendChild(box);
    if (transfer) {
      box.querySelectorAll('.cot-ficha-in').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var i2 = itemOf(info, row); if (!i2) return; i2.ficha = i2.ficha || {};
          i2.ficha[this.getAttribute('data-k')] = num(this.value);
          i2.custoReal = num(i2.ficha.fornecedor) + num(i2.ficha.aluguel) + num(i2.ficha.kosoku) + num(i2.ficha.estacionamento);
          var sv = box.querySelector('.cot-custo-val'); if (sv) sv.textContent = fmtY(i2.custoReal);
          updateEconLine(box, info, row); pushEcon();
        });
      });
      var sv0 = box.querySelector('.cot-custo-val'); if (sv0) sv0.textContent = fmtY(it.custoReal);
    } else {
      var inp0 = box.querySelector('.cot-custo-in');
      if (inp0) inp0.addEventListener('input', function () { var i2 = itemOf(info, row); if (!i2) return; i2.custoReal = num(this.value); updateEconLine(box, info, row); pushEcon(); });
    }
    updateEconLine(box, info, row);
  }
  // Lembra o estado aberto/minimizado de cada item (por id) entre re-renders. Sem isto, ligar
  // o desconto/taxa (que re-renderiza a lista) fazia o card voltar a minimizar e o usuário perdia
  // o lugar. Pedido do Diogo.
  var cotAbertoPorId = {};
  function collapseItems() {
    var page = el('page-orcamento'); if (!page) return;
    page.querySelectorAll('.item-row').forEach(function (row) {
      if (row.__cot) return; row.__cot = true;
      var head = row.querySelector('.item-row-header'), body = row.querySelector('.form-grid');
      if (!head || !body) return;
      var info = listInfoOf(row);
      var _it = info ? itemOf(info, row) : null; var _iid = (_it && _it.id != null) ? _it.id : null;
      var nameSpan = document.createElement('span'); nameSpan.className = 'cot-item-name';
      var setName = function () { nameSpan.innerHTML = info ? itemSummary(info.arr, itemOf(info, row)) : esc((body.querySelector('input[type="text"]') || {}).value || ''); };
      setName();
      var numEl = head.querySelector('.item-row-num');
      if (numEl) numEl.insertAdjacentElement('afterend', nameSpan); else head.insertBefore(nameSpan, head.firstChild);

      var actions = document.createElement('div'); actions.className = 'cot-actions';
      var dup = document.createElement('button'); dup.type = 'button'; dup.className = 'cot-dup'; dup.title = 'Duplicar item'; dup.textContent = '⧉';
      dup.addEventListener('click', function (e) { e.stopPropagation(); duplicarItem(row); });
      var chev = document.createElement('button'); chev.type = 'button'; chev.className = 'cot-chev-btn'; chev.title = 'Expandir / recolher';
      var rm = head.querySelector('.btn-remove');
      actions.appendChild(dup); actions.appendChild(chev);
      if (rm) {
        var origOnclick = rm.getAttribute('onclick'); rm.removeAttribute('onclick'); rm.title = 'Excluir item';
        rm.addEventListener('click', function (e) {
          e.stopPropagation();
          if (window.confirm('Excluir este item da cotação?')) { try { if (origOnclick) new Function(origOnclick).call(rm); } catch (err) { console.warn(err); } }
        });
        actions.appendChild(rm);
      }
      head.appendChild(actions);
      injectCusto(body, info, row);

      function setOpen(open) { row.classList.toggle('cot-open', open); row.classList.toggle('cot-collapsed', !open); chev.textContent = open ? '⌃' : '⌄'; if (!open) setName(); if (_iid != null) cotAbertoPorId[_iid] = open; }
      // Se já lembramos o estado deste item, usa ele (preserva entre re-renders); senão, abre só
      // quando é item novo (primeiro campo de texto vazio).
      var startOpen = (_iid != null && cotAbertoPorId[_iid] !== undefined) ? cotAbertoPorId[_iid] : !((body.querySelector('input[type="text"]') || {}).value || '').trim();
      setOpen(startOpen);
      chev.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!row.classList.contains('cot-open')); });
      head.addEventListener('click', function (e) { if (e.target.closest('.cot-actions')) return; setOpen(!row.classList.contains('cot-open')); });
      head.style.cursor = 'pointer';
    });
  }

  function hideOriginalResumo() { var g = el('resumoGrid'); if (g) { var c = g.closest('.card'); if (c) c.classList.add('cot-hide-original'); } }

  function enhance() {
    if (!S()) return;
    if (!ensureFloat()) return;
    ensureAside(); ensureHeaderAndListToggle(); hideOriginalResumo(); collapseItems(); refresh();
    setCotUI(cotActive);
  }
  function hook() {
    if (window.__cotHooked) return;
    if (typeof window.updateResumo !== 'function') { return setTimeout(hook, 300); }
    var orig = window.updateResumo;
    window.updateResumo = function () { var r = orig.apply(this, arguments); try { enhance(); } catch (e) { console.warn('[cotacao-enhance]', e); } return r; };
    ['renderToursForm', 'renderTransportesForm', 'renderExperienciasForm', 'renderItensAdicionaisForm'].forEach(function (fn) {
      if (typeof window[fn] === 'function' && !window[fn].__cotWrap) {
        var o = window[fn]; var w = function () { var r = o.apply(this, arguments); try { collapseItems(); } catch (e) {} return r; };
        w.__cotWrap = true; window[fn] = w;
      }
    });
    if (typeof window.navToPage === 'function' && !window.navToPage.__cotWrap) {
      var onav = window.navToPage;
      window.navToPage = function (pg) { var r = onav.apply(this, arguments); try { setCotUI(pg === 'orcamento'); } catch (e) {} return r; };
      window.navToPage.__cotWrap = true;
    }
    window.__cotHooked = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
})();
