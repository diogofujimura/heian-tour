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
  var ICON = {
    sequencia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>',
    transporte: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><rect x="4" y="3" width="16" height="14" rx="2"></rect><path d="M4 11h16"></path><path d="M12 3v8"></path><path d="m8 17-2 4"></path><path d="m16 17 2 4"></path></svg>',
    experiencia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path><path d="M13 5v14"></path></svg>',
    texto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
  };

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

  // ===== Atalhos rápidos na lateral (aparecem ao rolar, quando a barra de cima sai) =====
  window.__rbQA = function(id){ var b = document.getElementById(id); if (b) b.click(); };

  function quickActionsHtml(){
    var ic = {
      save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
      eye:'<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/>',
      undo:'<path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7"/>',
      user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
      back:'<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
      bolt:'<path d="M13 2 3 14h7l-1 8 10-12h-7z"/>'
    };
    function svg(d,st){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"'+(st?' style="'+st+'"':'')+'>'+d+'</svg>'; }
    return '<div id="rbQuickActions"><div class="rbqa-wrap">'
      + '<div class="rbqa-h">'+svg(ic.bolt,'stroke:var(--gold-dk)')+'Ações rápidas</div>'
      + '<button class="rbqa-b rbqa-save" onclick="window.__rbQA(\'btnSalvarEdicaoRoteiro\')">'+svg(ic.save)+'Salvar Roteiro</button>'
      + '<button class="rbqa-b rbqa-wide" onclick="window.__rbQA(\'btnSalvarVisualizarRoteiro\')">'+svg(ic.eye)+'Pré-visualizar</button>'
      + '<div class="rbqa-row">'
      +   '<button class="rbqa-b" onclick="window.__rbQA(\'btnDesfazerEdicaoRoteiro\')">'+svg(ic.undo)+'Desfazer</button>'
      +   '<button class="rbqa-b rbqa-gold" onclick="window.__rbQA(\'btnVerPerfilClienteRoteiro\')">'+svg(ic.user,'stroke:var(--gold-dk)')+'Perfil</button>'
      + '</div>'
      + '<button class="rbqa-b rbqa-wide" style="margin-bottom:0" onclick="window.__rbQA(\'btnVoltarClientesRoteiro\')">'+svg(ic.back)+'Voltar para Clientes</button>'
      + '</div></div>';
  }

  function injectQAStyles(){
    if (document.getElementById('rbQAStyles')) return;
    var st = document.createElement('style'); st.id='rbQAStyles';
    st.textContent =
      '#rbQuickActions{display:none}'
      +'#rbQuickActions.rbqa-on{display:block;animation:rbqaIn .28s ease}'
      +'@keyframes rbqaIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}'
      +'.rbqa-wrap{margin:16px -16px -18px;padding:13px 16px 14px;border-top:1.5px solid rgba(196,163,90,.4);background:rgba(196,163,90,.05);border-radius:0 0 14px 14px}'
      +'.rbqa-h{display:flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.09em;text-transform:uppercase;font-weight:700;color:var(--gold-dk);margin:0 0 10px}'
      +'.rbqa-h svg{width:13px;height:13px}'
      +'.rbqa-b{font-family:var(--ff-body,Inter,sans-serif);font-size:12px;font-weight:600;border-radius:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;transition:.15s;border:1px solid rgba(196,163,90,.3);background:rgba(255,255,255,.85);color:var(--crimson);padding:9px 10px;width:100%}'
      +'.rbqa-b:hover{border-color:var(--gold);background:#fff}'
      +'.rbqa-b svg{width:14px;height:14px;flex:none}'
      +'.rbqa-save{background:linear-gradient(135deg,var(--crimson),#8c2736);color:#fff;border:none;font-size:13px;font-weight:700;padding:11px;box-shadow:0 3px 10px rgba(107,31,42,.22);margin-bottom:7px}'
      +'.rbqa-save:hover{background:linear-gradient(135deg,#8c2736,#a83244)}'
      +'.rbqa-wide{margin-bottom:7px}'
      +'.rbqa-row{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:7px}'
      +'.rbqa-gold{color:var(--gold-dk)}';
    (document.head||document.documentElement).appendChild(st);
  }

  function setupQuickActionsReveal(){
    injectQAStyles();
    var qa = document.getElementById('rbQuickActions');
    var hdr = document.getElementById('roteiroEditHeaderDisplay');
    if (!qa || !hdr) return;
    // estado inicial: revela se a barra de cima já está fora de vista
    var r = hdr.getBoundingClientRect();
    qa.classList.toggle('rbqa-on', r.bottom < 8);
    if (window.__rbQAObserver) return; // observer só uma vez (persiste apesar do re-render)
    try {
      window.__rbQAObserver = new IntersectionObserver(function(entries){
        var vis = entries[0].isIntersecting;
        var q = document.getElementById('rbQuickActions');
        if (q) q.classList.toggle('rbqa-on', !vis);
      }, { threshold: 0 });
      window.__rbQAObserver.observe(hdr);
    } catch(e){ /* IO indisponível: fica sempre visível */ qa.classList.add('rbqa-on'); }
  }

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
    box.innerHTML = '<h4>RESUMO</h4>' + totalHtml + '<div style="margin-top:14px">' + stats + '</div>' + warnHtml + quickActionsHtml();
    setupQuickActionsReveal();
  }

  function collapseCards() {
    var list = el$('editRoteiroDiasList'), r = R(); if (!list || !r || !r.dias) return;
    var dayCards = list.querySelectorAll(':scope > .dia-card');
    dayCards.forEach(function (card, d) {
      var dia = r.dias[d]; if (!dia) return;
      var blocks = card.querySelectorAll(':scope > div[style*="border-left"], :scope > .dia-card-body > div[style*="border-left"]');
      blocks.forEach(function (block, e) {
        if (block.parentElement && block.parentElement.classList.contains('rb-card-body')) return;
        var elx = dia.elementos && dia.elementos[e]; if (!elx) return;
        wrapCard(block, d, e, elx, dia);
      });
    });
  }
  // ---- Reordenar blocos arrastando (mouse + toque), dentro do mesmo dia ----
  function injectDndStyles() {
    if (document.getElementById('rbDndStyles')) return;
    var s = document.createElement('style'); s.id = 'rbDndStyles';
    s.textContent =
      '.rb-drag{cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;display:flex;align-items:center;justify-content:center;align-self:stretch;padding:0 6px;margin:-6px 2px -6px -4px;color:#b8ada2;font-size:16px;line-height:1;flex:0 0 auto}' +
      '.rb-drag:hover{color:#8a7f74}.rb-drag:active{cursor:grabbing;color:#6b1f2a}' +
      '.rb-card.rb-dragging{opacity:.55;box-shadow:0 8px 24px rgba(0,0,0,.18);position:relative;z-index:20}';
    (document.head || document.documentElement).appendChild(s);
  }

  function sameDayCards(wrap) {
    var parent = wrap.parentNode; if (!parent) return [wrap];
    return [].slice.call(parent.children).filter(function (n) {
      return n.classList && n.classList.contains('rb-card') && n.getAttribute('data-d') === wrap.getAttribute('data-d');
    });
  }

  function commitReorder(wrap) {
    try {
      var d = +wrap.getAttribute('data-d');
      var r = R(); if (!r || !r.dias || !r.dias[d]) return;
      var cards = sameDayCards(wrap);
      var order = cards.map(function (c) { return +c.getAttribute('data-e'); });
      var changed = order.some(function (v, i) { return v !== i; });
      if (!changed) return;
      var arr = r.dias[d].elementos || [];
      if (window.registrarEstadoRoteiro) try { window.registrarEstadoRoteiro(r); } catch (e) {}
      r.dias[d].elementos = order.map(function (i) { return arr[i]; });
      EXPANDED.clear();
      if (window.renderEditDias) window.renderEditDias();
    } catch (e) { console.warn('[builder-enhance] reorder:', e); }
  }

  function attachDrag(handle, wrap) {
    handle.addEventListener('click', function (ev) { ev.stopPropagation(); });
    handle.addEventListener('pointerdown', function (ev) {
      if (ev.button != null && ev.button !== 0) return;
      ev.preventDefault(); ev.stopPropagation();
      var pid = ev.pointerId, moved = false;
      try { handle.setPointerCapture(pid); } catch (e) {}
      wrap.classList.add('rb-dragging');
      function onMove(e) {
        moved = true;
        var y = e.clientY;
        var others = sameDayCards(wrap).filter(function (c) { return c !== wrap; });
        var target = null, best = -Infinity;
        others.forEach(function (c) {
          var box = c.getBoundingClientRect();
          var off = y - box.top - box.height / 2;
          if (off < 0 && off > best) { best = off; target = c; }
        });
        if (target) wrap.parentNode.insertBefore(wrap, target);
        else if (others.length) { var last = others[others.length - 1]; wrap.parentNode.insertBefore(wrap, last.nextSibling); }
      }
      function onUp() {
        document.removeEventListener('pointermove', onMove, true);
        document.removeEventListener('pointerup', onUp, true);
        document.removeEventListener('pointercancel', onUp, true);
        try { handle.releasePointerCapture(pid); } catch (e2) {}
        wrap.classList.remove('rb-dragging');
        if (moved) commitReorder(wrap);
      }
      document.addEventListener('pointermove', onMove, true);
      document.addEventListener('pointerup', onUp, true);
      document.addEventListener('pointercancel', onUp, true);
    });
  }

  function wrapCard(block, d, e, elx, dia) {
    var key = d + '-' + e, sum = elSummary(elx, dia), open = EXPANDED.has(key);
    var wrap = document.createElement('div'); wrap.className = 'rb-card' + (open ? ' open' : '');
    wrap.setAttribute('data-d', d); wrap.setAttribute('data-e', e);
    var head = document.createElement('div'); head.className = 'rb-card-head';
    
    var actionsHtml = '';
    if (elx.tipo === 'sequencia') {
      actionsHtml = '<div class="rb-card-actions">' +
        '<button type="button" class="btn-cad-rapido" onclick="event.stopPropagation(); window.abrirModalCadastroRapido(\'atracao\', ' + d + ', ' + e + ')">+ Nova Atração</button>' +
        '<button type="button" class="btn-cad-rapido" onclick="event.stopPropagation(); window.abrirModalCadastroRapido(\'rota\', ' + d + ', ' + e + ')">+ Nova Rota</button>' +
        '</div>';
    } else if (elx.tipo === 'transporte') {
      actionsHtml = '<div class="rb-card-actions">' +
        '<button type="button" class="btn-cad-rapido" onclick="event.stopPropagation(); window.abrirModalCadastroRapido(\'transporte\', ' + d + ', ' + e + ')">+ Novo Transporte</button>' +
        '</div>';
    } else if (elx.tipo === 'experiencia') {
      actionsHtml = '<div class="rb-card-actions">' +
        '<button type="button" class="btn-cad-rapido" onclick="event.stopPropagation(); window.abrirModalCadastroRapido(\'experiencia\', ' + d + ', ' + e + ')">+ Nova Experiência</button>' +
        '</div>';
    }
    
    head.innerHTML = '<div class="rb-card-ico rb-ico-' + elx.tipo + '">' + (ICON[elx.tipo] || '•') + '</div>' +
      '<div class="rb-card-meta"><div class="t">' + esc(sum.title) +
      (sum.flag ? '<span class="rb-flag">' + esc(sum.flag) + '</span>' : '') +
      '</div><div class="s">' + esc(sum.sub) + '</div></div>' +
      actionsHtml +
      '<div class="rb-card-chev">' + (open ? '⌃ recolher' : '⌄ editar') + '</div>';
    var grip = document.createElement('div'); grip.className = 'rb-drag';
    grip.title = 'Arraste para reordenar'; grip.setAttribute('aria-label', 'Reordenar bloco'); grip.textContent = '☰';
    head.insertBefore(grip, head.firstChild);
    var body = document.createElement('div'); body.className = 'rb-card-body';
    block.parentNode.insertBefore(wrap, block);
    wrap.appendChild(head); wrap.appendChild(body); body.appendChild(block);
    attachDrag(grip, wrap);
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
    var meta = [pax.join(', '), per].filter(Boolean).join('  ·  ');
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
      toggle.innerHTML = open ? '⌃' : '⌄';
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
    injectDndStyles();
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
