const fs = require('fs');
let roteiros = fs.readFileSync('public/js/roteiros.js', 'utf8');

const search = `  if (!notionId && state && state.orcamento && state.orcamento.orcRoteiroVinculado === nome) {
    notionId = state.orcamento.notionClienteId;
  }`;

const replace = `  if (!notionId && state && state.orcamento && state.orcamento.orcRoteiroVinculado === nome) {
    notionId = state.orcamento.notionClienteId;
  }
  if (!notionId && typeof currentEditingClienteId !== 'undefined' && currentEditingClienteId) {
    notionId = currentEditingClienteId;
  }`;

if(roteiros.includes(search)) {
  roteiros = roteiros.replace(search, replace);
  fs.writeFileSync('public/js/roteiros.js', roteiros);
  console.log('abrirEditorRoteiro currentEditingClienteId patched');
} else {
  console.log('abrirEditorRoteiro currentEditingClienteId pattern not found');
}
