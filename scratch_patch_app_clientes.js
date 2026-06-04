const fs = require('fs');

let app = fs.readFileSync('public/js/app.js', 'utf8');

if (!app.includes('setupClientesTab()')) {
  // Inject setupClientesTab to INIT
  app = app.replace('setupNav();', 'setupNav();\n  setupClientesTab();');

  const clientesCode = `
// ── CLIENTES NOTION (TAB) ───────────────────────────────────────────────────
let currentEditingClienteId = null;

function setupClientesTab() {
  const btnRefresh = document.getElementById('btnRefreshClientes');
  const btnNovo = document.getElementById('btnNovoCliente');
  const btnSalvar = document.getElementById('btnSalvarClienteModal');
  
  if(btnRefresh) btnRefresh.addEventListener('click', loadClientesTabela);
  if(btnNovo) btnNovo.addEventListener('click', () => abrirClienteModal());
  if(btnSalvar) btnSalvar.addEventListener('click', salvarClienteNotion);

  // Load clients when clicking the menu item
  document.querySelector('.nav-item[data-page="clientes"]')?.addEventListener('click', () => {
    if (notionClients.length === 0) loadClientesTabela();
    else renderClientesTabela();
  });
}

async function loadClientesTabela() {
  const tbody = document.querySelector('#clientesTable tbody');
  if(tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Atualizando do Notion...</td></tr>';
  
  try {
    const res = await fetch('/api/notion/clientes');
    if (!res.ok) throw new Error('Erro na API');
    notionClients = await res.json();
    renderClientesTabela();
  } catch(e) {
    console.error(e);
    if(tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: red;">Erro ao carregar clientes do Notion.</td></tr>';
  }
}

function renderClientesTabela() {
  const tbody = document.querySelector('#clientesTable tbody');
  if(!tbody) return;
  
  if(notionClients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhum cliente encontrado.</td></tr>';
    return;
  }
  
  let html = '';
  notionClients.forEach(c => {
    const dates = (c.dataInicio || c.dataFim) ? \`\${c.dataInicio || '?'} até \${c.dataFim || '?'}\` : '-';
    html += \`
      <tr>
        <td><strong>\${c.nome || 'Sem Nome'}</strong><br><small>\${c.adultos} Ad / \${c.criancas} Cri</small></td>
        <td><span class="status-badge">\${c.status || 'Sem status'}</span></td>
        <td>\${dates}</td>
        <td>
          <button class="btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="editarClienteNotion('\${c.id}')">Editar</button>
        </td>
      </tr>
    \`;
  });
  tbody.innerHTML = html;
}

function abrirClienteModal(cliente = null) {
  document.getElementById('modalCliente').style.display = 'flex';
  if(cliente) {
    currentEditingClienteId = cliente.id;
    document.getElementById('modalClienteTitle').innerText = 'Editar Cliente';
    document.getElementById('mcNome').value = cliente.nome || '';
    document.getElementById('mcStatus').value = cliente.status || 'Início/call de dúvidas';
    document.getElementById('mcAdultos').value = cliente.adultos || 2;
    document.getElementById('mcCriancas').value = cliente.criancas || 0;
    document.getElementById('mcVooChegada').value = cliente.vooChegada || '';
    document.getElementById('mcVooPartida').value = cliente.vooPartida || '';
    document.getElementById('mcDataInicio').value = cliente.dataInicio || '';
    document.getElementById('mcDataFim').value = cliente.dataFim || '';
  } else {
    currentEditingClienteId = null;
    document.getElementById('modalClienteTitle').innerText = 'Novo Cliente';
    document.getElementById('mcNome').value = '';
    document.getElementById('mcStatus').value = 'Início/call de dúvidas';
    document.getElementById('mcAdultos').value = 2;
    document.getElementById('mcCriancas').value = 0;
    document.getElementById('mcVooChegada').value = '';
    document.getElementById('mcVooPartida').value = '';
    document.getElementById('mcDataInicio').value = '';
    document.getElementById('mcDataFim').value = '';
  }
}

window.closeClienteModal = function() {
  document.getElementById('modalCliente').style.display = 'none';
}

window.editarClienteNotion = function(id) {
  const c = notionClients.find(x => x.id === id);
  if(c) abrirClienteModal(c);
}

async function salvarClienteNotion() {
  const payload = {
    nome: document.getElementById('mcNome').value.trim(),
    status: document.getElementById('mcStatus').value,
    adultos: document.getElementById('mcAdultos').value,
    criancas: document.getElementById('mcCriancas').value,
    vooChegada: document.getElementById('mcVooChegada').value.trim(),
    vooPartida: document.getElementById('mcVooPartida').value.trim(),
    dataInicio: document.getElementById('mcDataInicio').value,
    dataFim: document.getElementById('mcDataFim').value
  };
  
  if(!payload.nome) return alert('Nome é obrigatório');
  
  const btn = document.getElementById('btnSalvarClienteModal');
  btn.innerText = 'Salvando no Notion...';
  btn.disabled = true;
  
  try {
    const url = currentEditingClienteId ? \`/api/notion/clientes/\${currentEditingClienteId}\` : '/api/notion/clientes';
    const method = currentEditingClienteId ? 'PATCH' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if(!res.ok) throw new Error('Falha ao comunicar com Notion API');
    
    closeClienteModal();
    await loadClientesTabela(); // Recarrega a lista
    alert('Cliente salvo no Notion com sucesso!');
  } catch(e) {
    console.error(e);
    alert('Erro ao salvar no Notion: ' + e.message);
  } finally {
    btn.innerText = 'Salvar no Notion';
    btn.disabled = false;
  }
}
`;

  app += clientesCode;
  fs.writeFileSync('public/js/app.js', app);
  console.log('Fixed app.js: added setupClientesTab');
} else {
  console.log('Already had setupClientesTab');
}
