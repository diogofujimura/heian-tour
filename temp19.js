const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

// The marker has varied dashes, so we use a very permissive regex
const clientesRegex = /<div id="page-clientes"[\s\S]*?<!-- ── CONFIGURAÇÕES/;

const replaceClientes = `<div id="page-clientes" class="page pane-layout">
    <div class="pane-list">
      <div class="pane-list-header">
        <h2 style="font-family: var(--ff-display); font-size: 26px; font-weight: 400; color: var(--crimson);">Clientes</h2>
        <div style="display:flex; gap:8px">
          <input type="text" id="pesquisaClientesList" class="search-input-modern" placeholder="Pesquisar cliente..." onkeyup="renderClientesTabela()">
          <button class="btn-secondary" id="btnRefreshClientes" style="padding: 10px; border-radius:8px;" title="Sincronizar Notion">↻</button>
          <button class="btn-primary" id="btnNovoCliente" style="padding: 10px 14px; border-radius:8px;" title="Novo Cliente">+</button>
        </div>
      </div>
      <div class="pane-list-content" id="tabelaClientesList"></div>
    </div>
    
    <div class="pane-content" id="clientesPaneContent">
      <div class="pane-content-inner" id="clientesContentInner" style="display:flex; flex-direction:column; padding:0; min-height: 90vh;">
        
        <div id="clientesEmptyState" style="text-align:center; padding: 120px 20px; opacity:0.6;">
           <img src="assets/logo.png" style="width: 80px; opacity:0.2; margin-bottom: 20px; filter: grayscale(1);">
           <p style="font-size:18px; font-family: var(--ff-display);">Selecione um cliente na lista lateral para ver os detalhes.</p>
        </div>

        <div id="clientesDetailWrapper" style="display:none; width: 100%; padding: 40px;">
           <div id="modalClienteContentInline"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── CONFIGURAÇÕES`;

if (html.match(clientesRegex)) {
  html = html.replace(clientesRegex, replaceClientes);
  fs.writeFileSync('public/index.html', html);
  console.log("Clientes DOM fixed!");
} else {
  console.log("Could not find Clientes block.");
}
