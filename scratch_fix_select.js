const fs = require('fs');
let rot = fs.readFileSync('public/js/roteiros.js', 'utf8');

const oldEvents = `function setupEvents() {
  const select = document.getElementById('selectRoteiroBase');
  if (select) {
    select.addEventListener('change', (e) => {
      const roteiro = e.target.value;
      renderizarRoteiro(roteiro);
      
      document.getElementById('btnEditarRoteiro').style.display = roteiro ? 'inline-block' : 'none';
      document.getElementById('btnExcluirRoteiro').style.display = roteiro ? 'inline-block' : 'none';
    });
  }
}`;

const newEvents = `function setupEvents() {
  const select = document.getElementById('selectRoteiroBase');
  if (select) {
    select.addEventListener('change', (e) => {
      const roteiro = e.target.value;
      renderizarRoteiro(roteiro);
      
      const btnEditar = document.getElementById('btnEditarRoteiro');
      const btnExcluir = document.getElementById('btnExcluirRoteiro');
      
      btnEditar.style.display = roteiro ? 'inline-block' : 'none';
      btnExcluir.style.display = roteiro ? 'inline-block' : 'none';
      
      // Auto-open editor to show the user the client data and avoid empty timeline confusion
      if (roteiro) {
        btnEditar.click();
      }
    });
  }
}`;

rot = rot.replace(oldEvents, newEvents);
fs.writeFileSync('public/js/roteiros.js', rot);
console.log('Fixed select dropdown UX');
