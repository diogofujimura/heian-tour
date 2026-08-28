/* ============================================================================
   HEIAN TOUR — NAVEGAÇÃO MOBILE (barra inferior + sheets + kanban touch)
   Só age em telas ≤768px; no desktop os elementos ficam ocultos via CSS.
   ========================================================================== */
(function () {
  'use strict';

  var MQ = window.matchMedia('(max-width: 768px)');
  function isMobile() { return MQ.matches; }

  /* ── Navegação: barra inferior espelha a sidebar ── */
  function irParaPagina(pg) {
    // Entrar por aqui sempre mostra a RAIZ da seção (lista), nunca um detalhe preso
    ['page-clientes','page-roteiros','page-meus','page-colaboradores'].forEach(function (id) {
      var p = document.getElementById(id);
      if (p) p.classList.remove('show-detail');
    });
    var link = document.querySelector('.sidebar-nav a[data-page="' + pg + '"]');
    if (link) { link.click(); }
    else if (typeof window.navToPage === 'function') { window.navToPage(pg); }
    fecharSheet('mobSheetMais');
    atualizarAtivo(pg);
    var sb = document.querySelector('.sidebar');
    if (sb) sb.classList.remove('open');
    window.scrollTo({ top: 0 });
  }

  function atualizarAtivo(pg) {
    var principais = { dashboard: 1, clientes: 1, calendario: 1, contabilidade: 1 };
    document.querySelectorAll('.bottom-nav .bnav-item').forEach(function (b) {
      var alvo = b.dataset.page;
      if (alvo) b.classList.toggle('active', alvo === pg);
      else b.classList.toggle('active', !principais[pg]); // "Mais" ativo p/ páginas secundárias
    });
  }

  function abrirSheet(id) { var el = document.getElementById(id); if (el) el.style.display = 'block'; }
  function fecharSheet(id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.bottom-nav .bnav-item[data-page]').forEach(function (b) {
      b.addEventListener('click', function () { irParaPagina(b.dataset.page); });
    });
    var btnMais = document.getElementById('bnavMais');
    if (btnMais) btnMais.addEventListener('click', function () { abrirSheet('mobSheetMais'); });

    document.querySelectorAll('#mobSheetMais .mob-sheet-item').forEach(function (b) {
      b.addEventListener('click', function () { irParaPagina(b.dataset.page); });
    });

    // Fechar sheets tocando no fundo escuro
    ['mobSheetMais', 'mobSheetEtapa'].forEach(function (id) {
      var ov = document.getElementById(id);
      if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) fecharSheet(id); });
    });

    // Sincroniza o item ativo com a navegação existente (sem alterar o navToPage)
    var hashPg = (location.hash || '').replace('#', '') || 'dashboard';
    atualizarAtivo(hashPg === 'orcamento' ? 'meus' : hashPg);
    window.addEventListener('hashchange', function () {
      var pg = (location.hash || '').replace('#', '');
      if (pg) atualizarAtivo(pg === 'orcamento' ? 'meus' : pg);
    });
  });

  /* ── Kanban: colunas colapsáveis + "mover etapa" sem arrastar ── */
  function listaStatus() {
    if (typeof KANBAN_STATUSES !== 'undefined' && Array.isArray(KANBAN_STATUSES)) {
      return KANBAN_STATUSES.map(function (s) { return s.name; });
    }
    return ['Início/call de dúvidas', 'Em Negociação', 'Negociação Aprovada',
            'Roteiro Rascunho', 'Compras', 'Em andamento', 'Finalizados'];
  }

  window.abrirSheetMoverEtapa = function (clienteId, nome, statusAtual) {
    var titulo = document.getElementById('mobSheetEtapaTitulo');
    var lista = document.getElementById('mobSheetEtapaLista');
    if (!lista) return;
    if (titulo) titulo.textContent = 'Mover "' + (nome || 'cliente') + '" para:';
    lista.innerHTML = '';
    listaStatus().forEach(function (st) {
      var btn = document.createElement('button');
      btn.className = 'mob-sheet-item' + (st === statusAtual ? ' ativo' : '');
      btn.textContent = st + (st === statusAtual ? ' · atual' : '');
      btn.addEventListener('click', function () {
        fecharSheet('mobSheetEtapa');
        if (st !== statusAtual && typeof atualizarStatusClienteKanban === 'function') {
          atualizarStatusClienteKanban(clienteId, st);
        }
      });
      lista.appendChild(btn);
    });
    abrirSheet('mobSheetEtapa');
  };

  // Observa o board: em cada render, injeta o botão "mover etapa" nos cards
  // e colapsa colunas vazias (só no mobile).
  function prepararKanbanMobile() {
    var board = document.getElementById('kanbanBoard');
    if (!board || !isMobile()) return;
    board.querySelectorAll('.kanban-column').forEach(function (col) {
      var cards = col.querySelectorAll('.kanban-card');
      if (!col.dataset.mobWired) {
        col.dataset.mobWired = '1';
        var header = col.querySelector('.kanban-column-header');
        if (header) header.addEventListener('click', function (e) {
          if (!isMobile()) return;
          if (e.target.closest('button')) return; // não colapsa ao tocar nos botões do header
          col.classList.toggle('mob-collapsed');
        });
      }
      if (cards.length === 0) col.classList.add('mob-collapsed');
      cards.forEach(function (card) {
        if (card.querySelector('.kanban-move-btn')) return;
        var nomeEl = card.querySelector('.kanban-card-title');
        var nome = nomeEl ? nomeEl.textContent : '';
        var id = card.dataset.id;
        var status = col.dataset.status || '';
        if (!id) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kanban-move-btn';
        btn.textContent = 'Mover etapa ›';
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          window.abrirSheetMoverEtapa(id, nome, status);
        });
        card.appendChild(btn);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var board = document.getElementById('kanbanBoard');
    if (board && window.MutationObserver) {
      var obs = new MutationObserver(function () {
        clearTimeout(window.__kanbanMobTimer);
        window.__kanbanMobTimer = setTimeout(prepararKanbanMobile, 150);
      });
      obs.observe(board, { childList: true });
    }
    setTimeout(prepararKanbanMobile, 800);
  });
})();
