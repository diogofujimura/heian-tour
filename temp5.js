const fs = require('fs');
let appJs = fs.readFileSync('public/js/app.js', 'utf8');

const targetAbrir = `  document.getElementById('clienteNome').value = notionCli ? notionCli.nome : (orc.cliente?.nome || '');
  document.getElementById('clienteAdultos').value = notionCli ? notionCli.adultos : (orc.cliente?.adultos || '2');
  document.getElementById('clienteCriancas').value = notionCli ? notionCli.criancas : (orc.cliente?.criancas || '0');`;

const replaceAbrir = `  document.getElementById('clienteNome').value = notionCli ? notionCli.nome : (orc.cliente?.nome || '');
  document.getElementById('clienteAdultos').value = notionCli ? notionCli.adultos : (orc.cliente?.adultos || '2');
  document.getElementById('clienteCriancas').value = notionCli ? notionCli.criancas : (orc.cliente?.criancas || '0');
  
  const temCliente = !!orc.notionClienteId;
  const lockedStyle = temCliente ? 'background:#f1f5f9; cursor:not-allowed' : '';
  ['clienteNome', 'clienteAdultos', 'clienteCriancas'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.readOnly = temCliente; el.style = lockedStyle; }
  });`;

appJs = appJs.replace(targetAbrir, replaceAbrir);

const targetNovo = `  document.getElementById('clienteNome').value = '';
  document.getElementById('clienteAdultos').value = '2';
  document.getElementById('clienteCriancas').value = '0';`;

const replaceNovo = `  document.getElementById('clienteNome').value = '';
  document.getElementById('clienteAdultos').value = '2';
  document.getElementById('clienteCriancas').value = '0';
  
  ['clienteNome', 'clienteAdultos', 'clienteCriancas'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.readOnly = false; el.style = ''; }
  });`;

appJs = appJs.replace(targetNovo, replaceNovo);
fs.writeFileSync('public/js/app.js', appJs);

let rotJs = fs.readFileSync('public/js/roteiros.js', 'utf8');

const targetRot = `  document.getElementById('rotClienteNome').value = notionCli ? notionCli.nome : (roteiroEmEdicao.cliente?.nome || '');
  document.getElementById('rotClienteAdultos').value = notionCli ? notionCli.adultos : (roteiroEmEdicao.cliente?.adultos || '2');
  document.getElementById('rotClienteCriancas').value = notionCli ? notionCli.criancas : (roteiroEmEdicao.cliente?.criancas || '0');`;

const replaceRot = `  document.getElementById('rotClienteNome').value = notionCli ? notionCli.nome : (roteiroEmEdicao.cliente?.nome || '');
  document.getElementById('rotClienteAdultos').value = notionCli ? notionCli.adultos : (roteiroEmEdicao.cliente?.adultos || '2');
  document.getElementById('rotClienteCriancas').value = notionCli ? notionCli.criancas : (roteiroEmEdicao.cliente?.criancas || '0');
  
  const rotTemCliente = !!roteiroEmEdicao.notionClienteId;
  const rotLockedStyle = rotTemCliente ? 'background:#f1f5f9; cursor:not-allowed' : '';
  ['rotClienteNome', 'rotClienteAdultos', 'rotClienteCriancas'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.readOnly = rotTemCliente; el.style = rotLockedStyle; }
  });`;

rotJs = rotJs.replace(targetRot, replaceRot);

const targetNovoRot = `  document.getElementById('rotClienteNome').value = '';
  document.getElementById('rotClienteAdultos').value = '2';
  document.getElementById('rotClienteCriancas').value = '0';`;

const replaceNovoRot = `  document.getElementById('rotClienteNome').value = '';
  document.getElementById('rotClienteAdultos').value = '2';
  document.getElementById('rotClienteCriancas').value = '0';
  
  ['rotClienteNome', 'rotClienteAdultos', 'rotClienteCriancas'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.readOnly = false; el.style = ''; }
  });`;

rotJs = rotJs.replace(targetNovoRot, replaceNovoRot);
fs.writeFileSync('public/js/roteiros.js', rotJs);
