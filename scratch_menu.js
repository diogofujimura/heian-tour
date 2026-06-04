const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

const oldMenu = `<nav class="sidebar-nav">
    <a class="nav-item active" data-page="orcamento">◈ &nbsp;Nova Cotação</a>
    <a class="nav-item" data-page="meus">◧ &nbsp;Minhas Cotações</a>
    <a class="nav-item" data-page="roteiros">🗺️ &nbsp;Visualizador de Roteiros</a>
    <a class="nav-item" data-page="clientes">👥 &nbsp;Clientes (Notion)</a>
    <a class="nav-item" data-page="base">◇ &nbsp;Base de Dados</a>
    <a class="nav-item" data-page="config">◉ &nbsp;Configurações</a>
  </nav>`;

const newMenu = `<nav class="sidebar-nav">
    <div style="font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.1em; margin: 15px 0 5px 20px;">Gestão & Vendas</div>
    <a class="nav-item active" data-page="clientes">👥 &nbsp;Clientes</a>
    <a class="nav-item" data-page="roteiros">🗺️ &nbsp;Roteiros de Viagem</a>
    <a class="nav-item" data-page="meus">💰 &nbsp;Cotações</a>
    
    <div style="font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.1em; margin: 25px 0 5px 20px;">Sistema & Dados</div>
    <a class="nav-item" data-page="orcamento">◈ &nbsp;Criar Cotação Rápida</a>
    <a class="nav-item" data-page="base">◇ &nbsp;Base de Dados</a>
    <a class="nav-item" data-page="config">◉ &nbsp;Configurações</a>
  </nav>`;

html = html.replace(oldMenu, newMenu);

fs.writeFileSync('public/index.html', html);
console.log('Menu HTML updated');
