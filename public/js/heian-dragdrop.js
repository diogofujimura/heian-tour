/* Heian Drag&Drop — reordenar atrações (chips .chip-seq) dentro de um bloco .dia-atracoes.
   Feito à mão (sem libs). Segurar ~150ms inicia o arraste; clique curto abre o card.
   Enquanto arrasta, os outros chips se reorganizam ao vivo (FLIP) mostrando onde vai cair. */
(function () {
  'use strict';
  var DRAG_DELAY = 150;   // ms de "segurar" pra iniciar o arraste
  var MOVE_CANCEL = 8;    // px de movimento antes do delay -> vira scroll (não arrasta)
  var FLIP_MS = 160;
  var state = null;
  var lastAfter; // referência de inserção atual (evita re-render a cada pixel)

  function isX(el) { return !!(el && el.closest && el.closest('.chip-x')); }

  function cleanupDocListeners() {
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    document.removeEventListener('pointercancel', onPointerUp, true);
  }

  function endState() {
    cleanupDocListeners();
    state = null;
    lastAfter = undefined;
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;   // só botão esquerdo
    if (isX(e.target)) return;                              // deixa o × agir sozinho
    var chip = e.currentTarget;
    var container = chip.parentElement;
    if (!container || !container.classList.contains('dia-atracoes')) return;
    state = {
      chip: chip, container: container,
      startX: e.clientX, startY: e.clientY,
      dragging: false,
      timer: setTimeout(startDrag, DRAG_DELAY)
    };
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);
  }

  function startDrag() {
    if (!state) return;
    state.dragging = true;
    var chip = state.chip;
    chip.classList.add('chip-dragging');
    chip.style.opacity = '0.4';
    chip.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    if (window.__closeChipPopover) window.__closeChipPopover();
  }

  function seqChips(container) {
    return Array.prototype.slice.call(container.querySelectorAll('.chip-seq'));
  }

  // Descobre antes de qual chip inserir o arrastado, dada a posição do ponteiro.
  // Funciona com chips que quebram em várias linhas (compara linha por y, depois x).
  function findAfter(container, dragged, x, y) {
    var chips = seqChips(container);
    for (var i = 0; i < chips.length; i++) {
      var c = chips[i];
      if (c === dragged) continue;
      var r = c.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var acimaDaLinha = y < r.top;
      var mesmaLinhaAntes = (y <= r.bottom && y >= r.top && x < cx);
      if (acimaDaLinha || mesmaLinhaAntes) return c;
    }
    return null; // vai pro fim
  }

  function measure(els) {
    return els.map(function (el) { return { el: el, r: el.getBoundingClientRect() }; });
  }

  function flip(prev) {
    prev.forEach(function (p) {
      var nr = p.el.getBoundingClientRect();
      var dx = p.r.left - nr.left, dy = p.r.top - nr.top;
      if (dx || dy) {
        p.el.style.transition = 'none';
        p.el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        void p.el.offsetWidth; // força reflow
        p.el.style.transition = 'transform ' + FLIP_MS + 'ms ease';
        p.el.style.transform = '';
      }
    });
  }

  function onPointerMove(e) {
    if (!state) return;
    if (!state.dragging) {
      var dx = Math.abs(e.clientX - state.startX);
      var dy = Math.abs(e.clientY - state.startY);
      if (dx > MOVE_CANCEL || dy > MOVE_CANCEL) {
        clearTimeout(state.timer);
        endState(); // moveu antes de segurar -> não arrasta
      }
      return;
    }
    e.preventDefault();
    var container = state.container, dragged = state.chip;
    var after = findAfter(container, dragged, e.clientX, e.clientY);
    if (after === lastAfter) return;            // nada mudou -> não mexe
    lastAfter = after;
    var chips = seqChips(container);
    var prev = measure(chips);
    if (after) container.insertBefore(dragged, after);
    else container.appendChild(dragged);
    flip(prev);
  }

  function onPointerUp(e) {
    if (!state) return;
    clearTimeout(state.timer);
    var wasDragging = state.dragging;
    var chip = state.chip, container = state.container;
    cleanupDocListeners();
    if (wasDragging) {
      chip.classList.remove('chip-dragging');
      chip.style.opacity = '';
      chip.style.cursor = '';
      chip.style.transform = '';
      document.body.style.userSelect = '';
      commit(container);
    } else if (!isX(e.target) && window.__openChipPopover) {
      window.__openChipPopover(chip);          // clique curto -> abre o card
    }
    endState();
  }

  function commit(container) {
    var dIdx = parseInt(container.getAttribute('data-didx'), 10);
    var eIdx = parseInt(container.getAttribute('data-eidx'), 10);
    if (isNaN(dIdx) || isNaN(eIdx)) return safeRender();
    var order = seqChips(container).map(function (c) {
      return parseInt(c.getAttribute('data-aidx'), 10);
    });
    try {
      var arr = window.roteiroEmEdicao.dias[dIdx].elementos[eIdx].atracoesDoDia;
      var novo = order.map(function (i) { return arr[i]; });
      if (novo.length === arr.length && novo.every(function (v) { return v !== undefined; })) {
        window.roteiroEmEdicao.dias[dIdx].elementos[eIdx].atracoesDoDia = novo;
      }
    } catch (err) { console.error('Heian drag commit:', err); }
    safeRender();
  }

  function safeRender() {
    if (typeof window.renderEditDias === 'function') window.renderEditDias();
  }

  // Religado após cada render (os chips são recriados). Wire só nos .chip-seq dentro de .dia-atracoes.
  window.initDragAtracoes = function () {
    var chips = document.querySelectorAll('.dia-atracoes .chip-seq');
    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      if (chip.__hdWired) continue;
      chip.__hdWired = true;
      chip.style.touchAction = 'none';
      chip.addEventListener('pointerdown', onPointerDown);
    }
  };
})();
