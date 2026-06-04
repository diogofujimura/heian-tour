const fs = require('fs');
let content = fs.readFileSync('public/js/app.js', 'utf-8');

const regex = /window\.editarClienteNotion = function\(id\) \{\s*const c = notionClients\.find\(x => x\.id === id\);\s*if\(c\) abrirClienteModal\(c\);\s*\}/;

const replace = `window.editarClienteNotion = async function(id) {
    if (!notionClients || notionClients.length === 0) {
      try {
        const res = await fetch('/api/notion/clientes');
        notionClients = await res.json();
      } catch (e) {
        console.error('Erro ao carregar clientes do Notion:', e);
      }
    }
    const c = notionClients.find(x => x.id === id);
    if(c) abrirClienteModal(c);
    else alert('Cliente não encontrado no Notion.');
  }`;

if (content.match(regex)) {
  content = content.replace(regex, replace);
  fs.writeFileSync('public/js/app.js', content, 'utf-8');
  console.log('Patched window.editarClienteNotion');
} else {
  console.log('Regex not found');
}
