const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const oldInit = `  setupSync();
  updateResumo();
  document.getElementById('clienteDataOrcamento').value = today();
});`;

const newInit = `  setupSync();
  updateResumo();
  document.getElementById('clienteDataOrcamento').value = today();
  
  // Auto-load clients on initial page load if needed
  if (window.location.hash === '' || window.location.hash === '#clientes') {
     loadClientesTabela();
  }
});`;

app = app.replace(oldInit, newInit);
fs.writeFileSync('public/js/app.js', app);
console.log('Added loadClientesTabela() to DOMContentLoaded');
