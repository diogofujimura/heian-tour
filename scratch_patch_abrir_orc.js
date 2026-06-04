const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const search = `  document.getElementById('clienteNome').value = orc.cliente?.nome || '';
  document.getElementById('clienteAdultos').value = orc.cliente?.adultos || '2';
  document.getElementById('clienteCriancas').value = orc.cliente?.criancas || '0';`;

const replace = `  const notionCli = orc.notionClienteId && typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === orc.notionClienteId) : null;
  document.getElementById('clienteNome').value = notionCli ? notionCli.nome : (orc.cliente?.nome || '');
  document.getElementById('clienteAdultos').value = notionCli ? notionCli.adultos : (orc.cliente?.adultos || '2');
  document.getElementById('clienteCriancas').value = notionCli ? notionCli.criancas : (orc.cliente?.criancas || '0');`;

if(app.includes(search)) {
  app = app.replace(search, replace);
  fs.writeFileSync('public/js/app.js', app);
  console.log('abrirOrcamento patched');
} else {
  console.log('abrirOrcamento pattern not found');
}
