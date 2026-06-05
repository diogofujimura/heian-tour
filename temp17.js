const fs = require('fs');

// --- 1. INDEX.HTML ---
let html = fs.readFileSync('public/index.html', 'utf8');

const targetRoteiros = `<div id="page-roteiros" class="page">
    <div class="page-header">
      <h1>Modelos de Roteiros</h1>
      <div class="header-actions">
        <label for="selectRoteiroBase" style="display:none">Pesquisar ou Selecionar Roteiro:</label>
        <input list="listaRoteiros" id="selectRoteiroBase" class="search-input" placeholder="Pesquisar roteiro salvo...">
        <datalist id="listaRoteiros"></datalist>
        <button id="btnNovoRoteiro" class="btn-secondary">+ Novo Roteiro</button>
        <label style="font-size:12px; margin-right:10px; display:inline-flex; align-items:center; cursor:pointer; color:var(--text-sec)">
          <input type="checkbox" id="chkIncluirDescricoesPdf" style="margin-right:6px; accent-color:var(--crimson)">
          Incluir descrições no PDF
        </label>
        <button id="btnGerarRoteiro" class="btn-primary" disabled="">Exportar/Visualizar</button>
      </div>
    </div>
    
    <div class="roteiro-container">
      <!-- Layout Principal: Timeline + Atrações Rápidas -->
      <div id="roteiroPreviewHeader" style="display:none; margin-bottom: 20px; padding: 15px; background: #fffcf0; border: 1px solid #fde68a; border-radius: 8px; align-items: center; justify-content: space-between;">
        <div style="display:flex; align-items:center; gap: 15px;">
           <h2 id="roteiroPreviewTitle" style="margin:0; color: var(--gold-dk); font-size: 20px;"></h2>
           <button id="btnEditarRoteiro" class="btn-primary" style="padding: 6px 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">✏️ Editar Roteiro</button>
           <button id="btnExcluirRoteiro" class="btn-secondary" style="color:#e06666; border-color:rgba(224,102,102,0.3); padding: 5px 12px; font-size:12px;">✖ Excluir Roteiro</button>
        </div>
      </div>
      <div class="roteiro-timeline" id="roteiroTimeline">`;

const replaceRoteiros = `<div id="page-roteiros" class="page pane-layout">
    <div class="pane-list">
      <div class="pane-list-header">
        <h2 style="font-family: var(--ff-display); font-size: 26px; font-weight: 400; color: var(--crimson);">Roteiros</h2>
        <div style="display:flex; gap:8px">
          <input type="text" id="pesquisaRoteirosList" class="search-input-modern" placeholder="Pesquisar roteiro..." onkeyup="filterRoteirosList()">
          <button class="btn-primary" id="btnNovoRoteiroList" style="padding: 10px 14px; border-radius:8px;" title="Novo Roteiro">+</button>
        </div>
      </div>
      <div class="pane-list-content" id="roteirosLista"></div>
    </div>

    <div class="pane-content" id="roteirosPaneContent">
      <div class="pane-content-inner" id="roteirosContentInner" style="display:flex; flex-direction:column; padding:0; min-height: 90vh;">
        
        <div id="roteirosEmptyState" style="text-align:center; padding: 120px 20px; opacity:0.6;">
           <img src="assets/logo.png" style="width: 80px; opacity:0.2; margin-bottom: 20px; filter: grayscale(1);">
           <p style="font-size:18px; font-family: var(--ff-display);">Selecione um roteiro na lista lateral<br>ou crie um novo.</p>
        </div>

        <div id="roteirosDetailWrapper" style="display:none; width: 100%; padding: 40px;">
          <div style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:20px; padding-bottom:10px; border-bottom:1px solid rgba(0,0,0,0.1)">
             <div style="display:flex; gap: 15px; align-items:center;">
               <label style="font-size:13px; margin-right:10px; display:inline-flex; align-items:center; cursor:pointer; color:var(--ink-lt)">
                 <input type="checkbox" id="chkIncluirDescricoesPdf" style="margin-right:6px; accent-color:var(--crimson)">
                 Incluir descrições no PDF
               </label>
               <button id="btnGerarRoteiro" class="btn-secondary" style="font-size:13px;" disabled="">🖨 PDF</button>
             </div>
          </div>
          
          <div class="roteiro-container" style="display:block;">
            <div id="roteiroPreviewHeader" style="display:none; margin-bottom: 20px; align-items: center; justify-content: space-between;">
              <div style="display:flex; align-items:center; gap: 15px;">
                 <h2 id="roteiroPreviewTitle" style="margin:0; color: var(--gold-dk); font-size: 24px;"></h2>
                 <button id="btnEditarRoteiro" class="btn-primary" style="padding: 6px 16px;">✏️ Editar Roteiro</button>
                 <button id="btnExcluirRoteiro" class="btn-secondary" style="color:#e06666; border-color:rgba(224,102,102,0.3); padding: 5px 12px; font-size:12px;">✖ Excluir Roteiro</button>
              </div>
            </div>
            <div class="roteiro-timeline" id="roteiroTimeline">`;

html = html.replace(targetRoteiros, replaceRoteiros);
fs.writeFileSync('public/index.html', html);


// --- 2. ROTEIROS.JS ---
let js = fs.readFileSync('public/js/roteiros.js', 'utf8');

// The select logic is in the 'load' and 'carregarSelectRoteiros' functions.
// We will replace carregarSelectRoteiros with renderListaRoteiros.
const targetSelect = `function carregarSelectRoteiros() {
  const datalist = document.getElementById('listaRoteiros');
  if(!datalist) return;
  datalist.innerHTML = '';
  
  Object.keys(dbRotas).sort().forEach(nome => {
    const opt = document.createElement('option');
    opt.value = nome;
    datalist.appendChild(opt);
  });
}`;

const replaceSelect = `function renderListaRoteiros(filtro = '') {
  const listContainer = document.getElementById('roteirosLista');
  if(!listContainer) return;
  listContainer.innerHTML = '';
  const q = filtro.toLowerCase();
  
  Object.keys(dbRotas).sort().forEach(nome => {
    if (!nome.toLowerCase().includes(q)) return;
    
    const r = dbRotas[nome];
    const isSelected = window.roteiroAtualVisualizado === nome ? 'selected' : '';
    const numDias = r.dias ? r.dias.length : 0;
    
    const card = document.createElement('div');
    card.className = 'list-card ' + isSelected;
    card.onclick = () => selecionarRoteiro(nome);
    card.onmouseenter = () => { if(window.roteiroAtualVisualizado !== nome) selecionarRoteiro(nome, true); };
    
    card.innerHTML = \`
      <div class="list-card-title" style="color:var(--crimson)">\${nome}</div>
      <div class="list-card-subtitle">\${numDias} dia(s) de roteiro</div>
      <div class="list-card-meta">
        <span>\${r.cliente?.notionClienteId ? 'Vinc. Cliente' : ''}</span>
      </div>
    \`;
    listContainer.appendChild(card);
  });
}`;
js = js.replace(targetSelect, replaceSelect);

const targetSelectEvent = `  const sel = document.getElementById('selectRoteiroBase');
  if(sel) {
    sel.addEventListener('change', (e) => {
      const roteiro = e.target.value;
      if (roteiro && dbRotas[roteiro]) {
        document.getElementById('roteiroPreviewHeader').style.display = 'flex';
        document.getElementById('roteiroPreviewTitle').textContent = roteiro;
        renderizarRoteiro(roteiro);
      } else {
        document.getElementById('roteiroDiasContainer').innerHTML = '<p style="color:#666; font-style:italic">Selecione um roteiro base acima para visualizar os dias.</p>';
        document.getElementById('roteiroPreviewHeader').style.display = 'none';
      }
    });
  }`;

const replaceSelectEvent = `  const btnNovo = document.getElementById('btnNovoRoteiroList');
  if(btnNovo) {
    btnNovo.addEventListener('click', () => {
      window.roteiroAtualVisualizado = null;
      renderListaRoteiros(document.getElementById('pesquisaRoteirosList').value);
      document.getElementById('roteirosEmptyState').style.display = 'none';
      document.getElementById('roteirosDetailWrapper').style.display = 'block';
      novoRoteiro();
    });
  }`;
js = js.replace(targetSelectEvent, replaceSelectEvent);

// Add selecionarRoteiro
const selectFn = `\nwindow.selecionarRoteiro = function(nome, isHover = false) {
  if (document.getElementById('roteiroEditContainer').style.display === 'block') {
    if (isHover) return; // Não troca no hover se estiver no modo edição
  }
  
  if (nome && dbRotas[nome]) {
    window.roteiroAtualVisualizado = nome;
    if(!isHover) renderListaRoteiros(document.getElementById('pesquisaRoteirosList').value);
    
    document.getElementById('roteirosEmptyState').style.display = 'none';
    document.getElementById('roteirosDetailWrapper').style.display = 'block';
    
    // Mostra o preview
    document.getElementById('roteiroEditContainer').style.display = 'none';
    document.getElementById('roteiroTimeline').style.display = 'block';
    document.getElementById('roteiroPreviewHeader').style.display = 'flex';
    document.getElementById('roteiroPreviewTitle').textContent = nome;
    
    renderizarRoteiro(nome);
  }
};\n

window.filterRoteirosList = function() {
  const q = document.getElementById('pesquisaRoteirosList').value;
  renderListaRoteiros(q);
};
`;
js += selectFn;

// Fix references to 'carregarSelectRoteiros'
js = js.replace(/carregarSelectRoteiros\(\)/g, 'renderListaRoteiros()');

// Replace references to 'selectRoteiroBase' value with 'window.roteiroAtualVisualizado'
js = js.replace(/document.getElementById\('selectRoteiroBase'\)\.value/g, 'window.roteiroAtualVisualizado');

fs.writeFileSync('public/js/roteiros.js', js);
console.log("Modificações do Roteiros 3-pane aplicadas.");
