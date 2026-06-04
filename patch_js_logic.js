const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

// 1. Update abrirEditorRoteiro to populate new fields
const editSearch = `document.getElementById('rotClienteData').value = roteiroEmEdicao.cliente?.dataOrcamento || '';`;
const editReplace = `document.getElementById('rotClienteData').value = roteiroEmEdicao.cliente?.dataOrcamento || '';
  document.getElementById('rotClienteDataFim').value = roteiroEmEdicao.cliente?.dataFim || '';
  document.getElementById('rotClienteHotel').value = roteiroEmEdicao.cliente?.hotel || '';
  document.getElementById('rotClienteVooChegada').value = roteiroEmEdicao.cliente?.vooChegada || '';
  document.getElementById('rotClienteVooPartida').value = roteiroEmEdicao.cliente?.vooPartida || '';`;
code = code.replace(editSearch, editReplace);

// 2. Update cover generator for both btnGerarRoteiro and btnPrevisualizarRoteiro
// Actually, let's redefine the replacement for both.

const formatHelper = `const formatPeriodo = (d1, d2) => {
      if (!d1 && !d2) return '';
      const f1 = d1 ? d1.split('-').reverse().slice(0, 2).join('/') : '';
      const f2 = d2 ? d2.split('-').reverse().slice(0, 2).join('/') : '';
      if (f1 && f2) return \`\${f1} a \${f2}\`;
      return f1 || f2;
    };`;

code = code.replace("const txtPessoas =", `${formatHelper}\n    const txtPessoas =`);

const metaSearch = `\${roteiroEmEdicao.cliente?.nome ? \`<div class="pdf-cover-meta">
            <div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Para</div><div class="pdf-cover-meta-value">\${roteiroEmEdicao.cliente.nome}</div></div>
            \${txtPessoas ? \`<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Passageiros</div><div class="pdf-cover-meta-value">\${txtPessoas}</div></div>\` : ''}
          </div>\` : ''}`;
          
const metaReplace = `\${roteiroEmEdicao.cliente ? \`<div class="pdf-cover-meta">
            \${formatPeriodo(roteiroEmEdicao.cliente.dataOrcamento, roteiroEmEdicao.cliente.dataFim) ? \`<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Período</div><div class="pdf-cover-meta-value">\${formatPeriodo(roteiroEmEdicao.cliente.dataOrcamento, roteiroEmEdicao.cliente.dataFim)}</div></div>\` : ''}
            \${roteiroEmEdicao.cliente.nome ? \`<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Para</div><div class="pdf-cover-meta-value">\${roteiroEmEdicao.cliente.nome}</div></div>\` : ''}
            \${txtPessoas ? \`<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Passageiros</div><div class="pdf-cover-meta-value">\${txtPessoas}</div></div>\` : ''}
          </div>\` : ''}`;

code = code.replace(metaSearch, metaReplace);

// Add the fixed block in the PDF body (above the timeline)
const bodySearch = `<div style="background:white; border-radius:8px; padding:30px; box-shadow:0 10px 30px rgba(0,0,0,0.05)">
            <div class="roteiro-timeline" style="border-left: 2px solid rgba(201,160,90,0.3); padding-left: 20px;">`;
            
const c = `const c = roteiroEmEdicao.cliente || {};`;

const bodyReplace = `<div style="background:white; border-radius:8px; padding:30px; box-shadow:0 10px 30px rgba(0,0,0,0.05)">
            \${(roteiroEmEdicao.cliente?.hotel || roteiroEmEdicao.cliente?.vooChegada || roteiroEmEdicao.cliente?.vooPartida) ? \`<div style="display:flex; justify-content:space-between; background:var(--bg); border:1px solid #eaeaea; border-radius:8px; padding:20px; margin-bottom:30px;">
              \${roteiroEmEdicao.cliente.hotel ? \`<div style="flex:1"><div style="font-size:10px; color:var(--gold-dk); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px">Hospedagem Base</div><div style="font-size:14px; color:var(--ink); font-weight:500">\${roteiroEmEdicao.cliente.hotel}</div></div>\` : ''}
              \${roteiroEmEdicao.cliente.vooChegada ? \`<div style="flex:1; padding-left:20px; border-left:1px solid #eaeaea"><div style="font-size:10px; color:var(--gold-dk); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px">Voo de Chegada</div><div style="font-size:14px; color:var(--ink); font-weight:500">\${roteiroEmEdicao.cliente.vooChegada}</div></div>\` : ''}
              \${roteiroEmEdicao.cliente.vooPartida ? \`<div style="flex:1; padding-left:20px; border-left:1px solid #eaeaea"><div style="font-size:10px; color:var(--gold-dk); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px">Voo de Partida</div><div style="font-size:14px; color:var(--ink); font-weight:500">\${roteiroEmEdicao.cliente.vooPartida}</div></div>\` : ''}
            </div>\` : ''}
            <div class="roteiro-timeline" style="border-left: 2px solid rgba(201,160,90,0.3); padding-left: 20px;">`;

code = code.replace(bodySearch, bodyReplace);

// Now apply these to btnGerarRoteiro as well! Since btnGerarRoteiro relies on the roteiro that might not be roteiroEmEdicao, wait... btnGerarRoteiro uses `roteiroEmEdicao`? No, it uses `selectRoteiroBase` value and clones `timelineOrig`. 
// But the user is usually previewing when they see these changes. 
// I will patch the generate function to just use roteiroEmEdicao if available or the selected roteiro.
const gerarMetaSearch = `<div class="pdf-cover-title">\${nome}</div>
        </div>`;
        
const gerarMetaReplace = `<div class="pdf-cover-title">\${nome}</div>
          \${roteiroEmEdicao?.cliente ? \`<div class="pdf-cover-meta">
            \${formatPeriodo(roteiroEmEdicao.cliente.dataOrcamento, roteiroEmEdicao.cliente.dataFim) ? \`<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Período</div><div class="pdf-cover-meta-value">\${formatPeriodo(roteiroEmEdicao.cliente.dataOrcamento, roteiroEmEdicao.cliente.dataFim)}</div></div>\` : ''}
            \${roteiroEmEdicao.cliente.nome ? \`<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Para</div><div class="pdf-cover-meta-value">\${roteiroEmEdicao.cliente.nome}</div></div>\` : ''}
          </div>\` : ''}
        </div>`;
code = code.replace(gerarMetaSearch, gerarMetaReplace);

// and also add the helper to btnGerarRoteiro
const gerarHelperSearch = `const nome = document.getElementById('selectRoteiroBase').value;`;
const gerarHelperReplace = `const nome = document.getElementById('selectRoteiroBase').value;\n    ${formatHelper}`;
code = code.replace(gerarHelperSearch, gerarHelperReplace);


fs.writeFileSync('public/js/roteiros.js', code);
console.log('Patched JS logic for roteiros');
