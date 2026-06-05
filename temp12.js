const fs = require('fs');

// --- 1. INDEX.HTML ---
let html = fs.readFileSync('public/index.html', 'utf8');

// Modificar header de roteiros
const targetRotHeader = `<button id="btnNovoRoteiro" class="btn-secondary">+ Novo</button>
        <button id="btnEditarRoteiro" class="btn-secondary" style="display:none">Editar</button>
        <button id="btnExcluirRoteiro" class="btn-secondary" style="display:none; color:#e06666; border-color:rgba(224,102,102,0.3)">✖</button>
        <button id="btnIrParaCotacao" class="btn-secondary" style="display:none; color:var(--crimson); border-color:rgba(180,30,40,0.3)">➔ Ir para Cotação</button>`;
const replaceRotHeader = `<button id="btnNovoRoteiro" class="btn-secondary">+ Novo Roteiro</button>`;
html = html.replace(targetRotHeader, replaceRotHeader);

// Injetar roteiro preview header acima da timeline
const targetTimeline = `<div class="roteiro-timeline" id="roteiroTimeline">`;
const replaceTimeline = `<div id="roteiroPreviewHeader" style="display:none; margin-bottom: 20px; padding: 15px; background: #fffcf0; border: 1px solid #fde68a; border-radius: 8px; align-items: center; justify-content: space-between;">
        <div style="display:flex; align-items:center; gap: 15px;">
           <h2 id="roteiroPreviewTitle" style="margin:0; color: var(--gold-dk); font-size: 20px;"></h2>
           <button id="btnEditarRoteiro" class="btn-primary" style="padding: 6px 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">✏️ Editar Roteiro</button>
           <button id="btnExcluirRoteiro" class="btn-secondary" style="color:#e06666; border-color:rgba(224,102,102,0.3); padding: 5px 12px; font-size:12px;">✖ Excluir Roteiro</button>
        </div>
      </div>
      <div class="roteiro-timeline" id="roteiroTimeline">`;
html = html.replace(targetTimeline, replaceTimeline);

// Modificar toolbar do preview
const targetPreviewToolbar = `<div>
      <button id="btnPrintFromPreview" class="btn-primary">🖨 &nbsp;Imprimir / Salvar PDF</button>
      <button id="btnClosePreview" class="btn-secondary" onclick="document.getElementById('previewOverlay').classList.add('hidden'); document.body.style.overflow=''; const t = document.getElementById('btnTogglePreviewView'); if(t) t.style.display='none';" style="color:rgba(255,255,255,0.7);border-color:rgba(255,255,255,0.25)">Fechar</button>
    </div>`;
const replacePreviewToolbar = `<div style="display:flex; gap: 10px;">
      <button id="btnEditFromPreview" class="btn-primary" onclick="editarCotacaoAtual()">✏️ Editar Cotação</button>
      <button id="btnPrintFromPreview" class="btn-secondary" style="color:rgba(255,255,255,0.9);border-color:rgba(255,255,255,0.4)">🖨 Imprimir / PDF</button>
      <button id="btnClosePreview" class="btn-secondary" onclick="document.getElementById('previewOverlay').classList.add('hidden'); document.body.style.overflow=''; const t = document.getElementById('btnTogglePreviewView'); if(t) t.style.display='none';" style="color:rgba(255,255,255,0.7);border-color:rgba(255,255,255,0.25)">✕ Fechar</button>
    </div>`;
html = html.replace(targetPreviewToolbar, replacePreviewToolbar);
fs.writeFileSync('public/index.html', html);


// --- 2. ROTEIROS.JS ---
let roteirosJs = fs.readFileSync('public/js/roteiros.js', 'utf8');

// Event listener change 
const targetRotChange = `if (roteiro && dbRotas[roteiro]) {
        renderizarRoteiro(roteiro);
      } else {
        document.getElementById('roteiroDiasContainer').innerHTML = '<p style="color:#666; font-style:italic">Selecione um roteiro base acima para visualizar os dias.</p>';
        document.getElementById('btnEditarRoteiro').style.display = 'none';
        document.getElementById('btnExcluirRoteiro').style.display = 'none';
        document.getElementById('btnIrParaCotacao').style.display = 'none';
      }`;
const replaceRotChange = `if (roteiro && dbRotas[roteiro]) {
        document.getElementById('roteiroPreviewHeader').style.display = 'flex';
        document.getElementById('roteiroPreviewTitle').textContent = roteiro;
        renderizarRoteiro(roteiro);
      } else {
        document.getElementById('roteiroDiasContainer').innerHTML = '<p style="color:#666; font-style:italic">Selecione um roteiro base acima para visualizar os dias.</p>';
        document.getElementById('roteiroPreviewHeader').style.display = 'none';
      }`;
roteirosJs = roteirosJs.replace(targetRotChange, replaceRotChange);

// renderizarRoteiro display edits
const targetRotRender = `const btnEdit = document.getElementById('btnEditarRoteiro');
  const btnDel = document.getElementById('btnExcluirRoteiro');
  const btnCot = document.getElementById('btnIrParaCotacao');
  if (btnEdit) btnEdit.style.display = 'inline-block';
  if (btnDel) btnDel.style.display = 'inline-block';
  
  if (btnCot) {
    if (dbRotas[nome] && dbRotas[nome].cliente && dbRotas[nome].cliente.notionClienteId) {
       btnCot.style.display = 'inline-block';
       btnCot.onclick = () => {
         const cliId = dbRotas[nome].cliente.notionClienteId;
         if (typeof navToPage === 'function' && typeof state !== 'undefined') {
            const orc = state.orcamentosDB.find(o => o.notionClienteId === cliId);
            if (orc && typeof abrirOrcamento === 'function') {
               abrirOrcamento(orc.id);
            } else {
               alert('Nenhuma cotação salva encontrada vinculada a este cliente.');
            }
         }
       };
    } else {
       btnCot.style.display = 'none';
    }
  }`;

roteirosJs = roteirosJs.replace(targetRotRender, '');
fs.writeFileSync('public/js/roteiros.js', roteirosJs);


// --- 3. APP.JS ---
let appJs = fs.readFileSync('public/js/app.js', 'utf8');

// Adicionar a função editarCotacaoAtual
const extraFn = `\nwindow.editarCotacaoAtual = function() {
  document.getElementById('previewOverlay').classList.add('hidden');
  document.body.style.overflow = '';
  navToPage('orcamento');
};\n`;
appJs += extraFn;

// Modificar abrirOrcamento
const targetAbrirOrcamentoDef = `function abrirOrcamento(id) {`;
const replaceAbrirOrcamentoDef = `function abrirOrcamento(id, directEdit = false) {`;
appJs = appJs.replace(targetAbrirOrcamentoDef, replaceAbrirOrcamentoDef);

const targetAbrirOrcamentoEnd = `updateResumo();
  navToPage('orcamento');
  
  if (state.orcamento.notionClienteId && typeof syncClienteAtivo === 'function') {
      syncClienteAtivo(state.orcamento.notionClienteId);
  }`;
const replaceAbrirOrcamentoEnd = `updateResumo();
  if (directEdit) {
    navToPage('orcamento');
  } else {
    renderPreview();
  }
  
  if (state.orcamento.notionClienteId && typeof syncClienteAtivo === 'function') {
      syncClienteAtivo(state.orcamento.notionClienteId);
  }`;
appJs = appJs.replace(targetAbrirOrcamentoEnd, replaceAbrirOrcamentoEnd);

// When creating a new quote, it should open in directEdit=true
const targetNovoOrcamentoBtn = `document.getElementById('btnNovoOrc').addEventListener('click', () => {
    history.pushState({ page: 'orcamento' }, '', '#orcamento');
    novoOrcamento();
  });`;
const replaceNovoOrcamentoBtn = `document.getElementById('btnNovoOrc').addEventListener('click', () => {
    history.pushState({ page: 'orcamento' }, '', '#orcamento');
    novoOrcamento();
    navToPage('orcamento');
  });`;
appJs = appJs.replace(targetNovoOrcamentoBtn, replaceNovoOrcamentoBtn);

fs.writeFileSync('public/js/app.js', appJs);

console.log("Modificações concluídas com sucesso.");
