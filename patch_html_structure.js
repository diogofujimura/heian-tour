const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

// Replace btnGerarRoteiro HTML
const gerarSearch = `<div style="padding:40px; font-family:var(--ff-body)">
        <div style="text-align:center; margin-bottom:20px"><img src="/assets/logo.png" style="max-height:80px; object-fit:contain;" alt="Heian Tour"></div>
        <h1 style="color:var(--crimson); font-family:var(--ff-display); text-align:center; font-size:32px; margin-bottom:10px">Roteiro Personalizado</h1>
        <h2 style="color:var(--gold-dk); text-align:center; margin-bottom:40px; letter-spacing:0.05em; text-transform:uppercase">\${nome}</h2>
        <div style="background:white; border-radius:8px; padding:30px; box-shadow:0 10px 30px rgba(0,0,0,0.05)">
          \${timelineOrig.innerHTML}
        </div>
      </div>`;

const gerarReplace = `<div class="pdf-doc">
        <div class="pdf-cover">
          <img src="/assets/logo.png" class="pdf-cover-logo" alt="Heian Tour" onerror="this.style.display='none'">
          <div class="pdf-cover-divider"></div>
          <div class="pdf-cover-label">Roteiro de Viagem</div>
          <div class="pdf-cover-title">\${nome}</div>
        </div>
        <div class="pdf-body">
          <div style="background:white; border-radius:8px; padding:30px; box-shadow:0 10px 30px rgba(0,0,0,0.05)">
            \${timelineOrig.innerHTML}
          </div>
        </div>
      </div>`;
code = code.replace(gerarSearch, gerarReplace);


// Replace btnPrevisualizarRoteiro HTML
const previewSearch = `<div style="padding:40px; font-family:var(--ff-body)">
        <div style="text-align:center; margin-bottom:20px"><img src="/assets/logo.png" style="max-height:80px; object-fit:contain;" alt="Heian Tour"></div>
        <h1 style="color:var(--crimson); font-family:var(--ff-display); text-align:center; font-size:32px; margin-bottom:10px">Roteiro Personalizado</h1>
        <h2 style="color:var(--gold-dk); text-align:center; margin-bottom:10px; letter-spacing:0.05em; text-transform:uppercase">\${document.getElementById('editRoteiroNome').value || 'Pré-visualização'}</h2>
        \${roteiroEmEdicao.cliente?.nome ? \`<div style="text-align:center; color:var(--ink-mid); margin-bottom:30px">Para: <strong>\${roteiroEmEdicao.cliente.nome}</strong> (\${txtPessoas})</div>\` : '<div style="margin-bottom:30px"></div>'}
        <div style="background:white; border-radius:8px; padding:30px; box-shadow:0 10px 30px rgba(0,0,0,0.05)">
          <div class="roteiro-timeline" style="border-left: 2px solid rgba(201,160,90,0.3); padding-left: 20px;">
            \${diasHtml}
          </div>
        </div>
      </div>`;

const previewReplace = `<div class="pdf-doc">
        <div class="pdf-cover">
          <img src="/assets/logo.png" class="pdf-cover-logo" alt="Heian Tour" onerror="this.style.display='none'">
          <div class="pdf-cover-divider"></div>
          <div class="pdf-cover-label">Roteiro de Viagem</div>
          <div class="pdf-cover-title">\${document.getElementById('editRoteiroNome').value || 'Pré-visualização'}</div>
          \${roteiroEmEdicao.cliente?.nome ? \`<div class="pdf-cover-meta">
            <div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Para</div><div class="pdf-cover-meta-value">\${roteiroEmEdicao.cliente.nome}</div></div>
            \${txtPessoas ? \`<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Passageiros</div><div class="pdf-cover-meta-value">\${txtPessoas}</div></div>\` : ''}
          </div>\` : ''}
        </div>
        <div class="pdf-body">
          <div style="background:white; border-radius:8px; padding:30px; box-shadow:0 10px 30px rgba(0,0,0,0.05)">
            <div class="roteiro-timeline" style="border-left: 2px solid rgba(201,160,90,0.3); padding-left: 20px;">
              \${diasHtml}
            </div>
          </div>
        </div>
      </div>`;
code = code.replace(previewSearch, previewReplace);

fs.writeFileSync('public/js/roteiros.js', code);
console.log('Patched preview HTML structure');
