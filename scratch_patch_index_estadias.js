const fs = require('fs');

// PATCH INDEX.HTML
let html = fs.readFileSync('public/index.html', 'utf8');

const oldEstadiasHTML = `  <div style="display: flex; justify-content: space-between; align-items: center;">
    <div class="subsection-title" style="margin: 0;">Estadias</div>
    <button id="btnSyncHoteisNotion" class="btn-secondary" style="font-size: 11px; padding: 4px 8px;">↻ Enviar p/ Notion</button>
  </div>

      <div id="estadiasList"></div>
      <button class="btn-add" id="btnAddEstadia">+ Adicionar Estadia</button>`;

const newReadOnlyEstadiasHTML = `  <div style="display: flex; justify-content: space-between; align-items: center;">
    <div class="subsection-title" style="margin: 0;">Estadias (Herdadas do Cliente)</div>
  </div>
  <div id="estadiasReadOnlyList" style="margin-bottom: 20px; font-size: 14px; color: #475569; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
    <p class="hint" style="margin:0;">Nenhuma estadia. Edite o cliente na aba "Clientes (Notion)" para adicionar estadias.</p>
  </div>`;

if (html.includes(oldEstadiasHTML)) {
  html = html.replace(oldEstadiasHTML, newReadOnlyEstadiasHTML);
} else {
  console.log("Could not find oldEstadiasHTML block in index.html");
}

// Add estadiasList to modalCliente
const modalFooterHTML = `<div class="modal-footer">`;
const modalEstadiasHTML = `
      <hr style="border:0; border-top:1px solid #e2e8f0; margin: 20px 0;">
      <h3 style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Estadias do Cliente</h3>
      <div id="estadiasList"></div>
      <button class="btn-add" id="btnAddEstadia" type="button" style="margin-bottom: 20px;">+ Adicionar Estadia</button>
      <div class="modal-footer">`;
      
if (html.includes(modalFooterHTML) && !html.includes('Estadias do Cliente')) {
  html = html.replace(modalFooterHTML, modalEstadiasHTML);
}

fs.writeFileSync('public/index.html', html);
console.log("index.html patched for estadias move");
