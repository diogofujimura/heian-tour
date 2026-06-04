const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');

const searchHtml = `<div class="form-grid">
          <div class="field"><label>Nome do Cliente</label><input type="text" id="rotClienteNome" placeholder="Ex: Gisela (Lisa e Artur)" onchange="updRotCliente('nome', this.value)"></div>
          <div class="field" style="max-width:90px"><label>Adultos</label><input type="number" id="rotClienteAdultos" value="2" min="1" onchange="updRotCliente('adultos', this.value)"></div>
          <div class="field" style="max-width:90px"><label>Crianças</label><input type="number" id="rotClienteCriancas" value="0" min="0" onchange="updRotCliente('criancas', this.value)"></div>
          <div class="field"><label>Data de Início</label><input type="date" id="rotClienteData" onchange="updRotCliente('dataOrcamento', this.value)"></div>
          <div class="field"><label>Data Final</label><input type="date" id="rotClienteDataFim" onchange="updRotCliente('dataFim', this.value)"></div>
        </div>
        <div class="form-grid" style="margin-top:12px; grid-template-columns:1fr 1fr 1fr">
          <div class="field"><label>Hotel Hospedagem</label><input type="text" id="rotClienteHotel" placeholder="Ex: Hilton Tokyo" onchange="updRotCliente('hotel', this.value)"></div>
          <div class="field"><label>Voo Chegada</label><input type="text" id="rotClienteVooChegada" placeholder="Ex: JL01 10/10 14:00" onchange="updRotCliente('vooChegada', this.value)"></div>
          <div class="field"><label>Voo Partida</label><input type="text" id="rotClienteVooPartida" placeholder="Ex: JL02 20/10 18:00" onchange="updRotCliente('vooPartida', this.value)"></div>
        </div>`;

const replaceHtml = `<div class="form-grid" style="grid-template-columns: 2fr 1fr 1fr">
          <div class="field"><label>Nome do Cliente</label><input type="text" id="rotClienteNome" placeholder="Ex: Gisela (Lisa e Artur)" onchange="updRotCliente('nome', this.value)"></div>
          <div class="field"><label>Adultos</label><input type="number" id="rotClienteAdultos" value="2" min="1" onchange="updRotCliente('adultos', this.value)"></div>
          <div class="field"><label>Crianças</label><input type="number" id="rotClienteCriancas" value="0" min="0" onchange="updRotCliente('criancas', this.value)"></div>
        </div>
        <div class="form-grid" style="margin-top:12px; grid-template-columns: 1fr 1fr">
          <div class="field"><label>Data de Início</label><input type="date" id="rotClienteData" onchange="updRotCliente('dataOrcamento', this.value)"></div>
          <div class="field"><label>Data Final</label><input type="date" id="rotClienteDataFim" onchange="updRotCliente('dataFim', this.value)"></div>
        </div>
        <div class="form-grid" style="margin-top:12px; grid-template-columns: 1fr 1fr">
          <div class="field"><label>Voo Chegada</label><input type="text" id="rotClienteVooChegada" placeholder="Ex: JL01 10/10 14:00" onchange="updRotCliente('vooChegada', this.value)"></div>
          <div class="field"><label>Voo Partida</label><input type="text" id="rotClienteVooPartida" placeholder="Ex: JL02 20/10 18:00" onchange="updRotCliente('vooPartida', this.value)"></div>
        </div>
        
        <div class="subsection-title" style="margin-top:20px; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:var(--gold-dk)">Estadias</div>
        <div id="rotEstadiasList"></div>
        <button class="btn-add" id="btnRotAddEstadia" style="margin-top:8px; border-style:dashed">+ Adicionar Estadia</button>
        `;

code = code.replace(searchHtml, replaceHtml);
fs.writeFileSync('public/index.html', code);
console.log('Patched index.html layout');
