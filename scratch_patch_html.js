const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

const cotacaoSearch = `<div class="form-grid" style="margin-top:12px">
        <div class="field"><label>Nome do Cliente</label><input type="text" id="clienteNome" placeholder="Ex: Gisela (Lisa e Artur)"></div>
        <div class="field" style="max-width:90px"><label>Adultos</label><input type="number" id="clienteAdultos" value="2" min="1"></div>
        <div class="field" style="max-width:90px"><label>Crianças</label><input type="number" id="clienteCriancas" value="0" min="0"></div>
        <div class="field"><label>Data do Orçamento</label><input type="date" id="clienteDataOrcamento"></div>
      </div>`;

const cotacaoReplace = `<div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:12px; margin-bottom:8px;">
        <h3 style="margin:0; font-size:16px; color:#5c1d24; font-family: 'Playfair Display', serif;">Dados do Cliente</h3>
        <button id="btnEditarClienteCotacao" class="btn-secondary" style="font-size:12px; padding:4px 10px;" onclick="if(state.orcamento && state.orcamento.notionClienteId) abrirClienteModal(state.orcamento.notionClienteId)">✏️ Editar Cliente</button>
      </div>
      <div class="form-grid" style="margin-top:0">
        <div class="field"><label>Nome do Cliente</label><input type="text" id="clienteNome" readonly style="background:#f1f5f9; cursor:not-allowed"></div>
        <div class="field" style="max-width:90px"><label>Adultos</label><input type="number" id="clienteAdultos" value="2" min="1" readonly style="background:#f1f5f9; cursor:not-allowed"></div>
        <div class="field" style="max-width:90px"><label>Crianças</label><input type="number" id="clienteCriancas" value="0" min="0" readonly style="background:#f1f5f9; cursor:not-allowed"></div>
        <div class="field"><label>Data do Orçamento</label><input type="date" id="clienteDataOrcamento"></div>
      </div>`;

const roteiroSearch = `<div class="form-grid" style="margin-top:12px; grid-template-columns: 2fr 1fr 1fr">
          <div class="field"><label>Nome do Cliente</label><input type="text" id="rotClienteNome" placeholder="Ex: Gisela (Lisa e Artur)" onchange="updRotCliente('nome', this.value)"></div>
          <div class="field"><label>Adultos</label><input type="number" id="rotClienteAdultos" value="2" min="1" onchange="updRotCliente('adultos', this.value)"></div>
          <div class="field"><label>Crianças</label><input type="number" id="rotClienteCriancas" value="0" min="0" onchange="updRotCliente('criancas', this.value)"></div>
        </div>
        <div class="form-grid" style="margin-top:12px; grid-template-columns: 1fr 1fr">
          <div class="field"><label>Data de Início</label><input type="date" id="rotClienteData" onchange="updRotCliente('dataOrcamento', this.value)"></div>
        </div>`;

const roteiroReplace = `<div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:12px; margin-bottom:8px;">
          <h3 style="margin:0; font-size:16px; color:#5c1d24; font-family: 'Playfair Display', serif;">Dados do Cliente</h3>
          <button id="btnEditarClienteRoteiro" class="btn-secondary" style="font-size:12px; padding:4px 10px;" type="button" onclick="if(state.orcamento && state.orcamento.notionClienteId) abrirClienteModal(state.orcamento.notionClienteId)">✏️ Editar Cliente</button>
        </div>
        <div class="form-grid" style="margin-top:0; grid-template-columns: 2fr 1fr 1fr">
          <div class="field"><label>Nome do Cliente</label><input type="text" id="rotClienteNome" readonly style="background:#f1f5f9; cursor:not-allowed"></div>
          <div class="field"><label>Adultos</label><input type="number" id="rotClienteAdultos" value="2" min="1" readonly style="background:#f1f5f9; cursor:not-allowed"></div>
          <div class="field"><label>Crianças</label><input type="number" id="rotClienteCriancas" value="0" min="0" readonly style="background:#f1f5f9; cursor:not-allowed"></div>
        </div>
        <div class="form-grid" style="margin-top:12px; grid-template-columns: 1fr 1fr">
          <div class="field"><label>Data de Início</label><input type="date" id="rotClienteData" readonly style="background:#f1f5f9; cursor:not-allowed"></div>
        </div>`;

if(html.includes(cotacaoSearch)) {
  html = html.replace(cotacaoSearch, cotacaoReplace);
  console.log('Cotacao replaced');
} else console.log('Cotacao not found');

if(html.includes(roteiroSearch)) {
  html = html.replace(roteiroSearch, roteiroReplace);
  console.log('Roteiro replaced');
} else console.log('Roteiro not found');

fs.writeFileSync('public/index.html', html);
