const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const search = `    // Atualizar UI ativa (Cabeça e Corpo)
    if (document.getElementById('page-orcamento').style.display !== 'none' && state.orcamento && state.orcamento.id) {
       abrirOrcamento(state.orcamento.id);
    } else if (document.getElementById('page-roteiros').style.display !== 'none') {
       const selRoteiro = document.getElementById('selectRoteiroBase');
       if (selRoteiro && selRoteiro.value) {
           if (typeof abrirEditorRoteiro === 'function') abrirEditorRoteiro(selRoteiro.value);
       }
    }`;

const replace = `    // Atualizar UI ativa (Cabeça e Corpo)
    if (document.getElementById('page-orcamento').classList.contains('active') && state.orcamento && state.orcamento.id) {
       abrirOrcamento(state.orcamento.id);
    } else if (document.getElementById('page-roteiros').classList.contains('active')) {
       const selRoteiro = document.getElementById('selectRoteiroBase');
       if (selRoteiro && selRoteiro.value) {
           if (typeof abrirEditorRoteiro === 'function') abrirEditorRoteiro(selRoteiro.value);
       }
    }`;

if(app.includes(search)) {
  app = app.replace(search, replace);
  fs.writeFileSync('public/js/app.js', app);
  console.log('salvarClienteNotion fixed classList');
} else {
  console.log('salvarClienteNotion classList pattern not found');
}
