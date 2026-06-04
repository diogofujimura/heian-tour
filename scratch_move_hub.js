const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Remove old buttons
const oldBtns = `<div style="display:flex; justify-content: space-between; margin-bottom: 20px; gap: 10px;">
        <button id="btnAcessoCotacao" class="btn-secondary" style="flex: 1;" type="button">Abrir Cotação</button>
        <button id="btnAcessoRoteiro" class="btn-secondary" style="flex: 1;" type="button">Abrir Roteiro</button>
      </div>`;
html = html.replace(oldBtns, '');

// 2. Add to header
const oldHeader = `<h2 class="modal-title" id="modalClienteTitle">Novo Cliente</h2>`;
const newHeader = `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; padding-right: 20px;">
    <h2 class="modal-title" id="modalClienteTitle" style="margin-bottom: 0;">Novo Cliente</h2>
    <div style="display:flex; gap: 8px;">
      <button id="btnAcessoCotacao" class="btn-secondary" style="font-size: 12px; padding: 6px 12px;" type="button">Abrir Cotação</button>
      <button id="btnAcessoRoteiro" class="btn-secondary" style="font-size: 12px; padding: 6px 12px;" type="button">Abrir Roteiro</button>
    </div>
  </div>`;

if (html.includes(oldHeader)) {
  html = html.replace(oldHeader, newHeader);
  fs.writeFileSync('public/index.html', html);
  console.log('Moved buttons to header');
} else {
  console.log('Header not found');
}
