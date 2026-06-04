const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

html = html.replace(/abrirClienteModal\(state\.orcamento\.notionClienteId\)/g, 'editarClienteNotion(state.orcamento.notionClienteId)');
html = html.replace(/abrirClienteModal\(currentEditingClienteId\)/g, 'editarClienteNotion(currentEditingClienteId)');

fs.writeFileSync('public/index.html', html);
console.log('Fixed onclick to use editarClienteNotion');
