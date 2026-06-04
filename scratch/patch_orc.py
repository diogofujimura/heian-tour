import re
import os

html_path = 'public/index.html'
js_path = 'public/js/app.js'

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Add Valores Base de Tours after Estadias in Cotacao
base_tours_html = '''
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px;">
      <div class="subsection-title" style="margin: 0;">Valores Base para Tours Guiados (¥)</div>
    </div>
    <div style="margin-bottom: 20px; padding: 15px; background: #fffcf0; border: 1px solid #fde68a; border-radius: 6px;">
      <div class="form-grid" style="grid-template-columns: repeat(5, 1fr); gap: 10px;">
        <div class="field"><label>4 Horas</label><input type="number" id="baseTour4h" placeholder="Ex: 35000" oninput="updBaseTour('4h', this.value)"></div>
        <div class="field"><label>6 Horas</label><input type="number" id="baseTour6h" placeholder="Ex: 45000" oninput="updBaseTour('6h', this.value)"></div>
        <div class="field"><label>8 Horas</label><input type="number" id="baseTour8h" placeholder="Ex: 55000" oninput="updBaseTour('8h', this.value)"></div>
        <div class="field"><label>10 Horas</label><input type="number" id="baseTour10h" placeholder="Ex: 65000" oninput="updBaseTour('10h', this.value)"></div>
        <div class="field"><label>12 Horas</label><input type="number" id="baseTour12h" placeholder="Ex: 75000" oninput="updBaseTour('12h', this.value)"></div>
      </div>
      <p style="margin: 5px 0 0 0; font-size: 11px; color: #b45309;">Esses valores servem de guia para o or&ccedil;amento e auto-preenchem a lista de tours e a importa&ccedil;&atilde;o do roteiro.</p>
    </div>
'''

if 'Valores Base para Tours Guiados' not in html:
    html = html.replace('    <div id="estadiasReadOnlyList"', base_tours_html + '    <div id="estadiasReadOnlyList"')
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print('HTML patched.')
else:
    print('HTML already patched.')

with open(js_path, 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Update emptyOrc
empty_orc_new = "function emptyOrc() {\n  return { id: null, notionClienteId: null, nome: '', cliente: { nome: '', pessoas: '', dataOrcamento: '' }, valoresTour: { '4h': 0, '6h': 0, '8h': 0, '10h': 0, '12h': 0 }, estadias: [], consultoria: { ativa: false, valor: 0, descricao: '' }, tours: [], transportes: [], experiencias: [], itensAdicionais: [], textos: {}, criadoEm: null, atualizadoEm: null };\n}"
js = re.sub(r'function emptyOrc\(\) \{.*?\n.*?\}', empty_orc_new, js, flags=re.DOTALL)

# 2. Add updBaseTour function and inject loading values
if 'function updBaseTour' not in js:
    js = js.replace('function renderEstadiasReadOnlyForm()', '''function updBaseTour(horas, val) {
  if (!state.orcamento.valoresTour) state.orcamento.valoresTour = { '4h': 0, '6h': 0, '8h': 0, '10h': 0, '12h': 0 };
  state.orcamento.valoresTour[horas] = parseFloat(val) || 0;
  autoSave();
}

function renderEstadiasReadOnlyForm()''')

# 3. Add to carregarOrcamento or similar
# Inside carregarOrcamento (around lines 936 in app.js probably, but let's check what sets values)
# Wait, let's just make sure when rendering, the baseTour inputs get populated.
if 'document.getElementById(\'clienteDataOrcamento\').value' in js and 'baseTour4h' not in js:
    load_code = '''
  if (!orc.valoresTour) orc.valoresTour = { '4h': 0, '6h': 0, '8h': 0, '10h': 0, '12h': 0 };
  document.getElementById('baseTour4h').value = orc.valoresTour['4h'] || '';
  document.getElementById('baseTour6h').value = orc.valoresTour['6h'] || '';
  document.getElementById('baseTour8h').value = orc.valoresTour['8h'] || '';
  document.getElementById('baseTour10h').value = orc.valoresTour['10h'] || '';
  document.getElementById('baseTour12h').value = orc.valoresTour['12h'] || '';
'''
    js = js.replace("document.getElementById('clienteDataOrcamento').value = orc.cliente?.dataOrcamento || '';", 
                   "document.getElementById('clienteDataOrcamento').value = orc.cliente?.dataOrcamento || '';" + load_code)
    
# 4. Modify addTour and renderToursForm to use dropdown and recalculate discount
# Find renderToursForm in js
render_tours_form = '''
function renderToursForm() {
  const cont = document.getElementById('toursList');
  cont.innerHTML = '';
  state.orcamento.tours.forEach((t, i) => {
    // Calculo do valor com desconto
    let valorFinal = parseFloat(t.valor) || 0;
    if (t.descontoAtivo && t.desconto > 0) {
      valorFinal = valorFinal - (valorFinal * (t.desconto / 100));
    }
    
    const div = document.createElement('div');
    div.className = 'item-row';
    div.dataset.itemId = t.id;
    div.innerHTML = 
      <div class="item-row-header">
        <span class="item-row-num">Tour </span>
        <span class="item-subtotal" id="subtotal-tour-">¥ · </span>
        <button class="btn-remove" onclick="rmTour()">?</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Data</label>
          <input type="date" value="" onchange="updTourField(,'data',this.value)"></div>
        <div class="field"><label>Descrição</label>
          <input type="text" value="" placeholder="Ex: Tour em Tokyo" oninput="updTourField(,'descricao',this.value)"></div>
        <div class="field full-width"><label>Pontos Visitados (um por linha)</label>
          <textarea rows="3" placeholder="Asakusa&#10;Ueno Park&#10;Yanaka Ginza" oninput="updTourField(,'pontos',this.value)"></textarea></div>
        <div class="field"><label>Duração do Tour</label>
          <select onchange="updTourDuracao(, this.value)">
            <option value="" >-- Selecione --</option>
            <option value="4h" >4 horas</option>
            <option value="6h" >6 horas</option>
            <option value="8h" >8 horas</option>
            <option value="10h" >10 horas</option>
            <option value="12h" >12 horas</option>
          </select>
        </div>
        <div class="field"><label>Valor Base do Tour ¥</label>
          <input type="number" id="tour-valor-" value="" placeholder="Ex: 55000"
            oninput="updTourNum(,'valor',this.value)"
            onblur="finalizarNum(,'tour','valor',this.value)"></div>
        <div class="field">
          <label>Desconto Aplicado</label>
          <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
            <label class="toggle"><input type="checkbox"  onchange="updTourToggleDesconto(,this.checked)"><span class="toggle-slider"></span></label>
            <input type="number" value="" placeholder="%" min="0" max="100"
              style="width:80px;padding:8px 10px;border:1px solid var(--border-dk);border-radius:4px;font-family:var(--ff-num);font-size:13px;outline:none"
              
              oninput="updTourNum(,'desconto',this.value)">
            <span style="font-size:12px;color:var(--ink-lt)">%</span>
          </div>
        </div>
        <div class="field full-width"><label>Observações</label>
          <input type="text" id="obs-tour-" value="" placeholder="Ex: 8hrs com guia brasileiro · transporte público" oninput="updTourField(,'observacao',this.value)">
          </div>
      </div>;
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
'''
js = re.sub(r'function renderToursForm\(\) \{.*?\n\}\n(function rmTour|\nfunction rmTour)', render_tours_form.strip() + '\nfunction rmTour', js, flags=re.DOTALL)

# 5. Fix updTourNum to recalculate the subtotal properly with discount
upd_tour_num_new = '''function updTourNum(id, f, rawVal) {
  // Atualiza estado sem re-render — deixa o usuário digitar livremente
  const t = state.orcamento.tours.find(x => x.id === id); if (!t) return;
  t[f] = parseFloat(rawVal) || 0;
  
  // Recalcula o total
  let valorFinal = parseFloat(t.valor) || 0;
  if (t.descontoAtivo && t.desconto > 0) {
    valorFinal = valorFinal - (valorFinal * (t.desconto / 100));
  }
  
  // Só atualiza o subtotal no header, sem re-renderizar o form
  const el = document.getElementById(subtotal-tour-);
  if (el) el.textContent = ¥ · ;
  updateResumo();
}'''
js = re.sub(r'function updTourNum\(id, f, rawVal\) \{.*?\n\}', upd_tour_num_new, js, flags=re.DOTALL)

# 6. calcTotalTours logic in app.js
calc_total_tours_old = '''const totalTours = (state.orcamento.tours||[]).reduce((sum, t) => {
    return sum + (parseFloat(t.valor)||0);
  }, 0);'''
calc_total_tours_new = '''const totalTours = (state.orcamento.tours||[]).reduce((sum, t) => {
    let base = parseFloat(t.valor) || 0;
    if (t.descontoAtivo && t.desconto > 0) base = base - (base * (t.desconto / 100));
    return sum + base;
  }, 0);'''
js = js.replace(calc_total_tours_old, calc_total_tours_new)

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js)
print('JS patched.')
