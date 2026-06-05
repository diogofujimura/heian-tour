const fs = require('fs');

let js = fs.readFileSync('public/js/app.js', 'utf8');

const targetRenderClientesTabelaRegex = /function renderClientesTabela\(\) \{[\s\S]*?(?=function abrirClienteModal)/;

const replaceRenderClientesTabela = `function renderClientesTabela() {
  const listContainer = document.getElementById('tabelaClientesList');
  if(!listContainer) return;
  
  const termoNome = (document.getElementById('pesquisaClientesList')?.value || '').toLowerCase();
  
  const clientesFiltrados = notionClients.filter(c => {
    const matchNome = (c.nome || '').toLowerCase().includes(termoNome) || (c.email || '').toLowerCase().includes(termoNome);
    return matchNome;
  });

  listContainer.innerHTML = '';

  if(clientesFiltrados.length === 0) {
    listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color:#999;">Nenhum cliente encontrado.</div>';
    return;
  }
  
  clientesFiltrados.forEach(c => {
    let statusColor = '#9c8248'; // aberto
    if(c.status === 'Fechado') statusColor = '#6B1F2A';
    else if(c.status === 'Cancelado') statusColor = '#806A6D';
    
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
}
`;

if (js.match(targetRenderClientesTabelaRegex)) {
  js = js.replace(targetRenderClientesTabelaRegex, replaceRenderClientesTabela);
  fs.writeFileSync('public/js/app.js', js);
  console.log('renderClientesTabela substituido!');
} else {
  console.log('Não achei renderClientesTabela');
}
