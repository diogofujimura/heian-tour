const fs = require('fs');

// 1. Update index.html
let html = fs.readFileSync('public/index.html', 'utf8');

const modalHtml = `
      <div class="modal-header" style="margin-bottom: 20px;">
        <h2 id="modalClienteTitle" style="margin:0; color: var(--gold-dk); font-size: 24px;">Novo Cliente</h2>
      </div>
      <div class="form-grid">
        <div class="field"><label>Nome</label><input type="text" id="mcNome"></div>
        <div class="field"><label>Status</label>
          <select id="mcStatus">
            <option value="Início/call de dúvidas">Início/call de dúvidas</option>
            <option value="Roteiro Rascunho">Roteiro Rascunho</option>
            <option value="Roteiro versão final">Roteiro versão final</option>
            <option value="Negociação Aprovada">Negociação Aprovada</option>
            <option value="Finalizados">Finalizados</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>
        <div class="field"><label>Adultos</label><input type="number" id="mcAdultos" value="2" min="1"></div>
        <div class="field"><label>Crianças</label><input type="number" id="mcCriancas" value="0" min="0"></div>
        <div class="field"><label>Voo Chegada (Info)</label><input type="text" id="mcVooChegada"></div>
        <div class="field"><label>Voo Partida (Info)</label><input type="text" id="mcVooPartida"></div>
        <div class="field"><label>Data Início</label><input type="date" id="mcDataInicio"></div>
        <div class="field"><label>Data Fim</label><input type="date" id="mcDataFim"></div>
      </div>
      <div class="modal-actions" style="margin-top: 25px; display: flex; justify-content: flex-end; gap: 10px;">
        <button class="btn-secondary" onclick="closeClienteModal()">Cancelar</button>
        <button class="btn-primary" id="btnSalvarClienteModal">Salvar no Notion</button>
      </div>
`;

if (html.includes('<div id="modalClienteContentInline"></div>')) {
  html = html.replace('<div id="modalClienteContentInline"></div>', `<div id="modalClienteContentInline">\n${modalHtml}\n</div>`);
  fs.writeFileSync('public/index.html', html);
  console.log("Updated index.html to include inline form!");
} else if (html.includes('id="modalClienteContentInline"')) {
  console.log("Inline form already populated!");
} else {
  console.log("Could not find modalClienteContentInline");
}

// 2. Update app.js
let js = fs.readFileSync('public/js/app.js', 'utf8');

js = js.replace(/document\.getElementById\('modalCliente'\)\.style\.display = 'flex';/g, `
  document.getElementById('clientesEmptyState').style.display = 'none';
  document.getElementById('clientesDetailWrapper').style.display = 'block';
`);

js = js.replace(/document\.getElementById\('modalCliente'\)\.style\.display = 'none';/g, `
  document.getElementById('clientesEmptyState').style.display = 'block';
  document.getElementById('clientesDetailWrapper').style.display = 'none';
`);

fs.writeFileSync('public/js/app.js', js);
console.log("Updated app.js!");
