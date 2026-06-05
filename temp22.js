const fs = require('fs');

let js = fs.readFileSync('public/js/app.js', 'utf8');

// I need to add hoverCliente and abrirDetalhesCliente if they don't exist.

const helpers = `
window.hoverCliente = function(id) {
  // Opcional: pre-carregar ou apenas destacar visualmente se necessário.
};

window.abrirDetalhesCliente = function(id) {
  const c = notionClients.find(x => x.id === id);
  if (c) {
    window.clienteAtualVisualizado = id;
    renderClientesTabela(); // updates highlights
    abrirClienteModal(c);
  }
};
`;

if (!js.includes('window.hoverCliente')) {
  js += '\n' + helpers;
  fs.writeFileSync('public/js/app.js', js);
  console.log("Added helpers to app.js");
}
