const fs = require('fs');

// 1. Modificar index.html
let html = fs.readFileSync('public/index.html', 'utf8');

// Substituir o botão original de "Vincular" e "Editar" pelo novo layout igual ao da cotação
const targetHeader = `<div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-end; margin-bottom:12px;">
          <h2 class="card-title" style="font-size:14px; margin:0">Dados do Cliente (Cabeça)</h2>
          <div>
          <button id="btnVincularClienteRoteiro" class="btn-secondary" style="font-size:12px; padding:4px 10px; margin-right:8px;" type="button" onclick="abrirModalVincularClienteRoteiro()">🔗 Vincular Cliente</button>
          <button id="btnEditarClienteRoteiro" class="btn-secondary" style="font-size:12px; padding:4px 10px;" type="button" onclick="if(typeof roteiroEmEdicao !== 'undefined' && roteiroEmEdicao && roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.notionClienteId) { editarClienteNotion(roteiroEmEdicao.cliente.notionClienteId); } else { alert('Este roteiro não possui um cliente do Notion vinculado.'); }">👤 Editar Cliente</button>
          </div>
        </div>`;

const newHeader = `<div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-end; margin-bottom:12px;">
          <h2 class="card-title" style="font-size:14px; margin:0">Dados do Cliente <button id="btnImportNotionRoteiro" class="btn-secondary" style="margin-left: 10px; font-size: 12px; background-color: rgb(241, 245, 249);" type="button" onclick="toggleImportNotionRoteiro()">⚡ Importar do Notion</button></h2>
          <div>
            <button id="btnEditarClienteRoteiro" class="btn-secondary" style="font-size:12px; padding:4px 10px;" type="button" onclick="if(typeof roteiroEmEdicao !== 'undefined' && roteiroEmEdicao && roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.notionClienteId) { editarClienteNotion(roteiroEmEdicao.cliente.notionClienteId); } else { alert('Este roteiro não possui um cliente do Notion vinculado.'); }">👤 Editar Cliente</button>
          </div>
        </div>
        <div class="form-grid" id="rotNotionSelectWrapper" style="display:none; margin-bottom: 15px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
          <label style="color: #0f172a; font-weight: 600;">Selecione o Cliente no Notion:</label>
          <select id="rotNotionClienteSelect" style="width: 100%; padding: 8px; margin-top: 5px;" onchange="vincularClienteRoteiroFromSelect()">
            <option value="">Carregando clientes...</option>
          </select>
        </div>`;

html = html.replace(targetHeader, newHeader);

// Remover o Modal inteiro
const targetModal = `<!-- Modal Vincular Cliente ao Roteiro -->
<div id="modalVincularClienteRoteiro" class="modal-overlay hidden">
  <div class="modal" style="max-width:400px">
    <h3>Vincular Cliente ao Roteiro</h3>
    <div class="form-grid">
      <div class="field">
        <label>Selecione o Cliente do Notion</label>
        <select id="selClienteParaVincular" style="width:100%">
        </select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="document.getElementById('modalVincularClienteRoteiro').classList.add('hidden')">Cancelar</button>
      <button class="btn-primary" onclick="confirmarVincularClienteRoteiro()">Vincular</button>
    </div>
  </div>
</div>`;

html = html.replace(targetModal, '');

fs.writeFileSync('public/index.html', html);


// 2. Modificar roteiros.js
let roteirosJs = fs.readFileSync('public/js/roteiros.js', 'utf8');

// Vamos substituir abrirModalVincularClienteRoteiro e confirmarVincularClienteRoteiro
// pela nova logica toggleImportNotionRoteiro e vincularClienteRoteiroFromSelect

const regexModalLogics = /window\.abrirModalVincularClienteRoteiro = async function\(\) \{[\s\S]*?window\.confirmarVincularClienteRoteiro = function\(\) \{[\s\S]*?\}\n/g;

const newRoteirosLogics = `window.toggleImportNotionRoteiro = async function() {
    const btn = document.getElementById('btnImportNotionRoteiro');
    const selectWrapper = document.getElementById('rotNotionSelectWrapper');
    const select = document.getElementById('rotNotionClienteSelect');

    if (selectWrapper.style.display === 'none') {
        selectWrapper.style.display = 'block';
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Carregando...';
        
        try {
            if (typeof window.notionClients === 'undefined' || !window.notionClients || window.notionClients.length === 0) {
                const res = await fetch('/api/notion/clientes');
                if (res.ok) {
                    window.notionClients = await res.json();
                }
            }
            
            if (typeof window.notionClients === 'undefined' || !window.notionClients || window.notionClients.length === 0) {
                alert('Não foi possível carregar os clientes do Notion.');
                selectWrapper.style.display = 'none';
                return;
            }

            select.innerHTML = '<option value="">Selecione um cliente...</option>';
            window.notionClients.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.nome + ' (' + (c.adultos||0) + ' Ad / ' + (c.criancas||0) + ' Cr) - ' + (c.dataInicio || 'Sem Data');
                select.appendChild(opt);
            });
        } catch(e) {
            console.error(e);
            alert('Erro ao carregar clientes do Notion.');
            selectWrapper.style.display = 'none';
        } finally {
            btn.innerHTML = originalText;
        }
    } else {
        selectWrapper.style.display = 'none';
    }
}

window.vincularClienteRoteiroFromSelect = function() {
    const select = document.getElementById('rotNotionClienteSelect');
    const notionId = select.value;
    if (!notionId) return;
    
    const c = notionClients.find(x => x.id === notionId);
    if (!c) return;
    
    if (!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {};
    roteiroEmEdicao.cliente.notionClienteId = c.id;
    roteiroEmEdicao.cliente.nome = c.nome;
    roteiroEmEdicao.cliente.adultos = c.adultos;
    roteiroEmEdicao.cliente.criancas = c.criancas;
    roteiroEmEdicao.cliente.dataInicio = c.dataInicio;
    roteiroEmEdicao.cliente.dataFim = c.dataFim;
    roteiroEmEdicao.cliente.dataOrcamento = c.dataInicio;
    roteiroEmEdicao.cliente.vooChegada = c.vooChegada || '';
    roteiroEmEdicao.cliente.vooPartida = c.vooPartida || '';
    
    document.getElementById('rotClienteNome').value = c.nome || '';
    document.getElementById('rotClienteAdultos').value = c.adultos || '';
    document.getElementById('rotClienteCriancas').value = c.criancas || '';
    document.getElementById('rotClienteData').value = c.dataInicio || '';
    if(document.getElementById('rotClienteDataFim')) document.getElementById('rotClienteDataFim').value = c.dataFim || '';
    if(document.getElementById('rotClienteVooChegada')) document.getElementById('rotClienteVooChegada').value = c.vooChegada || '';
    if(document.getElementById('rotClienteVooPartida')) document.getElementById('rotClienteVooPartida').value = c.vooPartida || '';
    
    // Trava os campos imediatamente após o vínculo
    ['rotClienteNome', 'rotClienteAdultos', 'rotClienteCriancas'].forEach(id => {
      const el = document.getElementById(id);
      if(el) { el.readOnly = true; el.style = 'background:#f1f5f9; cursor:not-allowed'; }
    });
    
    document.getElementById('rotNotionSelectWrapper').style.display = 'none';
    select.value = '';
    
    if(typeof triggerRoteiroAutoSave === 'function') triggerRoteiroAutoSave();
    if(typeof updateRoteiroHeader === 'function') updateRoteiroHeader();
    alert('Dados do cliente ' + c.nome + ' importados do Notion com sucesso!');
}\n`;

roteirosJs = roteirosJs.replace(regexModalLogics, newRoteirosLogics);

fs.writeFileSync('public/js/roteiros.js', roteirosJs);
