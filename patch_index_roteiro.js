const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');

const searchHtml = `<div class="field"><label>Data da Viagem</label><input type="date" id="rotClienteData" onchange="updRotCliente('dataOrcamento', this.value)"></div>`;
const replaceHtml = `<div class="field"><label>Data de Início</label><input type="date" id="rotClienteData" onchange="updRotCliente('dataOrcamento', this.value)"></div>
          <div class="field"><label>Data Final</label><input type="date" id="rotClienteDataFim" onchange="updRotCliente('dataFim', this.value)"></div>
        </div>
        <div class="form-grid" style="margin-top:12px; grid-template-columns:1fr 1fr 1fr">
          <div class="field"><label>Hotel Hospedagem</label><input type="text" id="rotClienteHotel" placeholder="Ex: Hilton Tokyo" onchange="updRotCliente('hotel', this.value)"></div>
          <div class="field"><label>Voo Chegada</label><input type="text" id="rotClienteVooChegada" placeholder="Ex: JL01 10/10 14:00" onchange="updRotCliente('vooChegada', this.value)"></div>
          <div class="field"><label>Voo Partida</label><input type="text" id="rotClienteVooPartida" placeholder="Ex: JL02 20/10 18:00" onchange="updRotCliente('vooPartida', this.value)"></div>`;

code = code.replace(searchHtml, replaceHtml);
fs.writeFileSync('public/index.html', code);
console.log('Patched index.html');
