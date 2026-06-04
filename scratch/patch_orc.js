const fs = require('fs');

let js = fs.readFileSync('public/js/app.js', 'utf-8');

// 1. emptyOrc
js = js.replace(/function emptyOrc\(\) \{[\s\S]*?\}/, unction emptyOrc() {
  return { id: null, notionClienteId: null, nome: '', cliente: { nome: '', pessoas: '', dataOrcamento: '' }, valoresTour: { '4h': 0, '6h': 0, '8h': 0, '10h': 0, '12h': 0 }, estadias: [], consultoria: { ativa: false, valor: 0, descricao: '' }, tours: [], transportes: [], experiencias: [], itensAdicionais: [], textos: {}, criadoEm: null, atualizadoEm: null };
});

// 2. updBaseTour
if (!js.includes('function updBaseTour')) {
    js = js.replace('function renderEstadiasReadOnlyForm()', unction updBaseTour(horas, val) {
  if (!state.orcamento.valoresTour) state.orcamento.valoresTour = { '4h': 0, '6h': 0, '8h': 0, '10h': 0, '12h': 0 };
  state.orcamento.valoresTour[horas] = parseFloat(val) || 0;
  autoSave();
}

function renderEstadiasReadOnlyForm());
}

// 3. populate inputs inside abrirOrcamento
const populateCode = 
  if (!orc.valoresTour) orc.valoresTour = { '4h': 0, '6h': 0, '8h': 0, '10h': 0, '12h': 0 };
  document.getElementById('baseTour4h').value = orc.valoresTour['4h'] || '';
  document.getElementById('baseTour6h').value = orc.valoresTour['6h'] || '';
  document.getElementById('baseTour8h').value = orc.valoresTour['8h'] || '';
  document.getElementById('baseTour10h').value = orc.valoresTour['10h'] || '';
  document.getElementById('baseTour12h').value = orc.valoresTour['12h'] || '';
;
if (!js.includes('baseTour4h')) {
    js = js.replace("document.getElementById('clienteDataOrcamento').value = orc.cliente?.dataOrcamento || today();", 
                   "document.getElementById('clienteDataOrcamento').value = orc.cliente?.dataOrcamento || today();" + populateCode);
}

// 4. renderToursForm
const renderToursCode = unction renderToursForm() {
  const cont = document.getElementById('toursList');
  cont.innerHTML = '';
  state.orcamento.tours.forEach((t, i) => {
    let valorFinal = parseFloat(t.valor) || 0;
    if (t.descontoAtivo && t.desconto > 0) {
      valorFinal = valorFinal - (valorFinal * (t.desconto / 100));
    }
    const div = document.createElement('div');
    div.className = 'item-row';
    div.dataset.itemId = t.id;
    div.innerHTML = \
      <div class="item-row-header">
        <span class="item-row-num">Tour \</span>
        <span class="item-subtotal" id="subtotal-tour-\">¥\ · \</span>
        <button class="btn-remove" onclick="rmTour(\)">?</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Data</label>
          <input type="date" value="\" onchange="updTourField(\,'data',this.value)"></div>
        <div class="field"><label>Descrição</label>
          <input type="text" value="\" placeholder="Ex: Tour em Tokyo" oninput="updTourField(\,'descricao',this.value)"></div>
        <div class="field full-width"><label>Pontos Visitados (um por linha)</label>
          <textarea rows="3" placeholder="Asakusa&#10;Ueno Park&#10;Yanaka Ginza" oninput="updTourField(\,'pontos',this.value)">\</textarea></div>
        <div class="field"><label>Duração do Tour</label>
          <select onchange="updTourDuracao(\, this.value)">
            <option value="" \>-- Selecione --</option>
            <option value="4h" \>4 horas</option>
            <option value="6h" \>6 horas</option>
            <option value="8h" \>8 horas</option>
            <option value="10h" \>10 horas</option>
            <option value="12h" \>12 horas</option>
          </select>
        </div>
        <div class="field"><label>Valor Base do Tour ¥</label>
          <input type="number" id="tour-valor-\" value="\" placeholder="Ex: 55000"
            oninput="updTourNum(\,'valor',this.value)"
            onblur="finalizarNum(\,'tour','valor',this.value)"></div>
        <div class="field">
          <label>Desconto Aplicado</label>
          <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
            <label class="toggle"><input type="checkbox" \ onchange="updTourToggleDesconto(\,this.checked)"><span class="toggle-slider"></span></label>
            <input type="number" value="\" placeholder="%" min="0" max="100"
              style="width:80px;padding:8px 10px;border:1px solid var(--border-dk);border-radius:4px;font-family:var(--ff-num);font-size:13px;outline:none"
              \
              oninput="updTourNum(\,'desconto',this.value)">
            <span style="font-size:12px;color:var(--ink-lt)">%</span>
          </div>
        </div>
        <div class="field full-width"><label>Observações</label>
          <input type="text" id="obs-tour-\" value="\" placeholder="Ex: 8hrs com guia brasileiro · transporte público" oninput="updTourField(\,'observacao',this.value)">
          \</div>
      </div>\;
    cont.appendChild(div);
  });
}

function updTourDuracao(id, duracao) {
  const t = state.orcamento.tours.find(x => x.id === id); if (!t) return;
  t.duracao = duracao;
  if (duracao && state.orcamento.valoresTour && state.orcamento.valoresTour[duracao]) {
    t.valor = state.orcamento.valoresTour[duracao];
  }
  renderToursForm();
  updateResumo();
}
;
js = js.replace(/function renderToursForm\(\) \{[\s\S]*?\}\n(function rmTour|\nfunction rmTour)/, renderToursCode.trim() + '\nfunction rmTour');

// 5. updTourNum
js = js.replace(/function updTourNum\(id, f, rawVal\) \{[\s\S]*?\n\}/, unction updTourNum(id, f, rawVal) {
  const t = state.orcamento.tours.find(x => x.id === id); if (!t) return;
  t[f] = parseFloat(rawVal) || 0;
  
  let valorFinal = parseFloat(t.valor) || 0;
  if (t.descontoAtivo && t.desconto > 0) {
    valorFinal = valorFinal - (valorFinal * (t.desconto / 100));
  }
  const el = document.getElementById(\subtotal-tour-\\);
  if (el) el.textContent = \¥\ · \\;
  updateResumo();
});

// 6. calc_total_tours (updateResumo)
js = js.replace(/const totalTours = \(state\.orcamento\.tours\|\|\[\]\)\.reduce\(\(sum, t\) => \{\s*return sum \+ \(parseFloat\(t\.valor\)\|\|0\);\s*\}, 0\);/, 
  const totalTours = (state.orcamento.tours||[]).reduce((sum, t) => {
    let base = parseFloat(t.valor) || 0;
    if (t.descontoAtivo && t.desconto > 0) base = base - (base * (t.desconto / 100));
    return sum + base;
  }, 0););
  
// also empty fields when novoOrcamento
const novoCode = 
  if (!state.orcamento.valoresTour) state.orcamento.valoresTour = { '4h': 0, '6h': 0, '8h': 0, '10h': 0, '12h': 0 };
  document.getElementById('baseTour4h').value = '';
  document.getElementById('baseTour6h').value = '';
  document.getElementById('baseTour8h').value = '';
  document.getElementById('baseTour10h').value = '';
  document.getElementById('baseTour12h').value = '';
;
js = js.replace("document.getElementById('clienteDataOrcamento').value = today();", 
               "document.getElementById('clienteDataOrcamento').value = today();" + novoCode);


fs.writeFileSync('public/js/app.js', js);
console.log('JS patched');
