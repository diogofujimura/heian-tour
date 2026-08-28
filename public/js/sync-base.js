// ── SYNC BASE ⇄ SHEETS (front) — Backup app→Sheets + Importar Sheets→app c/ prévia ──
// Aditivo: injeta uma barra no cabeçalho da página "Base de Dados". Carregado após app.js.
(function () {
  'use strict';

  var TIPOS_LBL = { transportes: 'Transportes', experiencias: 'Experiências', atracoes: 'Atrações', rotas: 'Rotas', hoteis: 'Hotéis' };

  function el(tag, css, html) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; }

  function toast(msg, cor) {
    var t = el('div', 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:100000;background:' + (cor || '#333') + ';color:#fff;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 8px 28px rgba(0,0,0,0.25);max-width:80vw;', msg);
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 400); }, 3800);
  }

  function overlay() {
    var o = el('div', 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;padding:20px;');
    var card = el('div', 'background:#fff;border-radius:14px;max-width:640px;width:100%;max-height:86vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);');
    o.appendChild(card); o.__card = card;
    o.addEventListener('click', function (e) { if (e.target === o) o.remove(); });
    document.body.appendChild(o);
    return o;
  }

  async function post(url, body) {
    var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
    return d;
  }

  // ── BACKUP app → Sheets ──────────────────────────────────────────────────
  async function fazerBackup(btn) {
    var orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '☁️ Fazendo backup…';
    try {
      var d = await post('/api/base/backup-sheets', {});
      var linhas = Object.keys(d.resultado || {}).map(function (t) {
        var r = d.resultado[t];
        if (!r.ok) return '❌ ' + (TIPOS_LBL[t] || t) + ': ' + (r.erro || 'falha');
        var extra = r.aviso ? ' ⚠️ ' + r.aviso : '';
        return '✅ ' + (TIPOS_LBL[t] || t) + ': ' + r.appCount + ' item(ns) (↑' + (r.inseridos || 0) + ' novos, ' + (r.atualizados || 0) + ' atualizados)' + extra;
      });
      mostrarResultado(d.ok ? 'Backup concluído' : 'Backup concluído com avisos', linhas, d.ok);
    } catch (e) { toast('Erro no backup: ' + e.message, '#c0392b'); }
    finally { btn.disabled = false; btn.innerHTML = orig; }
  }

  function mostrarResultado(titulo, linhas, ok) {
    var o = overlay(); var c = o.__card;
    c.appendChild(el('div', 'padding:18px 22px;border-bottom:1px solid #eee;font-size:16px;font-weight:700;color:' + (ok ? '#2e7d32' : '#b8860b') + ';', titulo));
    var body = el('div', 'padding:16px 22px;');
    linhas.forEach(function (l) { body.appendChild(el('div', 'font-size:13px;padding:6px 0;border-bottom:1px solid #f4f2ee;', l)); });
    c.appendChild(body);
    var foot = el('div', 'padding:14px 22px;text-align:right;');
    var b = el('button', 'cursor:pointer;border:none;background:var(--crimson,#8e1c1c);color:#fff;padding:8px 18px;border-radius:8px;font-weight:600;', 'Fechar');
    b.onclick = function () { o.remove(); }; foot.appendChild(b); c.appendChild(foot);
  }

  // ── IMPORT Sheets → app (prévia → confirmar) ─────────────────────────────
  async function abrirImport(btn) {
    var orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '⬇️ Lendo o Sheets…';
    try {
      var d = await post('/api/base/importar-sheets/preview', {});
      montarPreview(d.preview || {});
    } catch (e) { toast('Erro ao ler o Sheets: ' + e.message, '#c0392b'); }
    finally { btn.disabled = false; btn.innerHTML = orig; }
  }

  function montarPreview(preview) {
    var o = overlay(); var c = o.__card;
    c.appendChild(el('div', 'padding:18px 22px;border-bottom:1px solid #eee;font-size:16px;font-weight:700;', '⬇️ Importar do Sheets — prévia'));
    var body = el('div', 'padding:12px 22px;');
    var totalRemovidos = 0, algumSemId = 0, algumErro = false;
    Object.keys(preview).forEach(function (t) {
      var p = preview[t]; var box = el('div', 'padding:10px 0;border-bottom:1px solid #f4f2ee;');
      if (!p.ok) { algumErro = true; box.innerHTML = '<b>' + (TIPOS_LBL[t] || t) + '</b> — <span style="color:#c0392b">erro: ' + (p.erro || 'falha') + '</span>'; body.appendChild(box); return; }
      totalRemovidos += p.removidos || 0; algumSemId += p.semId || 0;
      var partes = [];
      if (p.novos) partes.push('<span style="color:#2e7d32">+' + p.novos + ' novos</span>');
      if (p.alterados) partes.push('<span style="color:#b8860b">' + p.alterados + ' alterados</span>');
      if (p.removidos) partes.push('<span style="color:#c0392b;font-weight:700">−' + p.removidos + ' REMOVIDOS do app</span>');
      partes.push('<span style="color:#999">' + p.iguais + ' iguais</span>');
      if (p.semId) partes.push('<span style="color:#c0392b">⚠️ ' + p.semId + ' sem id (serão ignorados)</span>');
      box.innerHTML = '<b>' + (TIPOS_LBL[t] || t) + '</b> <span style="color:#999;font-size:12px">(Sheets: ' + p.sheetCount + ' · App: ' + p.appCount + ')</span><br><span style="font-size:12.5px">' + partes.join(' · ') + '</span>';
      body.appendChild(box);
    });
    if (totalRemovidos > 0) body.appendChild(el('div', 'margin-top:12px;padding:10px 12px;background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.25);border-radius:8px;font-size:12.5px;color:#c0392b;', '⚠️ <b>' + totalRemovidos + ' item(ns) serão REMOVIDOS do app</b> (existem no app mas não no Sheets). O snapshot permite desfazer.'));
    body.appendChild(el('div', 'margin-top:10px;font-size:12px;color:#888;', 'Antes de aplicar, é salvo um <b>snapshot</b> da base atual do app — dá pra desfazer.'));
    c.appendChild(body);
    var foot = el('div', 'padding:14px 22px;display:flex;gap:10px;justify-content:flex-end;');
    var cancel = el('button', 'cursor:pointer;border:1px solid #ddd;background:#fff;color:#555;padding:8px 16px;border-radius:8px;font-weight:600;', 'Cancelar');
    cancel.onclick = function () { o.remove(); };
    var conf = el('button', 'cursor:pointer;border:none;background:' + (algumErro ? '#999' : 'var(--crimson,#8e1c1c)') + ';color:#fff;padding:8px 18px;border-radius:8px;font-weight:700;', 'Confirmar import');
    conf.disabled = algumErro;
    conf.onclick = async function () {
      conf.disabled = true; conf.innerHTML = 'Importando…';
      try {
        var d = await post('/api/base/importar-sheets/aplicar', {});
        o.remove();
        var linhas = Object.keys(d.aplicado || {}).map(function (t) { var a = d.aplicado[t]; return (a.ok ? '✅ ' : '❌ ') + (TIPOS_LBL[t] || t) + ': ' + (a.ok ? (a.importados + ' importados') : a.erro); });
        linhas.push('💾 Snapshot salvo — dá pra desfazer em "Restaurar backup".');
        mostrarResultado('Import concluído', linhas, true);
        if (typeof window.loadDB === 'function') window.loadDB();
        if (typeof window.carregarBases === 'function') window.carregarBases();
      } catch (e) { toast('Erro ao importar: ' + e.message, '#c0392b'); conf.disabled = false; conf.innerHTML = 'Confirmar import'; }
    };
    foot.appendChild(cancel); foot.appendChild(conf); c.appendChild(foot);
  }

  // ── RESTAURAR snapshot (undo) ────────────────────────────────────────────
  async function abrirRestaurar() {
    try {
      var r = await fetch('/api/base/snapshots'); var snaps = await r.json();
      if (!Array.isArray(snaps) || !snaps.length) { toast('Nenhum snapshot disponível ainda.', '#555'); return; }
      var o = overlay(); var c = o.__card;
      c.appendChild(el('div', 'padding:18px 22px;border-bottom:1px solid #eee;font-size:16px;font-weight:700;', '↩ Restaurar backup do app'));
      var body = el('div', 'padding:12px 22px;');
      body.appendChild(el('div', 'font-size:12px;color:#888;margin-bottom:8px;', 'Restaura a base do app a partir de um snapshot. Não mexe no Sheets.'));
      snaps.slice().reverse().forEach(function (s) {
        var tam = Object.keys(s.tamanhos || {}).map(function (t) { return (TIPOS_LBL[t] || t) + ':' + s.tamanhos[t]; }).join(' · ');
        var row = el('div', 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #f4f2ee;');
        row.appendChild(el('div', 'font-size:12.5px;', '<b>' + new Date(s.em).toLocaleString('pt-BR') + '</b> <span style="color:#999">(' + (s.motivo || '') + ')</span><br><span style="color:#888;font-size:11px">' + tam + '</span>'));
        var b = el('button', 'cursor:pointer;border:1px solid var(--crimson,#8e1c1c);background:#fff;color:var(--crimson,#8e1c1c);padding:6px 12px;border-radius:8px;font-weight:600;font-size:12px;flex-shrink:0;', 'Restaurar');
        b.onclick = async function () {
          if (!confirm('Restaurar a base do app para este ponto? A base atual será salva como snapshot antes.')) return;
          b.disabled = true; b.innerHTML = '…';
          try { await post('/api/base/snapshots/restaurar', { i: s.i }); o.remove(); toast('Base restaurada ✓', '#2e7d32'); if (typeof window.loadDB === 'function') window.loadDB(); }
          catch (e) { toast('Erro ao restaurar: ' + e.message, '#c0392b'); b.disabled = false; b.innerHTML = 'Restaurar'; }
        };
        row.appendChild(b); body.appendChild(row);
      });
      c.appendChild(body);
      var foot = el('div', 'padding:12px 22px;text-align:right;');
      var close = el('button', 'cursor:pointer;border:1px solid #ddd;background:#fff;color:#555;padding:8px 16px;border-radius:8px;font-weight:600;', 'Fechar');
      close.onclick = function () { o.remove(); }; foot.appendChild(close); c.appendChild(foot);
    } catch (e) { toast('Erro: ' + e.message, '#c0392b'); }
  }

  // ── injeta a barra no cabeçalho da página Base ────────────────────────────
  function injetar() {
    var header = document.querySelector('#page-base .page-header');
    if (!header || document.getElementById('syncBaseBar')) return;
    var bar = el('div', 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px;');
    bar.id = 'syncBaseBar';
    var bBackup = el('button', 'cursor:pointer;border:1px solid #cbd5e1;background:#fff;color:#0f766e;padding:7px 14px;border-radius:8px;font-weight:600;font-size:12.5px;display:inline-flex;align-items:center;gap:5px;', '☁️ Backup no Sheets');
    bBackup.title = 'Envia a base do app pro Sheets (preserva fotos/fórmulas). Confere no fim.';
    bBackup.onclick = function () { fazerBackup(bBackup); };
    var bImport = el('button', 'cursor:pointer;border:1px solid #cbd5e1;background:#fff;color:#8e1c1c;padding:7px 14px;border-radius:8px;font-weight:600;font-size:12.5px;display:inline-flex;align-items:center;gap:5px;', '⬇️ Importar do Sheets');
    bImport.title = 'Puxa a base do Sheets pro app, com prévia do que muda antes de aplicar.';
    bImport.onclick = function () { abrirImport(bImport); };
    var bRestore = el('button', 'cursor:pointer;border:none;background:none;color:#888;padding:7px 6px;font-size:11.5px;text-decoration:underline;', '↩ Restaurar backup');
    bRestore.onclick = abrirRestaurar;
    bar.appendChild(bBackup); bar.appendChild(bImport); bar.appendChild(bRestore);
    header.appendChild(bar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injetar);
  else injetar();
  // reinjeta caso a página seja (re)montada
  setTimeout(injetar, 1500);
  window.__syncBaseInjetar = injetar;
})();
