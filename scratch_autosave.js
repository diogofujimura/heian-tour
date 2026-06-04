const fs = require('fs');

// 1. UPDATE HTML
let html = fs.readFileSync('public/index.html', 'utf8');

const oldHtml = `    <div class="roteiro-container" id="roteiroEditContainer" style="display:none; margin-bottom: 16px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 24px; border-bottom:1px solid var(--border); padding-bottom:16px;">`;

const newHtml = `    <div class="roteiro-container" id="roteiroEditContainer" style="display:none; margin-bottom: 16px;">
      <div id="roteiroEditHeaderDisplay" style="text-align: center; margin-bottom: 24px; padding: 20px; background: #fff; border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
        <h2 id="roteiroEditTitle" style="margin: 0; color: var(--gold-dk); font-size: 22px; font-weight: 600;">Roteiro em Edição</h2>
        <p id="roteiroEditSubtitle" style="margin: 6px 0 0 0; color: var(--text-sec); font-size: 15px; font-weight: 500;">Cliente: - | Viagem: -</p>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 24px; border-bottom:1px solid var(--border); padding-bottom:16px;">`;

html = html.replace(oldHtml, newHtml);
fs.writeFileSync('public/index.html', html);


// 2. UPDATE ROTEIROS.JS
let rot = fs.readFileSync('public/js/roteiros.js', 'utf8');

// Add triggerRoteiroAutoSave and updateRoteiroHeader
const headerFunctions = `
let _roteiroAutoSaveTimer = null;
window.triggerRoteiroAutoSave = function() {
  clearTimeout(_roteiroAutoSaveTimer);
  _roteiroAutoSaveTimer = setTimeout(async () => {
    if (!roteiroOriginalNome || !roteiroEmEdicao) return;
    const indicator = document.getElementById('roteiroAutoSaveIndicator');
    if (indicator) { indicator.textContent = 'Salvando...'; indicator.style.opacity = '1'; }
    
    try {
      dbRotas[roteiroOriginalNome] = roteiroEmEdicao;
      await fetch('/api/roteiros/' + encodeURIComponent(roteiroOriginalNome), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roteiroEmEdicao)
      });
      if (indicator) {
        indicator.textContent = 'Salvo automaticamente';
        setTimeout(() => { if(indicator) indicator.style.opacity = '0'; }, 1500);
      }
    } catch(e) {
      console.error('Erro no autosave', e);
      if (indicator) { indicator.textContent = 'Erro ao salvar'; }
    }
  }, 1000);
};

window.updateRoteiroHeader = function() {
  const t = document.getElementById('roteiroEditTitle');
  const s = document.getElementById('roteiroEditSubtitle');
  if(!t || !s) return;
  const cliente = roteiroEmEdicao.cliente || {};
  t.textContent = document.getElementById('editRoteiroNome')?.value || roteiroOriginalNome || 'Roteiro em Edição';
  const nome = cliente.nome || 'Sem nome';
  const data = cliente.dataOrcamento ? (cliente.dataOrcamento + (cliente.dataFim ? ' a ' + cliente.dataFim : '')) : 'Sem data definida';
  s.textContent = \`Cliente: \${nome} | Viagem: \${data}\`;
};
`;

// Insert the functions at the end of the file
rot += headerFunctions;

// Make renderEditDias trigger autosave
rot = rot.replace(`function renderEditDias() {`, `function renderEditDias() { updateRoteiroHeader(); triggerRoteiroAutoSave(); `);

// Make updRotCliente trigger autosave and update header
rot = rot.replace(`window.updRotCliente = function(field, val) {
  if (!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {};
  roteiroEmEdicao.cliente[field] = val;
};`, `window.updRotCliente = function(field, val) {
  if (!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {};
  roteiroEmEdicao.cliente[field] = val;
  updateRoteiroHeader();
  triggerRoteiroAutoSave();
};`);

// Make abrirEditorRoteiro update header
rot = rot.replace(`  window.renderRotEstadias();`, `  window.renderRotEstadias(); updateRoteiroHeader();`);

fs.writeFileSync('public/js/roteiros.js', rot);
console.log('Added AutoSave and Header');
