/* ============================================================================
   HEIAN TOUR - CAMADA DO CONSTRUTOR DE ROTEIRO (nao-destrutiva)
   Envolve renderEditDias (sem reescreve-lo) e adiciona:
   - Trilha de dias (esquerda)   - Cartoes recolhiveis dos elementos
   - Resumo + total estimado ao vivo (direita)   - Validacao automatica
   - Duplicar dia   - Esconde a coluna "Roteiros" durante a edicao
   Tudo dentro de try/catch: se algo falhar aqui, o construtor original
   continua funcionando. Nao toca em dados nem integracoes.
   ========================================================================== */
(function () {
  'use strict';
  var EXPANDED = new Set();
  var WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  var ICON = { sequencia: '◇', transporte: '⇄', experiencia: '🎟', texto: '✎', info: '◷' };

  function R() { return window.roteiroEmEdicao; }
  function el$(id) { return document.getElementById(id); }
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }

  function weekday(dateStr) {
    if (!dateStr) return '';
    var p = String(dateStr).split('-'); if (p.length < 3) return '';
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d) ? '' : WD[d.getDay()];
  }
  function paxOf(elx, cli) {
    var a = elx.adultos !== undefined ? elx.adultos : (cli && cli.adultos) || 2;
    var c = elx.criancas !== undefined ? elx.criancas : (cli && cli.criancas) || 0;
    return { a: num(a), c: num(c) };
  }
  function paxLabel(elx, cli) {
    var p = paxOf(elx, cli), out = [];
    if (p.a) out.push(p.a + (p.a > 1 ? ' Adultos' : ' Adulto'));
    if (p.c) out.push(p.c + (p.c > 1 ? ' Criancas' : ' Crianca'));
    return out.join(', ');
  }
  function priceOf(o) {
    if (!o) return 0;
    return num(o.preco != null ? o.preco : o.valor != null ? o.valor :
      o.precoYen != null ? o.precoYen : o['preço'] != null ? o['preço'] : o.price);
  }
  function cityOfDay(dia) {
    if (!dia || !dia.elementos) return '';
    for (var i = 0; i < dia.elementos.length; i++) {
      var e = dia.elementos[i];
      if (e.tipo === 'sequencia' && e.cidade) return e.cidade;
    }
    for (var j = 0; j < dia.elementos.length; j++) {
      var t = dia.elementos[j];
      if (t.tipo === 'transporte' && (t.cidadeDestino || t.cidadeOrigem)) return t.cidadeDestino || t.cidadeOrigem;
    }
    return '';
  }
  function dayStops(dia) {
    var s = 0, tr = 0;
    (dia.elementos || []).forEach(function (e) {
      if (e.tipo === 'sequencia') s += (e.atracoesDoDia || []).length;
      if (e.tipo === 'transporte') tr++;
    });
    return { stops: s, transfers: tr };
  }

  function elSummary(elx, dia) {
    var cli = R() && R().cliente, title, sub, flag = '';
    if (elx.tipo === 'sequencia') {
      title = elx.nomeDaRota || (elx.cidade ? 'Atracoes - ' + elx.cidade : 'Sequencia de atracoes');
      var atr = elx.atracoesDoDia || [];
      sub = atr.length ? atr.join(', ') : 'sem atracoes ainda';
      if (window.verificarFuncionamentoAtracao && dia && dia.data) {
        for (var i = 0; i < atr.length; i++) {
          try { var c = window.verificarFuncionamentoAtracao(atr[i], dia.data); if (c && c.fechado) { flag = '● ' + atr[i] + ' fecha na data'; break; } } catch (e) {}
        }
      }
    } else if (elx.tipo === 'transporte') {
      if (elx.cidadeDestino) title = (elx.cidadeOrigem || '?') + ' → ' + elx.cidadeDestino;
      else title = elx.tipoTransporte || 'Deslocamento';
      var parts = [];
      if (elx.horario) parts.push(elx.horario);
      if (elx.tipoTransporte) parts.push(elx.tipoTransporte + (elx.linha && elx.linha !== 'Personalizado' ? ' (' + elx.linha + ')' : ''));
      parts.push(paxLabel(elx, cli));
      if (elx.compradoHeian !== false) parts.push('emitido p/ Heian');
      sub = elx.tipoTransporte ? parts.join(' - ') : 'selecionar transporte';
    } else if (elx.tipo === 'experiencia') {
      title = elx.nomeExp || 'Experiencia / ticket';
      var ep = []; if (elx.horaPartida) ep.push(elx.horaPartida); ep.push(paxLabel(elx, cli));
      sub = elx.nomeExp ? ep.join(' - ') : 'buscar experiencia';
    } else if (elx.tipo === 'texto') {
      title = 'Texto livre';
      sub = (elx.conteudo || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70) || 'mensagem ao cliente';
    } else if (elx.tipo === 'info') {
      title = 'Info de encontro';
      var ip = []; if (elx.horarioEncontro) ip.push(elx.horarioEncontro); if (elx.localEncontro) ip.push(elx.localEncontro);
      sub = ip.join(' - ') || 'horario e local';
    } else { title = elx.tipo || 'Item'; sub = ''; }
    return { title: title, sub: sub, flag: flag };
  }

  function estimate() {
    var r = R(); if (!r || !r.dias) return { total: 0, partial: true };
    var total = 0, cli = r.cliente, tCache = window.dbTransportesCache, eCache = window.dbExperienciasCache;
    r.dias.forEach(function (dia) {
      (dia.elementos || []).forEach(function (e) {
        var p = paxOf(e, cli), heads = p.a + p.c || 1;
        if (e.tipo === 'transporte') {
          if (e.trechoId === 'custom') total += num(e.precoManual) * heads;
          else if (tCache) { var t = tCache.find(function (x) { return x.id == e.trechoId; }); if (t) total += priceOf(t) * heads; }
        } else if (e.tipo === 'experiencia') {
          if (eCache) { var x = eCache.find(function (y) { return y.id == e.expId; }); if (x) total += priceOf(x) * heads; }
        }
      });
    });
    return { total: total, partial: true };
  }

  function analyze() {
    var r = R(); var c = { dias: 0, atr: 0, transp: 0, exp: 0, guiados: 0 }, warns = [];
    if (!r || !r.dias) return { c: c, warns: warns };
    c.dias = r.dias.length;
    r.dias.forEach(function (dia, d) {
      if (dia.tourGuiado) c.guiados++;
      var st = dayStops(dia); c.atr += st.stops; c.transp += st.transfers;
      (dia.elementos || []).forEach(function (e) { if (e.tipo === 'experiencia') c.exp++; });
      var numLabel = 'Dia ' + (dia.numeroDia || d + 1);
      if (!dia.elementos || dia.elementos.length === 0) warns.push(numLabel + ' esta sem itens.');
      if (window.verificarFuncionamentoAtracao && dia.data) {
        (dia.elementos || []).forEach(function (e) {
          if (e.tipo === 'sequencia') (e.atracoesDoDia || []).forEach(function (a) {
            try { var ck = window.verificarFuncionamentoAtracao(a, dia.data); if (ck && ck.fechado) warns.push(numLabel + ': ' + a + ' fecha neste dia.'); } catch (er) {}
          });
        });
      }
      if (d > 0) {
        var prev = cityOfDay(r.dias[d - 1]), cur = cityOfDay(dia);
        var hasTransp = (dia.elementos || []).some(function (e) { return e.tipo === 'transporte'; });
        if (prev && cur && prev !== cur && !hasTransp) warns.push(numLabel + ': muda de ' + prev + ' p/ ' + cur + ' sem deslocamento.');
      }
    });
    return { c: c, warns: warns };
  }

  function ensureShell() {
    var list = el$('editRoteiroDiasList'); if (!list) return false;
    if (list.parentElement && list.parentElement.classList.contains('rb-mid')) return true;
    var shell = document.createElement('div'); shell.className = 'rb-shell';
    var rail = document.createElement('div'); rail.id = 'rbRail'; rail.className = 'rb-rail';
    var mid = document.createElement('div'); mid.className = 'rb-mid';
    var summary = document.createElement('div'); summary.id = 'rbSummary'; summary.className = 'rb-summary';
    list.parentNode.insertBefore(shell, list);
    mid.appendChild(list);
    var addBtn = el$('btnAddDiaRoteiro'); if (addBtn) mid.appendChild(addBtn);
    shell.appendChild(rail); shell.appendChild(mid); shell.appendChild(summary);
    return true;
  }

  function renderRail() {
    var rail = el$('rbRail'), r = R(); if (!rail || !r || !r.dias) return;
    var html = '<div class="rb-rail-head"><span>DIAS DA VIAGEM</span><b>' + r.dias.length + '</b></div>';
    r.dias.forEach(function (dia, d) {
      var st = dayStops(dia), city = cityOfDay(dia) || 'Dia ' + (dia.numeroDia || d + 1);
      var sub = []; if (st.stops) sub.push(st.stops + (st.stops > 1 ? ' paradas' : ' parada'));
      if (st.transfers) sub.push(st.transfers + ' transfer' + (st.transfers > 1 ? 's' : ''));
      html += '<div class="rb-day" data-day="' + d + '">' +
        '<div class="rb-day-num"><div class="d">' + String(dia.numeroDia || d + 1).padStart(2, '0') + '</div><div class="w">' + (weekday(dia.data) || '-') + '</div></div>' +
        '<div class="rb-day-info"><div class="t">' + esc(city) + '</div><div class="s">' + (sub.join(' - ') || '-') + '</div></div>' +
        '<button class="rb-day-dup" data-dup="' + d + '" title="Duplicar dia">⧉</button></div>';
    });
    rail.innerHTML = html;
    rail.querySelectorAll('.rb-day').forEach(function (node) {
      node.addEventListener('click', function (ev) {
        if (ev.target.classList.contains('rb-day-dup')) return;
        var i = +node.getAttribute('data-day');
        var cards = document.querySelectorAll('#editRoteiroDiasList > .dia-card');
        if (cards[i]) cards[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
        rail.querySelectorAll('.rb-day').forEach(function (n) { n.classList.remove('active'); });
        node.classList.add('active');
      });
    });
    rail.querySelectorAll('.rb-day-dup').forEach(function (b) {
      b.addEventListener('click', function (ev) { ev.stopPropagation(); window.duplicarDiaRoteiro(+b.getAttribute('data-dup')); });
    });
  }

  function stat(label, val) { return '<div class="rb-stat"><span>' + label + '</span><b>' + val + '</b></div>'; }

  function renderSummary() {
    var box = el$('rbSummary'); if (!box) return;
    var a = analyze(), est = estimate();
    var totalHtml;
    if (est.total > 0) {
      totalHtml = '<div class="rb-total">¥ ' + Math.round(est.total).toLocaleString('pt-BR') + '</div><div class="rb-total-sub">estimativa - confirme na cotacao</div>';
    } else {
      totalHtml = '<div class="rb-total" style="font-size:15px">Calcular</div><div class="rb-total-sub">total na aba Cotacao</div>';
    }
    var stats = stat('Dias', a.c.dias) + stat('Atracoes', a.c.atr) + stat('Deslocamentos', a.c.transp) +
      stat('Experiencias', a.c.exp) + stat('Tours guiados', a.c.guiados);
    var warnHtml;
    if (a.warns.length) {
      warnHtml = '<div class="rb-warn"><b>' + a.warns.length + ' aviso' + (a.warns.length > 1 ? 's' : '') + ':</b>' +
        a.warns.slice(0, 6).map(function (w) { return '<span class="rb-warn-item">- ' + esc(w) + '</span>'; }).join('') +
        (a.warns.length > 6 ? '<span class="rb-warn-item">...</span>' : '') + '</div>';
    } else {
      warnHtml = '<div class="rb-warn ok">✓ Sem avisos. Roteiro consistente.</div>';
    }
    box.innerHTML = '<h4>RESUMO</h4>' + totalHtml + '<div style="margin-top:14px">' + stats + '</div>' + warnHtml;
  }

  function collapseCards() {
    var list = el$('editRoteiroDiasList'), r = R(); if (!list || !r || !r.dias) return;
    var dayCards = list.querySelectorAll(':scope > .dia-card');
    dayCards.forEach(function (card, d) {
      var dia = r.dias[d]; if (!dia) return;
      var blocks = card.querySelectorAll(':scope > div[style*="border-left"]');
      blocks.forEach(function (block, e) {
        if (block.parentElement && block.parentElement.classList.contains('rb-card-body')) return;
        var elx = dia.elementos && dia.elementos[e]; if (!elx) return;
        wrapCard(block, d, e, elx, dia);
      });
    });
  }
  function wrapCard(block, d, e, elx, dia) {
    var key = d + '-' + e, sum = elSummary(elx, dia), open = EXPANDED.has(key);
    var wrap = document.createElement('div'); wrap.className = 'rb-card' + (open ? ' open' : '');
    var head = document.createElement('div'); head.className = 'rb-card-head';
    head.innerHTML = '<div class="rb-card-ico rb-ico-' + elx.tipo + '">' + (ICON[elx.tipo] || '•') + '</div>' +
      '<div class="rb-card-meta"><div class="t">' + esc(sum.title) +
      (sum.flag ? '<span class="rb-flag">' + esc(sum.flag) + '</span>' : '') +
      '</div><div class="s">' + esc(sum.sub) + '</div></div>' +
      '<div class="rb-card-chev">' + (open ? '⌃ recolher' : '⌄ editar') + '</div>';
    var body = document.createElement('div'); body.className = 'rb-card-body';
    block.parentNode.insertBefore(wrap, block);
    wrap.appendChild(head); wrap.appendChild(body); body.appendChild(block);
    head.addEventListener('click', function () {
      var nowOpen = !wrap.classList.contains('open');
      wrap.classList.toggle('open', nowOpen);
      if (nowOpen) EXPANDED.add(key); else EXPANDED.delete(key);
      head.querySelector('.rb-card-chev').textContent = nowOpen ? '⌃ recolher' : '⌄ editar';
    });
  }

  function togglePaneForEdit(on) {
    var pg = el$('page-roteiros'); if (pg) pg.classList.toggle('rb-editing', !!on);
  }

  // ---- "Dados do Cliente" recolhivel ----
  function fmtBR(s) { if (!s) return ''; var p = String(s).split('-'); return p.length < 3 ? s : p[2] + '/' + p[1] + '/' + p[0]; }
  function cliSummaryHTML() {
    var r = R() || {}, c = r.cliente || {};
    var g = function (id, fb) { var e = el$(id); return (e && e.value) || fb || ''; };
    var nome = g('rotClienteNome', c.nome) || 'Cliente';
    var ad = num(g('rotClienteAdultos', c.adultos)), cr = num(g('rotClienteCriancas', c.criancas));
    var di = g('rotClienteData', c.dataInicio), df = g('rotClienteDataFim', c.dataFim);
    var pax = [];
    if (ad) pax.push(ad + (ad > 1 ? ' Adultos' : ' Adulto'));
    if (cr) pax.push(cr + (cr > 1 ? ' Criancas' : ' Crianca'));
    var per = (di && df) ? (fmtBR(di) + ' a ' + fmtBR(df)) : (fmtBR(di || df) || '');
    var meta = [pax.join(', '), per].filter(Boolean).join('  \u00b7  ');
    return '<span class="t">' + esc(nome) + '</span>' + (meta ? '<span class="m">' + esc(meta) + '</span>' : '');
  }
  function refreshCli(card) { var el = card.querySelector('.rb-cli-summary'); if (el) el.innerHTML = cliSummaryHTML(); }
  function setupClienteCollapse() {
    var nameInput = el$('rotClienteNome'); if (!nameInput) return;
    var card = nameInput.closest('.card'); if (!card) return;
    if (card.__rbCli) { if (card.classList.contains('rb-cli-closed')) refreshCli(card); return; }
    card.__rbCli = true;
    var header = card.firstElementChild; if (!header) return;
    var body = document.createElement('div'); body.className = 'rb-cli-body';
    while (header.nextSibling) body.appendChild(header.nextSibling);
    var summary = document.createElement('div'); summary.className = 'rb-cli-summary';
    card.appendChild(summary); card.appendChild(body);
    var toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'rb-cli-toggle'; toggle.title = 'Recolher / expandir';
    header.appendChild(toggle);
    function setOpen(open) {
      card.classList.toggle('rb-cli-open', open);
      card.classList.toggle('rb-cli-closed', !open);
      toggle.innerHTML = open ? '\u2303' : '\u2304';
      if (!open) refreshCli(card);
    }
    toggle.addEventListener('click', function (e) { e.stopPropagation(); setOpen(card.classList.contains('rb-cli-closed')); });
    var title = header.querySelector('.card-title');
    if (title) title.addEventListener('click', function (e) { if (e.target.closest('button')) return; setOpen(card.classList.contains('rb-cli-closed')); });
    setOpen(!((nameInput.value || '').trim()));  // recolhido se ja tem cliente
  }

  function enhance() {
    if (!R() || !R().dias) return;
    if (!ensureShell()) return;
    togglePaneForEdit(true);
    collapseCards();
    renderRail();
    renderSummary();
    setupClienteCollapse();
  }

  window.duplicarDiaRoteiro = function (idx) {
    try {
      var r = R(); if (!r || !r.dias || !r.dias[idx]) return;
      if (window.registrarEstadoRoteiro) try { window.registrarEstadoRoteiro(r); } catch (e) {}
      var clone = JSON.parse(JSON.stringify(r.dias[idx]));
      if (clone.numeroDia != null) clone.numeroDia = num(clone.numeroDia) + 1;
      r.dias.splice(idx + 1, 0, clone);
      if (window.renderEditDias) window.renderEditDias();
    } catch (e) { console.warn('[builder-enhance] duplicar:', e); }
  };

  function hook() {
    if (window.__rbHooked) return;
    if (typeof window.renderEditDias !== 'function') { return setTimeout(hook, 250); }
    var orig = window.renderEditDias;
    window.renderEditDias = function () {
      var ret = orig.apply(this, arguments);
      try { enhance(); } catch (e) { console.warn('[builder-enhance] enhance:', e); }
      return ret;
    };
    if (typeof window.fecharEditorRoteiro === 'function' && !window.__rbCloseHooked) {
      var origClose = window.fecharEditorRoteiro;
      window.fecharEditorRoteiro = function () { try { togglePaneForEdit(false); } catch (e) {} return origClose.apply(this, arguments); };
      window.__rbCloseHooked = true;
    }
    window.__rbHooked = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook);
  else hook();
})();

