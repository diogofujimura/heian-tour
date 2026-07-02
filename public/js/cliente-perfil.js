/* ============================================================================
   HEIAN TOUR — PERFIL & PREFERÊNCIAS DO CLIENTE (camada nova)
   Injeta no editor de cliente (#modalClienteContentInline) uma seção editável
   com os campos de perfil da ficha de cadastro (reaproveitando a semente).
   - carregar(prefs): preenche os campos com as preferências salvas.
   - coletar(): devolve { preferencias:{...}, colunas:{...} } pro salvar.
   Não grava sozinho; quem salva é o fluxo do App (salvarClienteNotion).
   ========================================================================== */
(function (root) {
  var BASICOS = { nome: 1, email: 1, fotoPerfil: 1, viajantes: 1, periodo: 1, hotel: 1, voos: 1 };
  // chaves que também viram coluna no Notion
  var COLUNAS = { profissoes: 'profissoes', necessidadesEspeciais: 'necessidadesEspeciais', ocasiaoEspecial: 'ocasiaoEspecial', observacoes: 'observacoes' };

  function el(t, a, h) { var e = document.createElement(t); if (a) for (var k in a) e.setAttribute(k, a[k]); if (h != null) e.innerHTML = h; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
  function seed() { return root.CADASTRO_FORM_SEED; }
  function camposPerfil() {
    var s = seed(); if (!s) return [];
    var out = [];
    s.secoes.forEach(function (sec) { sec.campos.forEach(function (c) { if (!BASICOS[c.id]) out.push(c); }); });
    return out;
  }

  var inputCss = 'width:100%;padding:8px;border:1px solid var(--border,#ddd);border-radius:7px;font-size:13px;box-sizing:border-box;';

  function injetar() {
    var host = document.getElementById('modalClienteContentInline');
    if (!host) return false;
    if (document.getElementById('mcPerfilSection')) return true; // já injetado

    var sec = el('div', { id: 'mcPerfilSection' });
    var head = el('div', { class: 'subsection-title', style: 'margin-top:24px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold-dk,#9c8248);display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;' });
    head.innerHTML = '<span>⛩️ Perfil &amp; Preferências</span>';
    var btnMin = el('button', { type: 'button', id: 'mcPerfilToggle', title: 'Minimizar / expandir', style: 'cursor:pointer;border:1px solid var(--border,#ddd);background:#fff;color:var(--ink-mid,#666);border-radius:7px;font-size:13px;font-weight:700;line-height:1;padding:3px 11px;' }, '–');
    head.appendChild(btnMin);
    sec.appendChild(head);
    var grid = el('div', { id: 'mcPerfilGrid', style: 'margin-top:10px;display:flex;flex-direction:column;gap:14px;' });
    camposPerfil().forEach(function (c) { grid.appendChild(renderCampo(c)); });
    sec.appendChild(grid);

    var aberto = true;
    try { aberto = localStorage.getItem('mcPerfilAberto') !== '0'; } catch (e) {}
    function aplicar() { grid.style.display = aberto ? 'flex' : 'none'; btnMin.textContent = aberto ? '–' : '+'; btnMin.title = aberto ? 'Minimizar' : 'Expandir'; }
    function toggle() { aberto = !aberto; try { localStorage.setItem('mcPerfilAberto', aberto ? '1' : '0'); } catch (e) {} aplicar(); }
    btnMin.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    head.addEventListener('click', toggle);
    aplicar();

    // injeta ANTES do botão de salvar, se houver; senão no fim
    var btn = document.getElementById('btnSalvarClienteModal');
    var acoes = btn ? (btn.closest('.modal-actions') || btn.parentNode) : null;
    if (acoes && acoes.parentNode === host) host.insertBefore(sec, acoes);
    else host.appendChild(sec);
    return true;
  }

  function renderCampo(c) {
    var box = el('div', { 'data-pf': c.id, 'data-tipo': c.tipo, style: 'padding:12px 14px;border:1px solid var(--border,#ece7df);border-radius:10px;background:rgba(196,163,90,0.03);' });
    box.appendChild(el('label', { style: 'display:block;font-size:12px;font-weight:600;color:var(--ink-mid,#555);margin-bottom:8px;' }, esc(c.label)));
    var ph = c.placeholder || '';
    if (c.tipo === 'texto') box.appendChild(el('input', { type: 'text', 'data-v': '1', placeholder: ph, style: inputCss }));
    else if (c.tipo === 'textolongo') box.appendChild(el('textarea', { 'data-v': '1', rows: '2', placeholder: ph, style: inputCss }));
    else if (c.tipo === 'escolha_unica' || c.tipo === 'simnao' || c.tipo === 'escolha_multipla') {
      var multi = c.tipo === 'escolha_multipla';
      var wrap = el('div', { style: 'display:flex;flex-wrap:wrap;gap:7px;' });
      (c.opcoes || []).forEach(function (op) {
        var lab = el('label', { style: 'font-size:12px;border:1px solid #ddd;border-radius:999px;padding:5px 11px;cursor:pointer;display:inline-flex;gap:6px;align-items:center;background:#fff;' });
        var inp = el('input', { type: multi ? 'checkbox' : 'radio', name: 'pf_' + c.id, value: op.valor });
        lab.appendChild(inp); lab.appendChild(document.createTextNode(op.rotulo));
        wrap.appendChild(lab);
      });
      box.appendChild(wrap);
    } else if (c.tipo === 'condicional_texto') {
      // simplificado no App: campo de texto direto (vazio = sem ocasião)
      box.appendChild(el('input', { type: 'text', 'data-v': '1', placeholder: ph || 'Ex: Lua de Mel, Aniversário...', style: inputCss }));
    } else {
      box.appendChild(el('input', { type: 'text', 'data-v': '1', placeholder: ph, style: inputCss }));
    }
    return box;
  }

  function setCampo(id, valor) {
    var box = document.querySelector('#mcPerfilGrid [data-pf="' + id + '"]'); if (!box) return;
    var tipo = box.getAttribute('data-tipo');
    if (tipo === 'escolha_multipla') {
      var arr = Array.isArray(valor) ? valor : (valor ? String(valor).split(',').map(function (x) { return x.trim(); }) : []);
      box.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = arr.indexOf(cb.value) >= 0; });
    } else if (tipo === 'escolha_unica' || tipo === 'simnao') {
      box.querySelectorAll('input[type="radio"]').forEach(function (r) { r.checked = (r.value === valor); });
    } else {
      var i = box.querySelector('[data-v]'); if (i) i.value = (valor == null ? '' : valor);
    }
  }

  function carregar(prefs) {
    if (!injetar()) return;
    prefs = prefs || {};
    camposPerfil().forEach(function (c) { setCampo(c.id, prefs[c.id]); });
  }

  function coletar() {
    if (!document.getElementById('mcPerfilGrid')) return null;
    var preferencias = {}, colunas = {};
    camposPerfil().forEach(function (c) {
      var box = document.querySelector('#mcPerfilGrid [data-pf="' + c.id + '"]'); if (!box) return;
      var tipo = box.getAttribute('data-tipo'), val;
      if (tipo === 'escolha_multipla') val = Array.prototype.map.call(box.querySelectorAll('input:checked'), function (x) { return x.value; });
      else if (tipo === 'escolha_unica' || tipo === 'simnao') { var sel = box.querySelector('input:checked'); val = sel ? sel.value : ''; }
      else { var i = box.querySelector('[data-v]'); val = i ? i.value.trim() : ''; }
      preferencias[c.id] = val;
      if (COLUNAS[c.id]) colunas[c.id] = Array.isArray(val) ? val.join(', ') : val;
    });
    return { preferencias: preferencias, colunas: colunas };
  }

  // Auto-injeta a seção quando o editor de cliente fica visível (cobre editar e novo)
  function watchEditor() {
    var cont = document.getElementById('clientesEditorContainer');
    if (!cont || cont.__pfWatched) return;
    cont.__pfWatched = true;
    try {
      var obs = new MutationObserver(function () { if (cont.style.display !== 'none') injetar(); });
      obs.observe(cont, { attributes: true, attributeFilter: ['style'] });
    } catch (e) {}
    if (cont.style.display !== 'none') injetar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchEditor);
  else watchEditor();
  setTimeout(watchEditor, 1500);

  root.HeianPerfil = { injetar: injetar, carregar: carregar, coletar: coletar, camposPerfil: camposPerfil };
})(typeof window !== 'undefined' ? window : globalThis);
