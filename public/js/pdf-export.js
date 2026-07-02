/* ============================================================================
   HEIAN TOUR — BARRA DE EXPORTAÇÃO DO ROTEIRO (não-destrutiva)
   - Move o controle de "incluir descrições" pra dentro do preview, como
     escolha de VERSÃO (Resumida / Detalhada). Padrão: Detalhada.
   - Adiciona "Enviar por e-mail" usando a função existente do app.
   - Só aparece no preview de ROTEIRO (não na cotação).
   Não altera dados nem integrações.
   ============================================================================ */
(function () {
  'use strict';
  function el(id) { return document.getElementById(id); }

  function setVersao(detalhada) {
    var chk = el('chkIncluirDescricoesPdf');
    if (chk) chk.checked = !!detalhada;
    var r = el('rbVerResumida'), d = el('rbVerDetalhada');
    if (r && d) { r.classList.toggle('on', !detalhada); d.classList.toggle('on', !!detalhada); }
  }
  function regenerar() {
    var btn = el('btnGerarRoteiro');
    if (btn) { btn.disabled = false; btn.click(); }
  }

  function montarControles() {
    var toolbar = document.querySelector('#previewOverlay .preview-toolbar');
    if (!toolbar || el('rbExportControls')) return;
    var group = toolbar.querySelector('div') || toolbar;

    var wrap = document.createElement('div');
    wrap.id = 'rbExportControls';
    wrap.style.cssText = 'display:none; align-items:center; gap:10px; margin-right:6px;';
    wrap.innerHTML =
      '<div class="rb-ver-seg" style="display:inline-flex; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); border-radius:999px; padding:3px;">' +
      '  <button id="rbVerResumida" type="button" style="border:0; background:transparent; color:rgba(255,255,255,0.85); font:600 12px Inter,sans-serif; padding:6px 14px; border-radius:999px; cursor:pointer;">Resumida</button>' +
      '  <button id="rbVerDetalhada" type="button" style="border:0; background:transparent; color:rgba(255,255,255,0.85); font:600 12px Inter,sans-serif; padding:6px 14px; border-radius:999px; cursor:pointer;">Detalhada</button>' +
      '</div>' +
      '<button id="rbEnviarEmail" type="button" class="btn-secondary" style="color:rgba(255,255,255,0.92); border-color:rgba(255,255,255,0.4); display:inline-flex; align-items:center; gap:5px;">✉ Enviar por e-mail</button>';
    group.insertBefore(wrap, group.firstChild);

    // estilo do segmento ativo
    var st = document.createElement('style');
    st.textContent = '#rbExportControls .rb-ver-seg button.on{background:#fff;color:#842836}';
    document.head.appendChild(st);

    el('rbVerResumida').addEventListener('click', function () { setVersao(false); regenerar(); });
    el('rbVerDetalhada').addEventListener('click', function () { setVersao(true); regenerar(); });
    el('rbEnviarEmail').addEventListener('click', function () {
      if (typeof window.abrirModalEnviarEmail === 'function') window.abrirModalEnviarEmail();
      else alert('Função de e-mail indisponível.');
    });
  }

  function mostrarControles(on) {
    var w = el('rbExportControls'); if (w) w.style.display = on ? 'inline-flex' : 'none';
  }

  function init() {
    // padrão: Detalhada
    var chk = el('chkIncluirDescricoesPdf');
    if (chk) { chk.checked = true;
      // esconde o checkbox antigo (agora o controle vive no preview)
      var lbl = chk.closest('label'); if (lbl) lbl.style.display = 'none';
    }
    montarControles();
    setVersao(true);

    // mostra os controles ao abrir o preview de ROTEIRO
    var btnGerar = el('btnGerarRoteiro');
    if (btnGerar) btnGerar.addEventListener('click', function () { setTimeout(function () { mostrarControles(true); }, 60); });
    // esconde ao fechar
    var btnClose = el('btnClosePreview');
    if (btnClose) btnClose.addEventListener('click', function () { mostrarControles(false); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
