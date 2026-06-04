const fs = require('fs');

// --- index.html ---
let html = fs.readFileSync('public/index.html', 'utf8');

const modalFooterHTML = `<div class="modal-footer">`;
const modalBtnsHTML = `
      <div style="display:flex; justify-content: space-between; margin-bottom: 20px; gap: 10px;">
        <button id="btnAcessoCotacao" class="btn-secondary" style="flex: 1;" type="button">Abrir Cotação</button>
        <button id="btnAcessoRoteiro" class="btn-secondary" style="flex: 1;" type="button">Abrir Roteiro</button>
      </div>
      <div class="modal-footer">`;

if (!html.includes('btnAcessoCotacao') && html.includes(modalFooterHTML)) {
  html = html.replace(modalFooterHTML, modalBtnsHTML);
  fs.writeFileSync('public/index.html', html);
  console.log("index.html patched");
}

// --- app.js ---
let app = fs.readFileSync('public/js/app.js', 'utf8');

const hubLogic = `
// ── HUB DO CLIENTE (ATALHOS) ────────────────────────────────────────────────────────

function formatHubButtons() {
  const btnCotacao = document.getElementById('btnAcessoCotacao');
  const btnRoteiro = document.getElementById('btnAcessoRoteiro');
  if (!btnCotacao || !btnRoteiro) return;
  
  if (!currentEditingClienteId) {
    btnCotacao.style.display = 'none';
    btnRoteiro.style.display = 'none';
    return;
  }
  btnCotacao.style.display = 'block';
  btnRoteiro.style.display = 'block';
  
  // Buscar orcamento
  fetch('/api/orcamentos').then(r=>r.json()).then(orcs => {
    const orc = orcs.find(o => o.notionClienteId === currentEditingClienteId);
    if (orc) {
      btnCotacao.innerText = 'Abrir Cotação';
      btnCotacao.onclick = () => { closeClienteModal(); loadOrcamento(orc); switchPage('orcamento'); };
      
      if (orc.orcRoteiroVinculado) {
         btnRoteiro.innerText = 'Abrir Roteiro';
         btnRoteiro.onclick = () => { closeClienteModal(); loadOrcamento(orc); document.getElementById('orcRoteiroVinculado').value = orc.orcRoteiroVinculado; switchPage('timeline'); };
      } else {
         btnRoteiro.innerText = 'Gerar Roteiro';
         btnRoteiro.onclick = () => {
           closeClienteModal();
           loadOrcamento(orc);
           switchPage('orcamento');
           const btnGerar = document.getElementById('btnGerarRoteiroEstadias');
           if(btnGerar) { setTimeout(() => btnGerar.click(), 500); }
         };
      }
    } else {
      btnCotacao.innerText = 'Gerar Cotação';
      btnCotacao.onclick = () => { 
        closeClienteModal(); 
        novoOrcamento();
        state.orcamento.notionClienteId = currentEditingClienteId;
        const nome = document.getElementById('mcNome').value;
        document.getElementById('orcNome').value = nome;
        state.orcamento.estadias = JSON.parse(JSON.stringify(currentEditingEstadias));
        renderEstadiasReadOnlyForm();
        switchPage('orcamento'); 
      };
      
      btnRoteiro.innerText = 'Gerar Roteiro';
      btnRoteiro.onclick = () => {
        closeClienteModal(); 
        novoOrcamento();
        state.orcamento.notionClienteId = currentEditingClienteId;
        state.orcamento.estadias = JSON.parse(JSON.stringify(currentEditingEstadias));
        renderEstadiasReadOnlyForm();
        switchPage('orcamento');
        const btnGerar = document.getElementById('btnGerarRoteiroEstadias');
        if(btnGerar) { setTimeout(() => btnGerar.click(), 500); }
      };
    }
  });
}
`;

if (!app.includes('formatHubButtons()')) {
  app = app + '\n' + hubLogic;
  
  // Call formatHubButtons when modal opens
  const searchAbrir = `currentEditingEstadias = d.estadias || [];
      renderEstadiasForm();`;
  const replaceAbrir = `currentEditingEstadias = d.estadias || [];
      renderEstadiasForm();
      formatHubButtons();`;
      
  const searchAbrirNew = `currentEditingEstadias = [];
    renderEstadiasForm();`;
  const replaceAbrirNew = `currentEditingEstadias = [];
    renderEstadiasForm();
    formatHubButtons();`;
    
  app = app.replace(searchAbrir, replaceAbrir);
  app = app.replace(searchAbrirNew, replaceAbrirNew);
  
  fs.writeFileSync('public/js/app.js', app);
  console.log("app.js patched");
}
