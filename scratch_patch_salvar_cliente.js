const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const search = `    closeClienteModal();
    await loadClientesTabela(); // Recarrega a lista
    alert('Cliente salvo no Notion com sucesso!');`;

const replace = `    closeClienteModal();
    await loadClientesTabela(); // Recarrega a lista
    
    // Atualizar UI ativa (Cabeça e Corpo)
    if (document.getElementById('page-orcamento').style.display !== 'none' && state.orcamento && state.orcamento.id) {
       abrirOrcamento(state.orcamento.id);
    } else if (document.getElementById('page-roteiros').style.display !== 'none') {
       const selRoteiro = document.getElementById('selectRoteiroBase');
       if (selRoteiro && selRoteiro.value) {
           if (typeof abrirEditorRoteiro === 'function') abrirEditorRoteiro(selRoteiro.value);
       }
    }
    
    alert('Cliente salvo no Notion com sucesso!');`;

if(app.includes(search)) {
  app = app.replace(search, replace);
  fs.writeFileSync('public/js/app.js', app);
  console.log('salvarClienteNotion patched');
} else {
  console.log('salvarClienteNotion pattern not found');
}
