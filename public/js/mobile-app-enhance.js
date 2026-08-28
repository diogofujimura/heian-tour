/* ============================================================================
   HEIAN TOUR - MOBILE APP ENHANCE (<=768px)
   Camada JS aditiva por cima do builder-enhance e do app:
   - injeta icones que faltam no sprite (bug pre-existente)
   - rotulos curtos nos botoes/abas da ficha do cliente
   - menu "..." no cabecalho do dia (mover/excluir/tour guiado)
   - "+ Adicionar bloco" unico com bottom sheet
   - barra de edicao de bloco em tela cheia (fechar / ok)
   Tudo em try/catch; se falhar, o app original segue intacto.
   Nenhum handler original e substituido - os nos existentes so mudam de lugar.
   ========================================================================== */
(function () {
  'use strict';
  var MQ = window.matchMedia('(max-width: 768px)');
  function isMobile() { return MQ.matches; }

  var SVG = {
    sequencia: '<svg viewBox="0 0 24 24" fill="none" stroke="#534AB7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>',
    texto: '<svg viewBox="0 0 24 24" fill="none" stroke="#185FA5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="#5F5E5A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    transporte: '<svg viewBox="0 0 24 24" fill="none" stroke="#0F6E56" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="14" rx="2"></rect><path d="M4 11h16"></path><path d="M12 3v8"></path><path d="m8 17-2 4"></path><path d="m16 17 2 4"></path></svg>',
    experiencia: '<svg viewBox="0 0 24 24" fill="none" stroke="#854F0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path><path d="M13 5v14"></path></svg>'
  };
  var TIPOS = [
    { tipo: 'sequencia', label: 'Sequência de atrações' },
    { tipo: 'texto', label: 'Texto livre' },
    { tipo: 'info', label: 'Info de encontro' },
    { tipo: 'transporte', label: 'Transporte' },
    { tipo: 'experiencia', label: 'Tickets e experiências', full: true }
  ];

  var MISSING_ICONS = {
    'icon-mail': '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline>',
    'icon-message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
    'icon-link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>',
    'icon-dollar-sign': '<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>'
  };
  function ensureIcons() {
    try {
      var anySym = document.querySelector('svg symbol');
      if (!anySym) return;
      var sprite = anySym.parentNode;
      Object.keys(MISSING_ICONS).forEach(function (id) {
        if (document.getElementById(id)) return;
        var sym = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
        sym.setAttribute('id', id);
        sym.setAttribute('viewBox', '0 0 24 24');
        sym.setAttribute('fill', 'none');
        sym.setAttribute('stroke', 'currentColor');
        sym.setAttribute('stroke-width', '2');
        sym.setAttribute('stroke-linecap', 'round');
        sym.setAttribute('stroke-linejoin', 'round');
        sym.innerHTML = MISSING_ICONS[id];
        sprite.appendChild(sym);
      });
    } catch (e) { console.warn('[mobile-app] icons:', e); }
  }

  var LABELS = { 'E-mail': 'E-mail', 'WhatsApp': 'WhatsApp', 'Link do Cliente': 'Link', 'Financeiro': 'Financeiro', 'Editar Cliente': 'Editar' };
  var TABS = { 'Resumo de Pendências': 'Pendências', 'Dados do Cliente': 'Dados', 'Vouchers & Ingressos': 'Vouchers' };
  function decorateFicha() {
    try {
      document.querySelectorAll('.client-actions-bar:not([data-mob])').forEach(function (bar) {
        bar.setAttribute('data-mob', '1');
        bar.querySelectorAll('button').forEach(function (b) {
          var txt = (b.textContent || '').trim();
          b.setAttribute('data-mob-label', LABELS[txt] || txt);
        });
      });
      if (!isMobile()) return;
      document.querySelectorAll('.tabs-client-nav:not([data-mob])').forEach(function (nav) {
        nav.setAttribute('data-mob', '1');
        nav.querySelectorAll('.tab-client-btn').forEach(function (b) {
          var txt = (b.textContent || '').trim();
          if (TABS[txt]) {
            var label = b.querySelector('.tab-label');
            var last = b.childNodes[b.childNodes.length - 1];
            if (label) label.textContent = TABS[txt];
            else if (last && last.nodeType === 3) last.textContent = ' ' + TABS[txt];
            else b.textContent = TABS[txt];
          }
        });
      });
    } catch (e) { console.warn('[mobile-app] ficha:', e); }
  }

  function fecharDayMenus() {
    document.querySelectorAll('.mob-daymenu').forEach(function (m) { m.style.display = 'none'; });
  }
  function decorateDias() {
    try {
      if (!isMobile()) return;
      document.querySelectorAll('#editRoteiroDiasList > .dia-card').forEach(function (card) {
        var head = card.firstElementChild;
        if (!head || head.hasAttribute('data-mob')) return;
        var grupos = head.children;
        if (grupos.length < 2) return;
        head.setAttribute('data-mob', '1');
        var controles = grupos[grupos.length - 1];
        var menu = document.createElement('div');
        menu.className = 'mob-daymenu';
        menu.style.display = 'none';
        menu.appendChild(controles);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mob-daymenu-btn';
        btn.innerHTML = '&#8942;';
        btn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var aberto = menu.style.display !== 'none';
          fecharDayMenus();
          menu.style.display = aberto ? 'none' : 'block';
        });
        head.appendChild(btn);
        head.appendChild(menu);
      });
    } catch (e) { console.warn('[mobile-app] dias:', e); }
  }

  function ensureSheet() {
    var sh = document.getElementById('mobSheetBloco');
    if (sh) return sh;
    sh = document.createElement('div');
    sh.id = 'mobSheetBloco';
    sh.className = 'mobx-sheet';
    sh.hidden = true;
    var items = TIPOS.map(function (t) {
      return '<button type="button" class="mob-sheet-item' + (t.full ? ' full' : '') + '" data-tipo="' + t.tipo + '">' + SVG[t.tipo] + '<span>' + t.label + '</span></button>';
    }).join('');
    sh.innerHTML = '<div class="mob-sheet-bg"></div><div class="mob-sheet-panel"><div class="mob-sheet-grip"></div>' +
      '<p class="mob-sheet-title" id="mobSheetBlocoTitle">Adicionar bloco</p><div class="mob-sheet-grid">' + items + '</div></div>';
    document.body.appendChild(sh);
    sh.querySelector('.mob-sheet-bg').addEventListener('click', function () { sh.hidden = true; });
    sh.querySelectorAll('.mob-sheet-item').forEach(function (it) {
      it.addEventListener('click', function () {
        sh.hidden = true;
        var idx = parseInt(sh.getAttribute('data-dia'), 10);
        if (!isNaN(idx) && typeof window.adicionarElemento === 'function') window.adicionarElemento(idx, it.getAttribute('data-tipo'));
      });
    });
    return sh;
  }
  function abrirSheetBloco(idx, numeroDia) {
    var sh = ensureSheet();
    sh.setAttribute('data-dia', idx);
    var t = document.getElementById('mobSheetBlocoTitle');
    if (t) t.textContent = 'Adicionar ao Dia ' + (numeroDia || (idx + 1));
    sh.hidden = false;
  }
  function decorateAddBloco() {
    try {
      var cards = document.querySelectorAll('#editRoteiroDiasList > .dia-card');
      cards.forEach(function (card, idx) {
        var body = card.querySelector('.dia-card-body');
        if (!body) return;
        var rows = body.querySelectorAll(':scope > div');
        var addRow = null;
        rows.forEach(function (r) {
          if (r.querySelector('button[onclick^="adicionarElemento"]')) addRow = r;
        });
        if (!addRow || addRow.classList.contains('mob-addrow')) return;
        addRow.classList.add('mob-addrow');
        var numInput = card.querySelector('input[type="number"]');
        var num = numInput ? numInput.value : (idx + 1);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mob-addblock';
        btn.style.display = 'none';
        btn.innerHTML = '+ Adicionar bloco';
        btn.addEventListener('click', function () { abrirSheetBloco(idx, num); });
        addRow.parentNode.insertBefore(btn, addRow.nextSibling);
        if (isMobile()) btn.style.display = '';
      });
    } catch (e) { console.warn('[mobile-app] addbloco:', e); }
  }

  function decorateBlocos() {
    try {
      if (!isMobile()) return;
      document.querySelectorAll('#editRoteiroDiasList .rb-card').forEach(function (rbc) {
        var body = rbc.querySelector(':scope > .rb-card-body');
        var head = rbc.querySelector(':scope > .rb-card-head');
        if (!body || !head || body.querySelector(':scope > .mob-blk-bar')) return;
        var meta = head.querySelector('.rb-card-meta .t');
        var titulo = meta ? meta.textContent.trim() : 'Editar bloco';
        var bar = document.createElement('div');
        bar.className = 'mob-blk-bar';
        var close = document.createElement('button'); close.type = 'button'; close.className = 'mob-blk-close'; close.innerHTML = '&#10005;';
        var span = document.createElement('span'); span.className = 'mob-blk-title'; span.textContent = titulo;
        var ok = document.createElement('button'); ok.type = 'button'; ok.className = 'mob-blk-ok'; ok.innerHTML = '&#10003;';
        function fechar(ev) { ev.stopPropagation(); head.click(); }
        close.addEventListener('click', fechar);
        ok.addEventListener('click', fechar);
        bar.appendChild(close); bar.appendChild(span); bar.appendChild(ok);
        body.insertBefore(bar, body.firstChild);
        var acts = head.querySelector('.rb-card-actions');
        if (acts) {
          var actsWrap = document.createElement('div');
          actsWrap.className = 'mob-blk-actions';
          actsWrap.appendChild(acts);
          body.insertBefore(actsWrap, bar.nextSibling);
        }
      });
    } catch (e) { console.warn('[mobile-app] blocos:', e); }
  }

  function enhanceEditor() {
    decorateDias();
    decorateAddBloco();
    decorateBlocos();
  }
  function hookRender() {
    if (window.__mobAppHooked) return;
    if (typeof window.renderEditDias !== 'function') { return setTimeout(hookRender, 300); }
    var orig = window.renderEditDias;
    window.renderEditDias = function () {
      var ret = orig.apply(this, arguments);
      try { setTimeout(enhanceEditor, 0); } catch (e) {}
      return ret;
    };
    window.__mobAppHooked = true;
  }

  var obs = new MutationObserver(function () {
    try {
      decorateFicha();
      if (document.querySelector('#editRoteiroDiasList > .dia-card > div:first-child:not([data-mob])')) enhanceEditor();
    } catch (e) {}
  });

  /* ---- 4b. Datalist nao abre no iOS Safari: bottom sheet proprio ---- */
  var dlAlvo = null;
  function ensureDlSheet() {
    var sh = document.getElementById('mobSheetDatalist');
    if (sh) return sh;
    sh = document.createElement('div');
    sh.id = 'mobSheetDatalist';
    sh.className = 'mobx-sheet';
    sh.hidden = true;
    sh.innerHTML = '<div class="mob-sheet-bg"></div><div class="mob-sheet-panel">' +
      '<div class="mob-sheet-grip"></div>' +
      '<input type="text" id="mobDlFiltro" class="mob-dl-filtro" placeholder="Buscar..." autocomplete="off">' +
      '<div id="mobDlLista" class="mob-dl-lista"></div>' +
      '<button type="button" id="mobDlUsar" class="mob-dl-usar"></button></div>';
    document.body.appendChild(sh);
    sh.querySelector('.mob-sheet-bg').addEventListener('click', function () { fecharDlSheet(); });
    var filtro = sh.querySelector('#mobDlFiltro');
    filtro.addEventListener('input', function () { renderDlLista(); });
    sh.querySelector('#mobDlUsar').addEventListener('click', function () {
      aplicarDlValor(filtro.value.trim());
    });
    return sh;
  }
  function norm(t) {
    t = String(t || '').toLowerCase();
    try { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    return t;
  }
  function renderDlLista() {
    var sh = document.getElementById('mobSheetDatalist'); if (!sh || !dlAlvo) return;
    var filtro = norm(sh.querySelector('#mobDlFiltro').value);
    var lista = sh.querySelector('#mobDlLista');
    var opts = dlAlvo.opcoes.filter(function (v) { return !filtro || norm(v).indexOf(filtro) > -1; });
    lista.innerHTML = '';
    opts.slice(0, 80).forEach(function (v) {
      var it = document.createElement('button');
      it.type = 'button';
      it.className = 'mob-dl-item';
      it.textContent = v;
      it.addEventListener('click', function () { aplicarDlValor(v); });
      lista.appendChild(it);
    });
    if (!opts.length) lista.innerHTML = '<p class="mob-dl-vazio">Nada encontrado</p>';
    var usar = sh.querySelector('#mobDlUsar');
    var digitado = sh.querySelector('#mobDlFiltro').value.trim();
    usar.style.display = digitado ? '' : 'none';
    usar.textContent = 'Usar "' + digitado + '"';
  }
  function aplicarDlValor(v) {
    if (!dlAlvo) return;
    var inp = dlAlvo.input;
    fecharDlSheet();
    if (v === '' || v == null) return;
    inp.value = v;
    try {
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {}
  }
  function fecharDlSheet() {
    var sh = document.getElementById('mobSheetDatalist');
    if (sh) sh.hidden = true;
    dlAlvo = null;
  }
  function setupDatalistSheet() {
    document.addEventListener('focusin', function (ev) {
      try {
        if (!isMobile()) return;
        var inp = ev.target;
        if (!inp || !inp.matches || !inp.matches('input[list]')) return;
        if (!inp.closest('#page-roteiros') && !inp.closest('.dia-card')) return;
        var dl = document.getElementById(inp.getAttribute('list'));
        if (!dl) return;
        var opcoes = [].map.call(dl.querySelectorAll('option'), function (o) { return o.value || o.textContent; }).filter(Boolean);
        if (!opcoes.length) return;
        var sh = ensureDlSheet();
        dlAlvo = { input: inp, opcoes: opcoes };
        sh.querySelector('#mobDlFiltro').value = inp.value || '';
        renderDlLista();
        sh.hidden = false;
        inp.blur();
        setTimeout(function () { var f = sh.querySelector('#mobDlFiltro'); if (f) f.focus(); }, 60);
      } catch (e) { console.warn('[mobile-app] datalist:', e); }
    });
  }

  /* ---- 4c. "+ Adicionar atracao": dropdown legado se perde no overlay; vira sheet ---- */
  function ensureAtrSheet() {
    var sh = document.getElementById('mobSheetAtracoes');
    if (sh) return sh;
    sh = document.createElement('div');
    sh.id = 'mobSheetAtracoes';
    sh.className = 'mobx-sheet';
    sh.hidden = true;
    sh.innerHTML = '<div class="mob-sheet-bg"></div><div class="mob-sheet-panel">' +
      '<div class="mob-sheet-grip"></div>' +
      '<p class="mob-sheet-title">Adicionar atra\u00e7\u00e3o</p>' +
      '<input type="text" id="mobAtrFiltro" class="mob-dl-filtro" placeholder="Buscar atra\u00e7\u00e3o ou bairro..." autocomplete="off">' +
      '<div id="mobAtrLista" class="mob-atr-lista"></div>' +
      '<button type="button" id="mobAtrConcluir" class="mob-atr-concluir">Concluir</button></div>';
    document.body.appendChild(sh);
    function fechar() { sh.hidden = true; }
    sh.querySelector('.mob-sheet-bg').addEventListener('click', fechar);
    sh.querySelector('#mobAtrConcluir').addEventListener('click', fechar);
    sh.querySelector('#mobAtrFiltro').addEventListener('input', renderAtrLista);
    return sh;
  }
  function renderAtrLista() {
    var sh = document.getElementById('mobSheetAtracoes');
    if (!sh || typeof window.gerarDropdownAtracoesHTML !== 'function') return;
    var lista = sh.querySelector('#mobAtrLista');
    lista.innerHTML = window.gerarDropdownAtracoesHTML(sh.dataset.cidade || '', sh.querySelector('#mobAtrFiltro').value || '', parseInt(sh.dataset.idx, 10), parseInt(sh.dataset.eIdx, 10));
  }
  function abrirSheetAtracoes(input, idx, eIdx) {
    var sh = ensureAtrSheet();
    sh.dataset.idx = idx;
    sh.dataset.eIdx = eIdx;
    var bloco = null;
    try { bloco = window.roteiroEmEdicao.dias[idx].elementos[eIdx]; } catch (e) {}
    sh.dataset.cidade = (bloco && bloco.cidade) || '';
    window.activeDropdownInput = null;
    sh.querySelector('#mobAtrFiltro').value = input.value || '';
    renderAtrLista();
    sh.hidden = false;
    input.blur();
    var leg = document.getElementById('dropdownAtracoesGlobal');
    if (leg) leg.style.display = 'none';
    setTimeout(function () { var f = sh.querySelector('#mobAtrFiltro'); if (f) f.focus(); }, 60);
  }
  function setupAtracoesSheet() {
    if (typeof window.abrirDropdownAtracoesGlobal !== 'function') { return setTimeout(setupAtracoesSheet, 400); }
    if (window.__mobAtrHooked) return;
    window.__mobAtrHooked = true;
    var origAbrir = window.abrirDropdownAtracoesGlobal;
    var origFiltrar = window.filtrarDropdownAtracoesGlobal;
    window.abrirDropdownAtracoesGlobal = function (input, idx, eIdx) {
      if (!isMobile()) return origAbrir.apply(this, arguments);
      try { abrirSheetAtracoes(input, idx, eIdx); }
      catch (e) { console.warn('[mobile-app] atr sheet:', e); return origAbrir.apply(this, arguments); }
    };
    window.filtrarDropdownAtracoesGlobal = function (input, idx, eIdx) {
      if (!isMobile()) return origFiltrar.apply(this, arguments);
    };
  }

  /* ---- 5. Drag por toque nos chips de atracao ---- */
  var chipDrag = null;
  var CHIP_RX = /dragStartAtracao\(event,\s*(\d+),\s*(\d+),\s*(\d+)\)/;
  function chipIdx(chip) {
    var m = (chip.getAttribute('ondragstart') || '').match(CHIP_RX);
    return m ? { d: +m[1], e: +m[2], a: +m[3] } : null;
  }
  function clearChipMarks() {
    document.querySelectorAll('.mob-chip-over, .mob-chip-dragging').forEach(function (c) {
      c.classList.remove('mob-chip-over'); c.classList.remove('mob-chip-dragging');
    });
  }
  function setupChipTouchDrag() {
    document.addEventListener('touchstart', function (ev) {
      try {
        if (!isMobile()) return;
        var chip = ev.target.closest ? ev.target.closest('.chip-atracao') : null;
        if (!chip) return;
        var handle = chip.firstElementChild;
        if (!handle || (ev.target !== handle && !handle.contains(ev.target))) return;
        var ix = chipIdx(chip); if (!ix) return;
        chipDrag = { d: ix.d, e: ix.e, a: ix.a, chip: chip, target: null };
        chip.classList.add('mob-chip-dragging');
        ev.preventDefault();
      } catch (e) {}
    }, { passive: false });
    document.addEventListener('touchmove', function (ev) {
      if (!chipDrag) return;
      ev.preventDefault();
      try {
        var t = ev.touches[0];
        var el = document.elementFromPoint(t.clientX, t.clientY);
        var over = el && el.closest ? el.closest('.chip-atracao') : null;
        document.querySelectorAll('.mob-chip-over').forEach(function (c) { c.classList.remove('mob-chip-over'); });
        chipDrag.target = null;
        if (over && over !== chipDrag.chip) {
          var ix = chipIdx(over);
          if (ix && ix.d === chipDrag.d && ix.e === chipDrag.e) {
            over.classList.add('mob-chip-over');
            chipDrag.target = ix.a;
          }
        }
      } catch (e) {}
    }, { passive: false });
    document.addEventListener('touchend', function () {
      if (!chipDrag) return;
      var cd = chipDrag; chipDrag = null;
      clearChipMarks();
      try {
        if (cd.target != null && cd.target !== cd.a && window.roteiroEmEdicao) {
          var arr = window.roteiroEmEdicao.dias[cd.d].elementos[cd.e].atracoesDoDia;
          var item = arr.splice(cd.a, 1)[0];
          arr.splice(cd.target, 0, item);
          if (window.renderEditDias) window.renderEditDias();
          if (window.triggerRoteiroAutoSave) { try { window.triggerRoteiroAutoSave(); } catch (e2) {} }
        }
      } catch (e) { console.warn('[mobile-app] chip drag:', e); }
    });
    document.addEventListener('touchcancel', function () { chipDrag = null; clearChipMarks(); });
  }

  /* ---- Abas da Base de Dados no mobile: icone + rotulo curto (nao cabem por extenso) ---- */
  var BASETABS = {
    'transportes-tab': { short: 'Transp.', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="14" rx="2"></rect><path d="M4 11h16"></path><path d="M12 3v8"></path><path d="m8 17-2 4"></path><path d="m16 17 2 4"></path></svg>' },
    'experiencias-tab': { short: 'Exp.', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path><path d="M13 5v14"></path></svg>' },
    'atracoes-tab': { short: 'Atrações', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>' },
    'rotas-tab': { short: 'Rotas', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"></circle><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"></path><circle cx="18" cy="5" r="3"></circle></svg>' },
    'hoteis-tab': { short: 'Hotéis', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12"></path><path d="M2 17h20"></path><path d="M6 12h5a3 3 0 0 1 3 3"></path><circle cx="8" cy="10" r="1.2"></circle></svg>' }
  };
  function injectBaseTabCss() {
    if (document.getElementById('mobBaseTabCss')) return;
    var st = document.createElement('style'); st.id = 'mobBaseTabCss';
    st.textContent =
      '.mob-basetab-ico{display:none}.mob-basetab-short{display:none}' +
      '@media (max-width:768px){' +
        '#page-base .tabs{display:flex !important;flex-wrap:nowrap !important;gap:2px !important;width:100% !important;overflow:visible !important;margin-bottom:12px !important}' +
        '#page-base .tabs .tab{flex:1 1 0 !important;min-width:0 !important;width:auto !important;padding:7px 2px !important;display:flex !important;flex-direction:column !important;align-items:center !important;justify-content:flex-end !important;gap:3px !important;text-align:center !important;border-bottom:2px solid transparent !important}' +
        '#page-base .tabs .tab.active{border-bottom-color:var(--crimson,#6B1F2A) !important;color:var(--crimson,#6B1F2A) !important}' +
        '#page-base .tabs .tab .mob-basetab-full{display:none !important}' +
        '#page-base .tabs .tab .mob-basetab-ico{display:block !important;line-height:0}' +
        '#page-base .tabs .tab .mob-basetab-ico svg{width:20px;height:20px;display:block}' +
        '#page-base .tabs .tab .mob-basetab-short{display:block !important;font-size:9.5px !important;line-height:1.1 !important;white-space:nowrap !important;font-weight:600}' +
      '}';
    (document.head || document.documentElement).appendChild(st);
  }
  function enhanceBaseTabs() {
    var tabs = document.querySelectorAll('#page-base .tabs .tab[data-tab]');
    tabs.forEach(function (tab) {
      if (tab.__mobBaseTab) return;
      var m = BASETABS[tab.getAttribute('data-tab')];
      if (!m) return;
      var full = (tab.textContent || '').trim();
      tab.innerHTML =
        '<span class="mob-basetab-ico">' + m.ico + '</span>' +
        '<span class="mob-basetab-full">' + full + '</span>' +
        '<span class="mob-basetab-short">' + m.short + '</span>';
      tab.__mobBaseTab = true;
    });
  }

  function injectCalendarMobileCss() {
    if (document.getElementById('mobCalCss')) return;
    var st = document.createElement('style'); st.id = 'mobCalCss';
    st.textContent =
      '@media (max-width:768px){' +
        '#page-calendario .calendar-top-bar{flex-direction:column !important;align-items:stretch !important;gap:10px !important}' +
        '#page-calendario .calendar-title-nav{justify-content:center !important;width:100% !important}' +
        '#page-calendario .calendar-filters{width:100% !important;flex-wrap:wrap !important;justify-content:center !important;gap:8px !important}' +
        '#page-calendario .calendar-filters > div:first-child{flex:0 0 auto !important}' +
        '#page-calendario .calendar-filter-select{flex:1 1 180px !important;min-width:0 !important;max-width:100% !important}' +
        '#page-calendario .calendar-filters .btn-primary,#page-calendario .calendar-filters .btn-secondary{flex:1 1 auto !important;white-space:nowrap !important}' +
      '}';
    (document.head || document.documentElement).appendChild(st);
  }

  function init() {
    hookRender();
    ensureIcons();
    injectBaseTabCss();
    injectCalendarMobileCss();
    enhanceBaseTabs();
    decorateFicha();
    setupChipTouchDrag();
    setupDatalistSheet();
    setupAtracoesSheet();
    try { obs.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('.mob-daymenu') && !ev.target.closest('.mob-daymenu-btn')) fecharDayMenus();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
