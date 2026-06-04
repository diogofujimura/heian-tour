const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

// 1. Add Estadias rendering logic and functions at the bottom of the file
const estadiasFunctions = `
// ── ESTADIAS ROTEIROS ──────────────────────────────────────────
window.addRotEstadia = function() {
  if (!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {};
  if (!roteiroEmEdicao.cliente.estadias) roteiroEmEdicao.cliente.estadias = [];
  roteiroEmEdicao.cliente.estadias.push({ id: Date.now(), cidade: '', dataInicio: '', dataFim: '', hotel: '' });
  window.renderRotEstadias();
};

window.renderRotEstadias = function() {
  const cont = document.getElementById('rotEstadiasList');
  if (!cont) return;
  cont.innerHTML = '';
  if (!roteiroEmEdicao.cliente || !roteiroEmEdicao.cliente.estadias) return;
  roteiroEmEdicao.cliente.estadias.forEach((est, i) => {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = \`
      <div class="item-row-header">
        <span class="item-row-num">Estadia \${i+1}</span>
        <button class="btn-remove" onclick="rmRotEstadia(\${est.id})">✕</button>
      </div>
      <div class="form-grid-4">
        <div class="field"><label>Cidade</label><input type="text" value="\${est.cidade}" placeholder="Ex: Tokyo" oninput="updRotEstadia(\${est.id},'cidade',this.value)"></div>
        <div class="field"><label>Data Início</label><input type="date" value="\${est.dataInicio}" oninput="updRotEstadia(\${est.id},'dataInicio',this.value)"></div>
        <div class="field"><label>Data Fim</label><input type="date" value="\${est.dataFim}" oninput="updRotEstadia(\${est.id},'dataFim',this.value)"></div>
        <div class="field"><label>Hotel</label><input type="text" value="\${est.hotel}" placeholder="Ex: The Celestine Tokyo" oninput="updRotEstadia(\${est.id},'hotel',this.value)"></div>
      </div>\`;
    cont.appendChild(div);
  });
};

window.rmRotEstadia = function(id) { 
  if (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.estadias) {
    roteiroEmEdicao.cliente.estadias = roteiroEmEdicao.cliente.estadias.filter(e => e.id !== id); 
    window.renderRotEstadias(); 
  }
};

window.updRotEstadia = function(id, f, v) { 
  if (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.estadias) {
    const e = roteiroEmEdicao.cliente.estadias.find(x => x.id === id); 
    if (e) e[f] = v; 
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnRotAddEstadia');
  if (btn) btn.addEventListener('click', window.addRotEstadia);
});
`;
code += "\\n" + estadiasFunctions;

// 2. Call renderRotEstadias() when opening the editor
const editorSearch = `document.getElementById('rotClienteData').value = roteiroEmEdicao.cliente?.dataOrcamento || '';`;
const editorReplace = `document.getElementById('rotClienteData').value = roteiroEmEdicao.cliente?.dataOrcamento || '';
  window.renderRotEstadias();`;
code = code.replace(editorSearch, editorReplace);

// 3. Remove "Para: [Name]" from both btnGerarRoteiro and btnPrevisualizarRoteiro PDF metadata
// The meta block looks like this:
// \${roteiroEmEdicao.cliente.nome ? \`<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Para</div><div class="pdf-cover-meta-value">\${roteiroEmEdicao.cliente.nome}</div></div>\` : ''}
const metaRemoveNameSearch = `\${roteiroEmEdicao.cliente.nome ? \`<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Para</div><div class="pdf-cover-meta-value">\${roteiroEmEdicao.cliente.nome}</div></div>\` : ''}`;
// Replaces in both occurrences (I'll just loop till none)
while(code.includes(metaRemoveNameSearch)) {
  code = code.replace(metaRemoveNameSearch, ``);
}

// 4. In the PDF generation logic, replace the "Hospedagem Base" single row with the Estadias list 
// We will look for: \${roteiroEmEdicao.cliente.hotel ? \`<div style="flex:1">...</div>\` : ''}
// and remove it, then inject estadiasHTML

const fixVoosBlockSearch = `\${roteiroEmEdicao.cliente.hotel ? \`<div style="flex:1"><div style="font-size:10px; color:var(--gold-dk); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px">Hospedagem Base</div><div style="font-size:14px; color:var(--ink); font-weight:500">\${roteiroEmEdicao.cliente.hotel}</div></div>\` : ''}`;

const estadiasGenerator = `
            \${(roteiroEmEdicao.cliente?.estadias && roteiroEmEdicao.cliente.estadias.length > 0) ? \`<div class="pdf-section">
              <div class="pdf-section-header" style="margin-bottom:16px"><div class="pdf-section-dot"></div><div class="pdf-section-title">Estadias</div></div>
              <div class="pdf-estadias-grid">
                \${roteiroEmEdicao.cliente.estadias.map(e => {
                  const f1 = e.dataInicio ? e.dataInicio.split('-').reverse().slice(0, 2).join('/') : '';
                  const f2 = e.dataFim ? e.dataFim.split('-').reverse().slice(0, 2).join('/') : '';
                  const per = (f1 && f2) ? \`\${f1} - \${f2}\` : f1 || f2 || '';
                  return \`<div class="pdf-estadia-item"><div class="pdf-estadia-cidade">\${e.cidade||'-'}</div>\${per?\`<div class="pdf-estadia-datas">\${per}</div>\`:\`\`} \${e.hotel?\`<div class="pdf-estadia-hotel">\${e.hotel}</div>\`:\`\`}</div>\`;
                }).join('')}
              </div>
            </div><div style="height:30px"></div>\` : ''}`;
            
// Wait, the block was checked with: `\${(roteiroEmEdicao.cliente?.hotel || roteiroEmEdicao.cliente?.vooChegada || roteiroEmEdicao.cliente?.vooPartida) ?`
// We need to change that to just check voos.
const blockConditionSearch = `\${(roteiroEmEdicao.cliente?.hotel || roteiroEmEdicao.cliente?.vooChegada || roteiroEmEdicao.cliente?.vooPartida) ? \`<div style="display:flex; justify-content:space-between; background:var(--bg); border:1px solid #eaeaea; border-radius:8px; padding:20px; margin-bottom:30px;">`;
const blockConditionReplace = `
            \${estadiasGenerator}
            \${(roteiroEmEdicao.cliente?.vooChegada || roteiroEmEdicao.cliente?.vooPartida) ? \`<div style="display:flex; justify-content:space-between; background:var(--bg); border:1px solid #eaeaea; border-radius:8px; padding:20px; margin-bottom:30px;">`;

// We also need to inject estadiasGenerator variable definition above that block.
// We'll just define the variable logic directly in the template string interpolation instead of creating a variable to keep it simple and safe for replacement.

// So let's replace the whole Voos block carefully.

// Let's locate the entire Voos block first.
const blockToReplace = `\${(roteiroEmEdicao.cliente?.hotel || roteiroEmEdicao.cliente?.vooChegada || roteiroEmEdicao.cliente?.vooPartida) ? \`<div style="display:flex; justify-content:space-between; background:var(--bg); border:1px solid #eaeaea; border-radius:8px; padding:20px; margin-bottom:30px;">
              \${roteiroEmEdicao.cliente.hotel ? \`<div style="flex:1"><div style="font-size:10px; color:var(--gold-dk); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px">Hospedagem Base</div><div style="font-size:14px; color:var(--ink); font-weight:500">\${roteiroEmEdicao.cliente.hotel}</div></div>\` : ''}
              \${roteiroEmEdicao.cliente.vooChegada ? \`<div style="flex:1; padding-left:20px; border-left:1px solid #eaeaea"><div style="font-size:10px; color:var(--gold-dk); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px">Voo de Chegada</div><div style="font-size:14px; color:var(--ink); font-weight:500">\${roteiroEmEdicao.cliente.vooChegada}</div></div>\` : ''}
              \${roteiroEmEdicao.cliente.vooPartida ? \`<div style="flex:1; padding-left:20px; border-left:1px solid #eaeaea"><div style="font-size:10px; color:var(--gold-dk); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px">Voo de Partida</div><div style="font-size:14px; color:var(--ink); font-weight:500">\${roteiroEmEdicao.cliente.vooPartida}</div></div>\` : ''}
            </div>\` : ''}`;

const newBlock = `
            \${(roteiroEmEdicao.cliente?.estadias && roteiroEmEdicao.cliente.estadias.length > 0) ? \`<div class="pdf-section" style="margin-bottom:30px">
              <div class="pdf-section-header" style="margin-bottom:16px"><div class="pdf-section-dot"></div><div class="pdf-section-title">Estadias</div></div>
              <div class="pdf-estadias-grid">
                \${roteiroEmEdicao.cliente.estadias.map(e => {
                  const f1 = e.dataInicio ? e.dataInicio.split('-').reverse().slice(0, 2).join('/') : '';
                  const f2 = e.dataFim ? e.dataFim.split('-').reverse().slice(0, 2).join('/') : '';
                  const per = (f1 && f2) ? \`\${f1} - \${f2}\` : f1 || f2 || '';
                  return \`<div class="pdf-estadia-item"><div class="pdf-estadia-cidade">\${e.cidade||'-'}</div>\${per?\`<div class="pdf-estadia-datas">\${per}</div>\`:\`\`} \${e.hotel?\`<div class="pdf-estadia-hotel">\${e.hotel}</div>\`:\`\`}</div>\`;
                }).join('')}
              </div>
            </div>\` : ''}
            \${(roteiroEmEdicao.cliente?.vooChegada || roteiroEmEdicao.cliente?.vooPartida) ? \`<div style="display:flex; justify-content:space-between; background:var(--bg); border:1px solid #eaeaea; border-radius:8px; padding:20px; margin-bottom:30px;">
              \${roteiroEmEdicao.cliente.vooChegada ? \`<div style="flex:1"><div style="font-size:10px; color:var(--gold-dk); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px">Voo de Chegada</div><div style="font-size:14px; color:var(--ink); font-weight:500">\${roteiroEmEdicao.cliente.vooChegada}</div></div>\` : ''}
              \${roteiroEmEdicao.cliente.vooPartida ? \`<div style="flex:1; padding-left:20px; border-left:1px solid #eaeaea"><div style="font-size:10px; color:var(--gold-dk); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px">Voo de Partida</div><div style="font-size:14px; color:var(--ink); font-weight:500">\${roteiroEmEdicao.cliente.vooPartida}</div></div>\` : ''}
            </div>\` : ''}`;

while(code.includes(blockToReplace)) {
  code = code.replace(blockToReplace, newBlock);
}

fs.writeFileSync('public/js/roteiros.js', code);
console.log('Patched JS logic for estadias in PDF body');
