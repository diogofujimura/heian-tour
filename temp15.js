const fs = require('fs');
let js = fs.readFileSync('public/js/app.js', 'utf8');

// 1. Move page-orcamento to orcamentosEditorWrapper on load
// Currently we have init(). We can just append it inside init().
const targetInit = `function init() {`;
const replaceInit = `function init() {
  // Mover o editor de cotações para dentro do novo layout 3-pane
  const editor = document.getElementById('page-orcamento');
  const wrapper = document.getElementById('orcamentosEditorWrapper');
  if (editor && wrapper) {
     wrapper.appendChild(editor);
  }`;
js = js.replace(targetInit, replaceInit);

// 2. Modify renderListaOrcamentos to use list-cards
const targetRenderLista = `    return \`<div class="orc-card">
      <div class="orc-info" onclick="abrirOrcamento(\${orc.id})" style="flex:1;cursor:pointer">
        <div class="orc-nome">\${orc.nome||'Sem nome'}</div>
        <div class="orc-meta">\${orc.cliente?.nome||''} \${txtPessoas?'· '+txtPessoas:''} · \${fmtDate(orc.atualizadoEm)}</div>
      </div>
      <div class="orc-total" onclick="abrirOrcamento(\${orc.id})" style="margin:0 24px;cursor:pointer">¥\${fmt(total)}</div>
      <div class="orc-actions">
        <button class="btn-icon" onclick="abrirOrcamento(\${orc.id})">✎ Abrir</button>
        <button class="btn-danger" onclick="excluirOrcamento(\${orc.id})">✕</button>
      </div>
    </div>\`;`;

const replaceRenderLista = `    
    const isSelected = state.orcamento && state.orcamento.id === orc.id ? 'selected' : '';
    return \`<div class="list-card \${isSelected}" 
                 onclick="abrirOrcamento(\${orc.id}, false)" 
                 onmouseenter="previewOrcamento(\${orc.id})">
      <div class="list-card-title">\${orc.nome||'Sem nome'}</div>
      <div class="list-card-subtitle">\${orc.cliente?.nome||''} \${txtPessoas?'· '+txtPessoas:''}</div>
      <div class="list-card-meta">
        <span>\${fmtDate(orc.atualizadoEm)}</span>
        <span>¥\${fmt(total)}</span>
      </div>
    </div>\`;`;
js = js.replace(targetRenderLista, replaceRenderLista);

// 3. Update abrirOrcamento to show/hide wrappers
const targetAbrirOrcamentoEnd = `updateResumo();
  if (directEdit) {
    navToPage('orcamento');
  } else {
    renderPreview();
  }`;

const replaceAbrirOrcamentoEnd = `updateResumo();
  document.getElementById('orcamentosEmptyState').style.display = 'none';
  
  if (directEdit) {
    document.getElementById('orcamentosPreviewWrapper').style.display = 'none';
    document.getElementById('orcamentosEditorWrapper').style.display = 'block';
  } else {
    document.getElementById('orcamentosEditorWrapper').style.display = 'none';
    document.getElementById('orcamentosPreviewWrapper').style.display = 'block';
    renderPreview();
  }
  
  // Atualiza visual selection na lista
  renderListaOrcamentos();`;
js = js.replace(targetAbrirOrcamentoEnd, replaceAbrirOrcamentoEnd);

// 4. Update renderPreview to use previewContainerInline
const targetPreviewContainer = `document.getElementById('previewContainer').innerHTML = html;
  document.getElementById('previewOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';`;
  
const replacePreviewContainer = `const pContainer = document.getElementById('previewContainerInline');
  if (pContainer) {
    pContainer.innerHTML = html;
  } else {
    // Fallback if not on page-meus
    document.getElementById('previewContainer').innerHTML = html;
    document.getElementById('previewOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }`;
js = js.replace(targetPreviewContainer, replacePreviewContainer);

// 5. Novo Orcamento button logic
const targetNovoBtn1 = `document.getElementById('btnNovoOrc').addEventListener('click', () => {
    history.pushState({ page: 'orcamento' }, '', '#orcamento');
    novoOrcamento();
    navToPage('orcamento');
  });`;
  
// We changed id to btnNovoOrcList
const replaceNovoBtn1 = `const btnNovoOrcList = document.getElementById('btnNovoOrcList');
  if (btnNovoOrcList) {
    btnNovoOrcList.addEventListener('click', () => {
      novoOrcamento();
      document.getElementById('orcamentosEmptyState').style.display = 'none';
      document.getElementById('orcamentosPreviewWrapper').style.display = 'none';
      document.getElementById('orcamentosEditorWrapper').style.display = 'block';
      renderListaOrcamentos();
    });
  }`;
js = js.replace(targetNovoBtn1, replaceNovoBtn1);

// Add previewOrcamento function for hover
const hoverFn = `\nwindow.previewOrcamento = function(id) {
  // Só atualiza o preview se estivermos vendo um preview, nao se estivermos editando!
  if (document.getElementById('orcamentosEditorWrapper').style.display === 'block') {
    return;
  }
  // Se ja esta selecionado, nao faz nada
  if (state.orcamento && state.orcamento.id === id) return;
  
  // Carrega e renderiza o preview sutilmente
  const orc = state.orcamentosDB.find(o => o.id === id);
  if (!orc) return;
  state.orcamento = JSON.parse(JSON.stringify(orc));
  
  document.getElementById('orcamentosEmptyState').style.display = 'none';
  document.getElementById('orcamentosEditorWrapper').style.display = 'none';
  document.getElementById('orcamentosPreviewWrapper').style.display = 'block';
  
  renderPreview();
  renderListaOrcamentos(); // update highlight
};\n`;
js += hoverFn;

// Add filterOrcamentosList
const filterFn = `\nwindow.filterOrcamentosList = function() {
  const q = document.getElementById('pesquisaOrcamentosList').value.toLowerCase();
  renderListaOrcamentos(q);
};\n`;
js += filterFn;

// update renderListaOrcamentos signature
js = js.replace(`function renderListaOrcamentos() {`, `function renderListaOrcamentos(filterQuery = '') {`);

// Apply filter inside renderListaOrcamentos
const targetFilter = `let lista = state.orcamentosDB.slice().sort((a,b)=>new Date(b.atualizadoEm)-new Date(a.atualizadoEm));`;
const replaceFilter = `let lista = state.orcamentosDB.slice().sort((a,b)=>new Date(b.atualizadoEm)-new Date(a.atualizadoEm));
  if (filterQuery) {
    lista = lista.filter(o => 
      (o.nome||'').toLowerCase().includes(filterQuery) || 
      (o.cliente?.nome||'').toLowerCase().includes(filterQuery)
    );
  }`;
js = js.replace(targetFilter, replaceFilter);

// Change editarCotacaoAtual logic to just show the editor wrapper
const targetEditar = `window.editarCotacaoAtual = function() {
  document.getElementById('previewOverlay').classList.add('hidden');
  document.body.style.overflow = '';
  navToPage('orcamento');
};`;
const replaceEditar = `window.editarCotacaoAtual = function() {
  // Se tiver um overlay antigo escondemos
  const overlay = document.getElementById('previewOverlay');
  if(overlay) { overlay.classList.add('hidden'); document.body.style.overflow = ''; }
  
  document.getElementById('orcamentosPreviewWrapper').style.display = 'none';
  document.getElementById('orcamentosEditorWrapper').style.display = 'block';
};`;
js = js.replace(targetEditar, replaceEditar);

fs.writeFileSync('public/js/app.js', js);
console.log("app.js modificado para Cotações 3-pane");
