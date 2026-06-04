const fs = require('fs');

// --- APP.JS MODIFICATIONS ---
let app = fs.readFileSync('public/js/app.js', 'utf8');

// 1. Add Visualizar button to renderClientesTabela
const oldTr = `        <td>
          <button class="btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="editarClienteNotion('\${c.id}')">Editar</button>
        </td>`;
const newTr = `        <td>
          <button class="btn-primary" style="padding: 4px 8px; font-size: 11px; margin-right:5px; background:var(--gold-dk); border-color:var(--gold-dk)" onclick="abrirVisaoGeralCliente('\${c.id}')"><i class="fa fa-eye"></i> Visualizar</button>
          <button class="btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="editarClienteNotion('\${c.id}')">Editar</button>
        </td>`;
app = app.replace(oldTr, newTr);

// 2. Add abrirVisaoGeralCliente function
const funcs = `
window.abrirVisaoGeralCliente = function(clientId) {
  const cliente = notionClients.find(c => c.id === clientId);
  if (!cliente) return;
  
  const orc = state.orcamentosDB.find(o => o.notionClienteId === clientId);
  
  let roteiroInfo = null;
  if (typeof dbRotas !== 'undefined') {
    for (const [k, v] of Object.entries(dbRotas)) {
      if (v.cliente && v.cliente.nome === cliente.nome) {
        roteiroInfo = { nome: k, data: v };
        break;
      }
    }
  }
  
  if (!orc && !roteiroInfo) {
    alert('Nenhum Roteiro ou Cotação encontrado para este cliente ainda.');
    return;
  }
  
  // Injeta o botão de alternância no header do preview
  let btnToggle = document.getElementById('btnTogglePreviewView');
  if (!btnToggle) {
    btnToggle = document.createElement('button');
    btnToggle.id = 'btnTogglePreviewView';
    btnToggle.className = 'btn-secondary';
    btnToggle.style.marginRight = '10px';
    btnToggle.style.color = '#fff';
    btnToggle.style.borderColor = 'rgba(255,255,255,0.4)';
    const headerDiv = document.querySelector('#previewOverlay .preview-header div');
    headerDiv.insertBefore(btnToggle, document.getElementById('btnPrintFromPreview'));
  }
  
  if (orc && roteiroInfo) {
    btnToggle.style.display = 'inline-block';
    btnToggle.dataset.view = roteiroInfo ? 'roteiro' : 'cotacao';
    btnToggle.innerHTML = roteiroInfo ? '🔄 Mudar para Cotação' : '🔄 Mudar para Roteiro';
    
    btnToggle.onclick = function() {
      if (this.dataset.view === 'roteiro') {
        this.dataset.view = 'cotacao';
        this.innerHTML = '🔄 Mudar para Roteiro';
        state.orcamento = orc;
        renderPreview(); 
      } else {
        this.dataset.view = 'roteiro';
        this.innerHTML = '🔄 Mudar para Cotação';
        roteiroOriginalNome = roteiroInfo.nome;
        roteiroEmEdicao = JSON.parse(JSON.stringify(roteiroInfo.data));
        document.getElementById('editRoteiroNome').value = roteiroInfo.nome;
        const btn = document.getElementById('btnPrevisualizarRoteiro');
        if(btn) btn.click();
      }
    };
  } else {
    btnToggle.style.display = 'none';
  }
  
  // Abre o que existir primeiro (dá preferencia pro roteiro)
  if (roteiroInfo) {
    roteiroOriginalNome = roteiroInfo.nome;
    roteiroEmEdicao = JSON.parse(JSON.stringify(roteiroInfo.data));
    document.getElementById('editRoteiroNome').value = roteiroInfo.nome;
    const btn = document.getElementById('btnPrevisualizarRoteiro');
    if(btn) btn.click();
  } else {
    state.orcamento = orc;
    renderPreview();
    document.getElementById('previewOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
};
`;
app += funcs;
fs.writeFileSync('public/js/app.js', app);

// --- INDEX.HTML MODIFICATIONS ---
let html = fs.readFileSync('public/index.html', 'utf8');

// Update close button to hide toggle button
const oldClose = `onclick="document.getElementById('previewOverlay').classList.add('hidden'); document.body.style.overflow='';"`;
const newClose = `onclick="document.getElementById('previewOverlay').classList.add('hidden'); document.body.style.overflow=''; const t = document.getElementById('btnTogglePreviewView'); if(t) t.style.display='none';"`;
html = html.replace(oldClose, newClose);

fs.writeFileSync('public/index.html', html);
console.log('Added Visao Geral buttons');
