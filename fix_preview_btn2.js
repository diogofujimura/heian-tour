const fs = require('fs');

let js = fs.readFileSync('public/js/roteiros.js', 'utf8');

const regex = /document\.getElementById\('btnGerarRoteiro'\)\.addEventListener\('click',\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(typeof\s*attachChipEvents\s*===\s*'function'\)\s*attachChipEvents\(\);\s*\}\);/;

const newLogic = `document.getElementById('btnGerarRoteiro').addEventListener('click', () => {
    const nome = document.getElementById('selectRoteiroBase').value;
    if (!nome) return;
    
    // Clonar o visual do roteiro para o previewOverlay (o mesmo usado pelo Orçamento)
    const previewCont = document.getElementById('previewContainer');
    const timelineOrig = document.getElementById('roteiroTimeline');
    if (!previewCont || !timelineOrig) return;

    const isEditMode = document.getElementById('roteiroEditContainer') && document.getElementById('roteiroEditContainer').style.display !== 'none';
    let cliente = {};
    
    if (isEditMode && typeof roteiroEmEdicao !== 'undefined' && roteiroEmEdicao.cliente) {
        cliente = roteiroEmEdicao.cliente;
    } else if (dbRotas[nome] && dbRotas[nome].cliente) {
        cliente = dbRotas[nome].cliente;
    }
    
    const txtPessoas = (cliente.adultos ? \`\${cliente.adultos} Adultos\` : '') + (cliente.criancas > 0 ? \`, \${cliente.criancas} Crianças\` : '');
    
    // Configura o visual da exportação
    previewCont.innerHTML = \`
      <div class="pdf-doc">
        <div class="pdf-cover">
          <img src="/assets/logo.png" class="pdf-cover-logo" alt="Heian Tour" onerror="this.style.display='none'">
          <div class="pdf-cover-divider"></div>
          <div class="pdf-cover-label">Roteiro de Viagem</div>
          <div class="pdf-cover-title">\${nome}</div>
          \${Object.keys(cliente).length > 0 ? \`<div class="pdf-cover-meta">
            \${window.formatPeriodo(cliente.dataOrcamento, cliente.dataFim) ? \`<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Período</div><div class="pdf-cover-meta-value">\${window.formatPeriodo(cliente.dataOrcamento, cliente.dataFim)}</div></div>\` : ''}
            \${txtPessoas ? \`<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Passageiros</div><div class="pdf-cover-meta-value">\${txtPessoas}</div></div>\` : ''}
          </div>\` : ''}
        </div>
        <div class="pdf-body">
          <div style="background:white; border-radius:8px; padding:30px; box-shadow:0 10px 30px rgba(0,0,0,0.05)">
            \${(cliente.estadias && cliente.estadias.length > 0) ? \`<div class="pdf-section" style="margin-bottom:30px">
              <div class="pdf-section-header" style="margin-bottom:16px"><div class="pdf-section-dot"></div><div class="pdf-section-title">Estadias</div></div>
              <div class="pdf-estadias-grid">
                \${cliente.estadias.map(e => {
                  const f1 = e.dataInicio ? e.dataInicio.split('-').reverse().slice(0, 2).join('/') : '';
                  const f2 = e.dataFim ? e.dataFim.split('-').reverse().slice(0, 2).join('/') : '';
                  const per = (f1 && f2) ? \`\${f1} - \${f2}\` : f1 || f2 || '';
                  return \`<div class="pdf-estadia-item"><div class="pdf-estadia-cidade">\${e.cidade||'-'}</div>\${per?\`<div class="pdf-estadia-datas">\${per}</div>\`:\`\`} \${e.hotel?\`<div class="pdf-estadia-hotel">\${e.hotel}</div>\`:\`\`}</div>\`;
                }).join('')}
              </div>
            </div>\` : ''}
            \${(cliente.vooChegada || cliente.vooPartida) ? \`<div style="display:flex; justify-content:space-between; background:var(--bg); border:1px solid #eaeaea; border-radius:8px; padding:20px; margin-bottom:30px;">
              \${cliente.vooChegada ? \`<div style="flex:1"><div style="font-size:10px; color:var(--gold-dk); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px">Voo de Chegada</div><div style="font-size:14px; color:var(--ink); font-weight:500">\${cliente.vooChegada}</div></div>\` : ''}
              \${cliente.vooPartida ? \`<div style="flex:1; padding-left:20px; border-left:1px solid #eaeaea"><div style="font-size:10px; color:var(--gold-dk); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px">Voo de Partida</div><div style="font-size:14px; color:var(--ink); font-weight:500">\${cliente.vooPartida}</div></div>\` : ''}
            </div>\` : ''}
            <div class="roteiro-timeline" style="border-left: 2px solid rgba(201,160,90,0.3); padding-left: 20px;">
              \${timelineOrig.innerHTML}
            </div>
          </div>
        </div>
      </div>
    \`;
    
    // Esconder botões que possam ter ido junto (empty state, etc) se houver,
    // mas a timeline já é limpa e feita apenas para leitura.
    
    // Mostrar overlay
    document.getElementById('previewOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    if (typeof attachChipEvents === 'function') attachChipEvents();
  });`;

if(regex.test(js)) {
  js = js.replace(regex, newLogic);
  fs.writeFileSync('public/js/roteiros.js', js, 'utf8');
  console.log('Fixed btnGerarRoteiro logic with isEditMode check.');
} else {
  console.log('Regex did not match.');
}
