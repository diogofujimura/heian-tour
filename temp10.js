const fs = require('fs');

// --- 1. ROTEIROS.JS ---
let roteirosJs = fs.readFileSync('public/js/roteiros.js', 'utf8');

const targetRot = `  if (!notionId && typeof state !== 'undefined' && state && state.orcamento && state.orcamento.orcRoteiroVinculado === nome) {
    notionId = state.orcamento.notionClienteId;
  }
  if (!notionId && nome === 'Novo Roteiro' && typeof currentEditingClienteId !== 'undefined' && currentEditingClienteId) {
    notionId = currentEditingClienteId;
  }`;

const replaceRot = `  if (!notionId && typeof state !== 'undefined' && state && state.orcamento && state.orcamento.orcRoteiroVinculado === nome) {
    notionId = state.orcamento.notionClienteId;
  }`;

roteirosJs = roteirosJs.replace(targetRot, replaceRot);

// Ensure the button resets to 'Salvar Cliente no Notion' when starting a new roteiro
const targetRotBtn = `  const rotLockedStyle = rotTemCliente ? 'background:#f1f5f9; cursor:not-allowed' : '';
  ['rotClienteNome', 'rotClienteAdultos', 'rotClienteCriancas'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.readOnly = rotTemCliente; el.style = rotLockedStyle; }
  });`;

const replaceRotBtn = `  const rotLockedStyle = rotTemCliente ? 'background:#f1f5f9; cursor:not-allowed' : '';
  ['rotClienteNome', 'rotClienteAdultos', 'rotClienteCriancas'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.readOnly = rotTemCliente; el.style = rotLockedStyle; }
  });
  const btnEditarRot = document.getElementById('btnEditarClienteRoteiro');
  if(btnEditarRot) btnEditarRot.innerHTML = rotTemCliente ? '👤 Editar Cliente' : '💾 Salvar Cliente no Notion';`;

roteirosJs = roteirosJs.replace(targetRotBtn, replaceRotBtn);

fs.writeFileSync('public/js/roteiros.js', roteirosJs);


// --- 2. APP.JS ---
let appJs = fs.readFileSync('public/js/app.js', 'utf8');

const targetApp = `  ['clienteNome', 'clienteAdultos', 'clienteCriancas'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.readOnly = false; el.style = ''; }
  });
  document.getElementById('clienteDataOrcamento').value = today();`;

const replaceApp = `  ['clienteNome', 'clienteAdultos', 'clienteCriancas'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.readOnly = false; el.style = ''; }
  });
  document.getElementById('clienteDataOrcamento').value = today();
  const btnEditarCot = document.getElementById('btnEditarClienteCotacao');
  if(btnEditarCot) btnEditarCot.innerHTML = '💾 Salvar Cliente no Notion';`;

appJs = appJs.replace(targetApp, replaceApp);

fs.writeFileSync('public/js/app.js', appJs);

console.log("Feito!");
