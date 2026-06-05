const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Replace Roteiros
const roteirosRegex = /<div id="page-roteiros"[\s\S]*?<!-- ── MEUS ORÇAMENTOS ────────────────────────────────────────────────── -->/;

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
            <div class="roteiro-timeline" id="roteiroTimeline"></div>
            
            <div class="roteiro-edit-container" id="roteiroEditContainer" style="display:none; margin-top: 20px;">
               <div id="roteiroEditHeaderDisplay" style="text-align: center; margin-bottom: 24px; padding: 20px; background: #fff; border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
                 <h2 id="roteiroEditTitle" style="margin: 0; color: var(--gold-dk); font-size: 22px; font-weight: 600;">Roteiro em Edição</h2>
                 <p id="roteiroEditSubtitle" style="margin: 6px 0 0 0; color: var(--text-sec); font-size: 15px; font-weight: 500;">Cliente: - | Viagem: -</p>
               </div>
               <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-end; margin-bottom: 24px; border-bottom:1px solid var(--border); padding-bottom:16px;">
                 <div class="field" style="margin:0; width:100%; max-width:300px">
                   <label>Nome do Roteiro (Salvo na Base)</label>
                   <input type="text" id="editRoteiroNome" placeholder="Ex: Roteiro do Cliente">
                 </div>
                 <div style="margin-top:20px; display:flex; flex-wrap:wrap; justify-content:flex-end; gap:10px; align-items:center;">
                   <div style="flex:1"></div>
                   <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center">
                     <span id="roteiroAutoSaveIndicator" style="font-size:11px;color:var(--ink-lt);opacity:0;transition:opacity 0.3s;letter-spacing:0.04em; margin-right:10px"></span>
                     <div id="roteiroCotacaoActions" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
                     <button id="btnSalvarVisualizarRoteiro" class="btn-secondary">Pré-visualizar (Salva)</button>
                     <button id="btnSalvarEdicaoRoteiro" class="btn-primary">Salvar Roteiro</button>
                     <button id="btnCancelarEdicaoRoteiro" class="btn-secondary" style="border-color:transparent; background:transparent">Cancelar</button>
                   </div>
                 </div>
               </div>
               
               <div class="card" style="margin-bottom: 24px">
                 <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-end; margin-bottom:12px;">
                   <h2 class="card-title" style="font-size:14px; margin:0">Dados do Cliente <button id="btnImportNotionRoteiro" class="btn-secondary" style="margin-left: 10px; font-size: 12px; background-color: rgb(241, 245, 249);" type="button" onclick="toggleImportNotionRoteiro()">⚡ Importar do Notion</button></h2>
                   <div>
                     <button id="btnEditarClienteRoteiro" class="btn-secondary" style="font-size:12px; padding:4px 10px;" type="button" onclick="handleAcaoClienteRoteiro()">👤 Editar Cliente</button>
                   </div>
                 </div>
                 <div class="form-grid" id="rotNotionSelectWrapper" style="display:none; margin-bottom: 15px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                   <label style="color: #0f172a; font-weight: 600;">Selecione o Cliente no Notion:</label>
                   <select id="rotNotionClienteSelect" style="width: 100%; padding: 8px; margin-top: 5px;" onchange="vincularClienteRoteiroFromSelect()">
                     <option value="">Carregando clientes...</option>
                   </select>
                 </div>
                 <div class="form-grid" style="grid-template-columns: 2fr 1fr 1fr">
                   <div class="field"><label>Nome do Cliente</label><input type="text" id="rotClienteNome" ></div>
                   <div class="field"><label>Adultos</label><input type="number" id="rotClienteAdultos" value="2" min="1" ></div>
                   <div class="field"><label>Crianças</label><input type="number" id="rotClienteCriancas" value="0" min="0" ></div>
                 </div>
                 <div class="form-grid" style="margin-top:12px; grid-template-columns: 1fr 1fr">
                   <div class="field"><label>Data de Início</label><input type="date" id="rotClienteData" ></div>
                   <div class="field"><label>Data Final</label><input type="date" id="rotClienteDataFim" ></div>
                 </div>
                 <div class="form-grid" style="margin-top:12px; grid-template-columns: 1fr 1fr">
                   <div class="field"><label>Voo Chegada</label><input type="text" id="rotClienteVooChegada" placeholder="Ex: JL01 10/10 14:00" onchange="updRotCliente('vooChegada', this.value)"></div>
                   <div class="field"><label>Voo Partida</label><input type="text" id="rotClienteVooPartida" placeholder="Ex: JL02 20/10 18:00" onchange="updRotCliente('vooPartida', this.value)"></div>
                 </div>
                 
                 <div style="margin-top:12px; text-align: right;">
                   <button class="btn-primary" id="btnGerarDiasAutomaticamente" style="font-size:11px; padding: 6px 12px; border-radius:4px;" title="Cria automaticamente todos os dias baseado na Data de Início e Data Final.">✨ Gerar Dias Automaticamente</button>
                 </div>
                 <div class="subsection-title" style="margin-top:20px; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:var(--gold-dk)">Estadias</div>
                 <div id="rotEstadiasList"></div>
                 <button class="btn-add" id="btnRotAddEstadia" style="margin-top:8px; border-style:dashed">+ Adicionar Estadia</button>
                 
               </div>

               <div id="editRoteiroDiasList"></div>
               <button class="btn-add" id="btnAddDiaRoteiro" style="margin-top:12px">+ Adicionar Dia</button>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── MEUS ORÇAMENTOS ────────────────────────────────────────────────── -->`;

html = html.replace(roteirosRegex, replaceRoteiros);


// 2. Replace Clientes
const clientesRegex = /<div id="page-clientes"[\s\S]*?<!-- ── CONFIGURAÇÕES ────────────────────────────────────────────────────── -->/;

const replaceClientes = `<div id="page-clientes" class="page pane-layout">
    <div class="pane-list">
      <div class="pane-list-header">
        <h2 style="font-family: var(--ff-display); font-size: 26px; font-weight: 400; color: var(--crimson);">Clientes</h2>
        <div style="display:flex; gap:8px">
          <input type="text" id="pesquisaClientesList" class="search-input-modern" placeholder="Pesquisar cliente..." onkeyup="renderTabelaClientes(this.value)">
          <button class="btn-secondary" id="btnRefreshClientes" style="padding: 10px; border-radius:8px;" title="Sincronizar Notion">↻</button>
          <button class="btn-primary" id="btnNovoCliente" style="padding: 10px 14px; border-radius:8px;" title="Novo Cliente">+</button>
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
  </div>

  <!-- ── CONFIGURAÇÕES ────────────────────────────────────────────────────── -->`;

html = html.replace(clientesRegex, replaceClientes);

fs.writeFileSync('public/index.html', html);
console.log("Roteiros and Clientes DOM structure fixed.");
