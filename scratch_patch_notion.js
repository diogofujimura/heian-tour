const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('public/index.html', 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;

// Find 'Dados do Cliente' card title
const titles = Array.from(doc.querySelectorAll('h2.card-title'));
const h2 = titles.find(t => t.textContent.includes('Dados do Cliente'));

if (h2) {
  const btn = doc.createElement('button');
  btn.id = 'btnImportNotion';
  btn.className = 'btn-secondary';
  btn.style.marginLeft = '10px';
  btn.style.fontSize = '12px';
  btn.style.backgroundColor = '#f1f5f9';
  btn.innerHTML = '⚡ Importar do Notion';
  h2.appendChild(btn);

  const selectHtml = `
  <div class="field" id="notionSelectWrapper" style="display:none; grid-column: span 2; margin-bottom: 15px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
    <label style="color: #0f172a; font-weight: 600;">Selecione o Cliente no Notion:</label>
    <select id="notionClienteSelect" style="width: 100%; padding: 8px; margin-top: 5px;">
      <option value="">Carregando clientes...</option>
    </select>
  </div>`;
  
  const formGrid = h2.nextElementSibling;
  if (formGrid && formGrid.classList.contains('form-grid')) {
    formGrid.insertAdjacentHTML('afterbegin', selectHtml);
  }
  
  fs.writeFileSync('public/index.html', dom.serialize());
  console.log('index.html updated successfully with Notion UI!');
} else {
  console.log('h2 not found');
}
