const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Rewrite page-meus to be a 3-pane layout
const targetMeus = `<div id="page-meus" class="page">
    <div class="page-header">
      <h1>Minhas Cotações</h1>
      <button class="btn-primary" id="btnNovoOrc">+ Nova Cotação</button>
    </div>
    <div id="orcamentosLista"></div>
  </div>`;

const replaceMeus = `<div id="page-meus" class="page pane-layout">
    <div class="pane-list">
      <div class="pane-list-header">
        <h2 style="font-family: var(--ff-display); font-size: 26px; font-weight: 400; color: var(--crimson);">Cotações</h2>
        <div style="display:flex; gap:8px">
          <input type="text" id="pesquisaOrcamentosList" class="search-input-modern" placeholder="Pesquisar cotação..." onkeyup="filterOrcamentosList()">
          <button class="btn-primary" id="btnNovoOrcList" style="padding: 10px 14px; border-radius:8px;" title="Nova Cotação">+</button>
        </div>
      </div>
      <div class="pane-list-content" id="orcamentosLista"></div>
    </div>
    
    <div class="pane-content" id="orcamentosContent">
      <!-- Container que segura ou o Preview ou o Editor -->
      <div class="pane-content-inner" id="orcamentosContentInner" style="display:flex; flex-direction:column; padding:0; min-height: 90vh;">
        
        <!-- Estado Vazio -->
        <div id="orcamentosEmptyState" style="text-align:center; padding: 120px 20px; opacity:0.6;">
           <img src="assets/logo.png" style="width: 80px; opacity:0.2; margin-bottom: 20px; filter: grayscale(1);">
           <p style="font-size:18px; font-family: var(--ff-display);">Selecione uma cotação na lista lateral<br>ou crie uma nova.</p>
        </div>

        <!-- Area de Preview -->
        <div id="orcamentosPreviewWrapper" style="display:none; width: 100%; padding: 40px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px; border-bottom:1px solid var(--border); padding-bottom:20px;">
                <h3 id="orcamentosPreviewTitle" style="font-family: var(--ff-display); font-size: 24px; color: var(--crimson);">Pré-visualização</h3>
                <div style="display:flex; gap: 10px;">
                    <button id="btnEditFromPreview2" class="btn-primary" onclick="editarCotacaoAtual()">✏️ Editar Cotação</button>
                    <button class="btn-secondary" onclick="document.getElementById('btnPrintFromPreview').click()">🖨 PDF</button>
                </div>
            </div>
            <div id="previewContainerInline" style="max-width:800px; margin:0 auto;"></div>
        </div>
        
        <!-- O Formulário de Edição virá para cá via JS -->
        <div id="orcamentosEditorWrapper" style="display:none; width: 100%;"></div>

      </div>
    </div>
  </div>`;

html = html.replace(targetMeus, replaceMeus);

// 2. Remove page-header from page-orcamento, since it will be inside the pane-content now.
// We will also remove the "page" class from page-orcamento so it doesn't mess with nav.
const targetOrcamentoPage = `<div id="page-orcamento" class="page">`;
const replaceOrcamentoPage = `<div id="page-orcamento" class="orcamento-editor-container" style="padding: 40px;">`;
html = html.replace(targetOrcamentoPage, replaceOrcamentoPage);

// 3. Update Sidebar links to point to 'meus' instead of 'orcamento'
const targetSidebarLink = `<div class="nav-item" onclick="navToPage('orcamento')">✏️ Criar Cotação Rápida</div>`;
const replaceSidebarLink = `<div class="nav-item" onclick="navToPage('meus'); document.getElementById('btnNovoOrcList').click();">✏️ Criar Cotação Rápida</div>`;
html = html.replace(targetSidebarLink, replaceSidebarLink);

fs.writeFileSync('public/index.html', html);
console.log("index.html modificado para Cotações 3-pane");
