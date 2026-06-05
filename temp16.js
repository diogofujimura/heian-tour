const fs = require('fs');

// --- 1. INDEX.HTML ---
let html = fs.readFileSync('public/index.html', 'utf8');

const targetClientes = `<div id="page-clientes" class="page">
    <div class="page-header">
      <h1>Clientes Sincronizados (Notion)</h1>
      <button class="btn-primary" onclick="sincronizarNotion()">↻ Sincronizar Agora</button>
    </div>
    <div class="table-container">
      <table id="tabelaClientes" class="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Email</th>
            <th>Data da Viagem</th>
            <th>Status</th>
            <th>Cotações Associadas</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  </div>`;

const replaceClientes = `<div id="page-clientes" class="page pane-layout">
    <div class="pane-list">
      <div class="pane-list-header">
        <h2 style="font-family: var(--ff-display); font-size: 26px; font-weight: 400; color: var(--crimson);">Clientes</h2>
        <div style="display:flex; gap:8px">
          <input type="text" id="pesquisaClientesList" class="search-input-modern" placeholder="Pesquisar cliente..." onkeyup="renderTabelaClientes(this.value)">
          <button class="btn-secondary" onclick="sincronizarNotion()" style="padding: 10px; border-radius:8px;" title="Sincronizar Notion">↻</button>
        </div>
      </div>
      <div class="pane-list-content" id="tabelaClientesList"></div>
    </div>
    
    <div class="pane-content" id="clientesPaneContent">
      <div class="pane-content-inner" id="clientesContentInner" style="display:flex; flex-direction:column; padding:0; min-height: 90vh;">
        
        <div id="clientesEmptyState" style="text-align:center; padding: 120px 20px; opacity:0.6;">
           <img src="assets/logo.png" style="width: 80px; opacity:0.2; margin-bottom: 20px; filter: grayscale(1);">
           <p style="font-size:18px; font-family: var(--ff-display);">Selecione um cliente na lista lateral para ver os detalhes.</p>
        </div>

        <div id="clientesDetailWrapper" style="display:none; width: 100%; padding: 40px;">
           <div id="modalClienteContentInline"></div>
        </div>
      </div>
    </div>
  </div>`;

if (html.includes(targetClientes)) {
  html = html.replace(targetClientes, replaceClientes);
}

fs.writeFileSync('public/index.html', html);


// --- 2. APP.JS ---
let js = fs.readFileSync('public/js/app.js', 'utf8');

// A. Modify renderTabelaClientes to output Cards instead of TRs
const targetRenderTabela = `function renderTabelaClientes(filtro = '') {
  if (typeof notionClients === 'undefined') return;
  const tbody = document.querySelector('#tabelaClientes tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const q = filtro.toLowerCase();
  const cotsMap = state.orcamentosDB.reduce((map, o)=>{
    if (o.notionClienteId) {
       if(!map[o.notionClienteId]) map[o.notionClienteId]=[];
       map[o.notionClienteId].push(o);
    }
    return map;
  }, {});

  notionClients.filter(c => c.nome.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)).forEach(c => {
    const tr = document.createElement('tr');
    const cots = cotsMap[c.id] || [];
    let cotsHtml = cots.length === 0 ? '<span style="color:#999;font-size:12px">Nenhuma</span>' : cots.map(o=>\`<span style="display:inline-block;background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:11px;margin:2px">\${o.nome}</span>\`).join('');
    let statusClass = 'status-badge';
    if(c.status === 'Fechado') statusClass += ' status-fechado';
    else if(c.status === 'Cancelado') statusClass += ' status-cancelado';
    else statusClass += ' status-aberto';

    tr.innerHTML = \`
      <td style="font-weight:500;color:var(--crimson)">\${c.nome}</td>
      <td style="color:#666">\${c.email || '-'}</td>
      <td>\${c.dataViagem ? fmtDataBR(c.dataViagem) : '-'}</td>
      <td><span class="\${statusClass}">\${c.status || 'Novo'}</span></td>
      <td>\${cotsHtml}</td>
      <td>
        <button class="btn-icon" onclick="abrirDetalhesCliente('\${c.id}')" title="Ver Detalhes">🔍 Detalhes</button>
      </td>
    \`;
    tbody.appendChild(tr);
  });
}`;

const replaceRenderTabela = `function renderTabelaClientes(filtro = '') {
  if (typeof notionClients === 'undefined') return;
  const listContainer = document.getElementById('tabelaClientesList');
  if (!listContainer) return;
  listContainer.innerHTML = '';
  
  const q = filtro.toLowerCase();
  
  notionClients.filter(c => c.nome.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)).forEach(c => {
    let statusColor = '#9c8248'; // aberto
    if(c.status === 'Fechado') statusColor = '#6B1F2A';
    else if(c.status === 'Cancelado') statusColor = '#806A6D';
    
    // selected state se o clienteAtual for esse
    const isSelected = window.clienteAtualVisualizado === c.id ? 'selected' : '';

    const card = document.createElement('div');
    card.className = 'list-card ' + isSelected;
    card.onclick = () => abrirDetalhesCliente(c.id);
    card.onmouseenter = () => hoverCliente(c.id);
    
    card.innerHTML = \`
      <div class="list-card-title" style="color:var(--crimson)">\${c.nome}</div>
      <div class="list-card-subtitle">\${c.email || 'Sem email'}</div>
      <div class="list-card-meta">
        <span>\${c.dataViagem ? fmtDataBR(c.dataViagem) : '-'}</span>
        <span style="color:\${statusColor}; font-weight:600;">\${c.status || 'Novo'}</span>
      </div>
    \`;
    listContainer.appendChild(card);
  });
}`;

if (js.includes('function renderTabelaClientes')) {
  // Use regex or string replace to replace the whole function
  js = js.replace(targetRenderTabela, replaceRenderTabela);
}

// B. Hover function
const hoverFn = `\nwindow.hoverCliente = function(id) {
  if (window.clienteAtualVisualizado === id) return;
  abrirDetalhesCliente(id, true);
};\n`;
if (!js.includes('window.hoverCliente')) {
  js += hoverFn;
}

// C. Modify abrirDetalhesCliente
const targetAbrirDetalhes = `function abrirDetalhesCliente(id) {
  const c = notionClients.find(x => x.id === id);
  if (!c) return;
  document.getElementById('modalClienteTitulo').textContent = c.nome;`;

const replaceAbrirDetalhes = `function abrirDetalhesCliente(id, isHover = false) {
  const c = notionClients.find(x => x.id === id);
  if (!c) return;
  window.clienteAtualVisualizado = id;
  
  // Atualizar visual selection da lista
  if (!isHover) {
     renderTabelaClientes(document.getElementById('pesquisaClientesList').value);
  }
  
  document.getElementById('clientesEmptyState').style.display = 'none';
  document.getElementById('clientesDetailWrapper').style.display = 'block';
  `;
js = js.replace(targetAbrirDetalhes, replaceAbrirDetalhes);

const targetRenderModalContent = `document.getElementById('modalClienteContent').innerHTML = html;
  document.getElementById('modalOverlay').style.display = 'block';
  document.getElementById('modalCliente').style.display = 'block';`;

const replaceRenderModalContent = `const inlineContainer = document.getElementById('modalClienteContentInline');
  if (inlineContainer) {
    inlineContainer.innerHTML = html;
  } else {
    document.getElementById('modalClienteContent').innerHTML = html;
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('modalCliente').style.display = 'block';
  }`;
js = js.replace(targetRenderModalContent, replaceRenderModalContent);

fs.writeFileSync('public/js/app.js', js);
console.log("Modificações do Clientes 3-pane aplicadas.");
