const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

// Adiciona o item no menu
if (!html.includes('data-page="clientes"')) {
  html = html.replace(
    '<a class="nav-item" data-page="base">◇ &nbsp;Base de Dados</a>',
    '<a class="nav-item" data-page="clientes">👥 &nbsp;Clientes (Notion)</a>\n    <a class="nav-item" data-page="base">◇ &nbsp;Base de Dados</a>'
  );
}

// Adiciona a página de Clientes
const clientesPage = `
  <!-- ── CLIENTES NOTION ────────────────────────────────────────────────── -->
  <div id="page-clientes" class="page">
    <div class="page-header">
      <h1 class="page-title">Clientes (CRM Notion)</h1>
      <div class="header-actions">
        <button id="btnRefreshClientes" class="btn-secondary">↻ Atualizar do Notion</button>
        <button id="btnNovoCliente" class="btn-primary">+ Novo Cliente</button>
      </div>
    </div>
    
    <div class="card" style="padding: 0;">
      <table class="data-table" id="clientesTable" style="margin-top: 0;">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Status</th>
            <th>Viagem</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr><td colspan="4" style="text-align: center; padding: 20px;">Carregando...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Modal Cliente -->
  <div id="modalCliente" class="modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h2 id="modalClienteTitle">Novo Cliente</h2>
        <button class="btn-close" onclick="closeClienteModal()">×</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Nome</label><input type="text" id="mcNome"></div>
        <div class="field"><label>Status</label>
          <select id="mcStatus">
            <option value="Início/call de dúvidas">Início/call de dúvidas</option>
            <option value="Roteiro Rascunho">Roteiro Rascunho</option>
            <option value="Roteiro versão final">Roteiro versão final</option>
            <option value="Negociação Aprovada">Negociação Aprovada</option>
            <option value="Finalizados">Finalizados</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>
        <div class="field"><label>Adultos</label><input type="number" id="mcAdultos" value="2" min="1"></div>
        <div class="field"><label>Crianças</label><input type="number" id="mcCriancas" value="0" min="0"></div>
        <div class="field"><label>Voo Chegada (Info)</label><input type="text" id="mcVooChegada"></div>
        <div class="field"><label>Voo Partida (Info)</label><input type="text" id="mcVooPartida"></div>
        <div class="field"><label>Data Início</label><input type="date" id="mcDataInicio"></div>
        <div class="field"><label>Data Fim</label><input type="date" id="mcDataFim"></div>
      </div>
      <div class="modal-actions" style="margin-top: 15px; display: flex; justify-content: flex-end; gap: 10px;">
        <button class="btn-secondary" onclick="closeClienteModal()">Cancelar</button>
        <button class="btn-primary" id="btnSalvarClienteModal">Salvar no Notion</button>
      </div>
    </div>
  </div>
`;

if (!html.includes('id="page-clientes"')) {
  // Insere a página logo antes de page-base
  html = html.replace('  <!-- ── BASE DE DADOS ──────────────────────────────────────────────────── -->', clientesPage + '\n  <!-- ── BASE DE DADOS ──────────────────────────────────────────────────── -->');
  fs.writeFileSync('public/index.html', html);
  console.log('patched index.html');
} else {
  console.log('already patched index.html');
}
