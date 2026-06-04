const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

const oldHtml = `    <div class="card" style="padding: 0;">
      <table class="data-table" id="clientesTable" style="margin-top: 0;">`;

const newHtml = `    <div class="card" style="padding: 0;">
      <div style="display: flex; gap: 10px; padding: 15px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; align-items: center; border-radius: 8px 8px 0 0;">
        <input type="text" id="filtroClienteNome" placeholder="🔍 Buscar cliente por nome..." style="flex: 1; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; outline: none;" onkeyup="renderClientesTabela()">
        <select id="filtroClienteStatus" style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; outline: none; min-width: 180px;" onchange="renderClientesTabela()">
          <option value="">Filtrar por Status (Todos)</option>
          <option value="Início/call de dúvidas">Início/call de dúvidas</option>
          <option value="Roteiro Rascunho">Roteiro Rascunho</option>
          <option value="Roteiro versão final">Roteiro versão final</option>
          <option value="Negociação Aprovada">Negociação Aprovada</option>
          <option value="Finalizados">Finalizados</option>
          <option value="Cancelado">Cancelado</option>
        </select>
      </div>
      <table class="data-table" id="clientesTable" style="margin-top: 0;">`;

html = html.replace(oldHtml, newHtml);
fs.writeFileSync('public/index.html', html);


let app = fs.readFileSync('public/js/app.js', 'utf8');

const oldApp = `function renderClientesTabela() {
  const tbody = document.querySelector('#clientesTable tbody');
  if(!tbody) return;
  
  if(notionClients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhum cliente encontrado.</td></tr>';
    return;
  }
  
  let html = '';
  notionClients.forEach(c => {`;

const newApp = `function renderClientesTabela() {
  const tbody = document.querySelector('#clientesTable tbody');
  if(!tbody) return;
  
  const termoNome = (document.getElementById('filtroClienteNome')?.value || '').toLowerCase();
  const termoStatus = document.getElementById('filtroClienteStatus')?.value || '';
  
  const clientesFiltrados = notionClients.filter(c => {
    const matchNome = (c.nome || '').toLowerCase().includes(termoNome);
    const matchStatus = termoStatus === '' || c.status === termoStatus;
    return matchNome && matchStatus;
  });

  if(clientesFiltrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhum cliente encontrado com estes filtros.</td></tr>';
    return;
  }
  
  let html = '';
  clientesFiltrados.forEach(c => {`;

app = app.replace(oldApp, newApp);
fs.writeFileSync('public/js/app.js', app);

console.log('Filters added to Clientes page');
