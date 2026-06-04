const fs = require('fs');

let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

// 1. adicionarElemento
code = code.replace(
  /} else if \(tipo === 'transporte'\) \{/g,
  `} else if (tipo === 'transporte') {`
);
code = code.replace(
  /\} else if \(tipo === 'transporte'\) \{\s*roteiroEmEdicao\.dias\[idx\]\.elementos\.push\(\{ tipo: 'transporte', cidadeOrigem: '', cidadeDestino: '', trechoId: null \}\);\s*\}/,
  `} else if (tipo === 'transporte') {
    roteiroEmEdicao.dias[idx].elementos.push({ tipo: 'transporte', cidadeOrigem: '', cidadeDestino: '', trechoId: null });
  } else if (tipo === 'experiencia') {
    roteiroEmEdicao.dias[idx].elementos.push({ tipo: 'experiencia', filtro: '', expId: null });
  }`
);

// 2. renderEditDias (button)
code = code.replace(
  /<button class="btn-secondary" style="flex:1; border-style:dashed; min-width:120px" onclick="adicionarElemento\(\$\{idx\}, 'transporte'\)">\+ Transporte<\/button>/,
  `<button class="btn-secondary" style="flex:1; border-style:dashed; min-width:120px" onclick="adicionarElemento(\${idx}, 'transporte')">+ Transporte</button>
        <button class="btn-secondary" style="flex:1; border-style:dashed; min-width:120px; color:var(--purple); border-color:var(--purple)" onclick="adicionarElemento(\${idx}, 'experiencia')">+ Experiência</button>`
);

// 3. renderEditDias (UI for element)
const expUIHtml = `
      } else if (el.tipo === 'experiencia') {
        const controles = \`<span style="cursor:pointer; font-size:12px; margin-right:8px; color:var(--ink-mid)" onclick="moverElemento(\${idx}, \${eIdx}, -1)">⬆️</span>\` +
                          \`<span style="cursor:pointer; font-size:12px; margin-right:12px; color:var(--ink-mid)" onclick="moverElemento(\${idx}, \${eIdx}, 1)">⬇️</span>\` +
                          \`<span style="cursor:pointer; color:var(--crimson); font-size:12px" onclick="delElemento(\${idx}, \${eIdx})">Excluir</span>\`;
        elementosHtml += \`
          <div style="border-left: 2px solid var(--purple); padding-left: 12px; margin-bottom: 16px; padding-top:8px; padding-bottom:8px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <strong style="color:var(--purple); font-size:12px">Tickets & Experiências</strong>
              <div>\${controles}</div>
            </div>
            <div style="display:grid; grid-template-columns:1fr; gap:8px; margin-bottom:8px">
              <input type="text" placeholder="Buscar Experiência..." value="\${el.filtro || ''}" oninput="updElementoEdit(\${idx}, \${eIdx}, 'filtro', this.value); atualizarOpcoesExperiencia(\${idx}, \${eIdx})">
              <select id="selExp_\${idx}_\${eIdx}" onchange="selecionarExperiencia(\${idx}, \${eIdx}, this.value)" style="width:100%; font-size:12px; padding:6px">
                <option value="">Digite para buscar...</option>
              </select>
            </div>
            \${el.nomeExp ? \`<div style="font-size:11px; margin-top:8px; color:var(--text-sec)">Selecionado: <strong>\${el.nomeExp}</strong></div>\` : ''}
          </div>
        \`;`;

// Find where the `el.tipo === 'transporte'` UI ends and insert there.
// The end of `transporte` UI is around `</div>\`;\n      }`
code = code.replace(
  /\$\{el\.tipoTransporte \? \`<div style="font-size:11px; margin-top:8px; color:var\(--text-sec\)">Selecionado: <strong>\$\{el\.tipoTransporte\}<\/strong> \(\$\{el\.linha\}\) - \$\{el\.categoria\}<\/div>\` : ''\}
          <\/div>\`;
      }/,
  `\${el.tipoTransporte ? \`<div style="font-size:11px; margin-top:8px; color:var(--text-sec)">Selecionado: <strong>\${el.tipoTransporte}</strong> (\${el.linha}) - \${el.categoria}</div>\` : ''}
          </div>\`;${expUIHtml}
      }`
);

// 4. API functions
const apiFuncs = `
window.atualizarOpcoesExperiencia = function(idx, eIdx) {
  const dia = roteiroEmEdicao.dias[idx];
  if(!dia) return;
  const el = dia.elementos[eIdx];
  if (!el || el.tipo !== 'experiencia') return;

  const filtro = (el.filtro || '').toLowerCase().trim();
  const sel = document.getElementById("selExp_" + idx + "_" + eIdx);
  if (!sel) return;
  
  sel.innerHTML = '<option value="">Carregando...</option>';
  
  const processarExperiencias = (experiencias) => {
    sel.innerHTML = '<option value="">Selecione...</option>';
    let count = 0;
    experiencias.forEach(ex => {
      const nome = (ex.nome || '').toLowerCase();
      if (!filtro || nome.includes(filtro)) {
        const opt = document.createElement('option');
        opt.value = ex.id;
        opt.textContent = ex.nome + ' | ' + ex.tipo;
        if (ex.id == el.expId) opt.selected = true;
        sel.appendChild(opt);
        count++;
      }
    });
    if (count === 0 && filtro) {
       sel.innerHTML = '<option value="">Nenhuma opção encontrada...</option>';
    } else if (count === 0) {
       sel.innerHTML = '<option value="">Digite para filtrar...</option>';
    }
  };

  if (window.dbExperienciasCache) {
    processarExperiencias(window.dbExperienciasCache);
  } else {
    fetch('/api/experiencias').then(r => r.json()).then(exps => {
      window.dbExperienciasCache = exps;
      processarExperiencias(exps);
    }).catch(err => {
      sel.innerHTML = '<option value="">Erro ao carregar</option>';
    });
  }
};

window.selecionarExperiencia = function(idx, eIdx, idExp) {
  const el = roteiroEmEdicao.dias[idx].elementos[eIdx];
  
  const processar = (exps) => {
    const ex = exps.find(x => x.id == idExp);
    if (ex) {
      el.expId = ex.id;
      el.nomeExp = ex.nome;
      el.tipoExp = ex.tipo;
      el.observacao = ex.observacao;
      renderEditDias();
    }
  };

  if (window.dbExperienciasCache) {
    processar(window.dbExperienciasCache);
  } else {
    fetch('/api/experiencias').then(r => r.json()).then(exps => {
      window.dbExperienciasCache = exps;
      processar(exps);
    });
  }
};
`;

if (!code.includes('window.selecionarExperiencia')) {
  code = code.replace(
    /if \(typeof originalRenderEditDias === 'undefined'\) \{/,
    `${apiFuncs}\nif (typeof originalRenderEditDias === 'undefined') {`
  );
}

// 5. Update hacked setTimeout renderEditDias
code = code.replace(
  /if \(el\.tipo === 'transporte' && \(el\.cidadeOrigem \|\| el\.cidadeDestino\)\) \{\s*setTimeout\(\(\) => atualizarOpcoesTransporte\(idx, eIdx\), 0\);\s*\}/,
  `if (el.tipo === 'transporte' && (el.cidadeOrigem || el.cidadeDestino)) {
              setTimeout(() => atualizarOpcoesTransporte(idx, eIdx), 0);
            }
            if (el.tipo === 'experiencia') {
              setTimeout(() => atualizarOpcoesExperiencia(idx, eIdx), 0);
            }`
);

// 6. renderizarRoteiro (Timeline UI)
const timelineUI = `
      } else if (el.tipo === 'experiencia') {
        const h = el.horaPartida ? \`\${el.horaPartida}\` : '';
        html += \`
          <div style="display:flex; align-items:flex-start; margin-bottom:16px; padding:16px; background:var(--bg-alt); border-radius:8px; border-left:4px solid var(--purple)">
             <div style="flex:1">
               <div style="color:var(--purple); font-weight:bold; font-size:13px; font-family:var(--ff-display); text-transform:uppercase; margin-bottom:2px">Tickets & Experiências</div>
               <div style="font-size:12px; color:var(--text-main); margin-bottom:4px">\${el.nomeExp || 'Experiência a definir'}</div>
               <div style="font-size:11px; color:var(--text-sec); font-weight:500">\${h}</div>
             </div>
          </div>\`;`;

code = code.replace(
  /\} else if \(el\.tipo === 'info'\) \{/,
  `} else if (el.tipo === 'info') {`
);
code = code.replace(
  /\} else if \(el\.tipo === 'info'\) \{/,
  `${timelineUI}\n      } else if (el.tipo === 'info') {`
);

// 7. abrirPreviewRoteiro (PDF Preview)
const pdfPreviewUI = `
        } else if (el.tipo === 'experiencia') {
          const nomeExp = el.nomeExp || 'Experiência a definir';
          const hp = el.horaPartida ? \`\${el.horaPartida}\` : '';
          const horaText = hp ? \`<span style="font-weight:normal; margin-left:8px; font-size:10px; color:var(--text-sec)">\${hp}</span>\` : '';
          
          return \`
            <div style="margin-bottom:16px; border-left:3px solid var(--purple); padding-left:12px; background:rgba(156,39,176,0.03); padding-top:8px; padding-bottom:8px; border-radius:0 4px 4px 0">
              <div style="margin-bottom:4px; display:flex; align-items:center">
                <strong style="color:var(--purple); font-size:12px; text-transform:uppercase; margin-right:8px">Tickets & Experiências \${horaText}</strong>
              </div>
              <div style="font-size:13px; color:var(--text-main); font-weight:600">\${nomeExp}</div>
            </div>\`;`;

// Find `} else if (el.tipo === 'info') {` inside `abrirPreviewRoteiro`
const parts = code.split(/\} else if \(el\.tipo === 'info'\) \{/);
// parts[0] has no info, parts[1] is the first one (timeline), parts[2] is the second one (pdf preview).
// We already replaced the first one. Let's do it generally for the preview.
// Better way:
code = code.replace(
  /const hp = el\.horaPartida \? `\$\{el\.horaPartida\}` : '';\s*const horaText = hp \? `<span style="font-weight:normal; margin-left:8px; font-size:10px; color:var\(--text-sec\)">\$\{hp\}<\/span>` : '';\s*return `\s*<div style="margin-bottom:16px; border-left:3px solid var\(--blue\);/,
  `${pdfPreviewUI}
        } else if (el.tipo === 'transporte') {
          const origem = el.cidadeOrigem || '...';
          const destino = el.cidadeDestino || '...';
          const transpNome = el.tipoTransporte ? \`\${el.tipoTransporte} (\${el.linha})\` : 'Deslocamento a definir';
          const ctg = el.categoria ? \` - \${el.categoria}\` : '';
          const pss = el.passageiros ? \` - \${el.passageiros} pax\` : '';
          const hp = el.horaPartida ? \`\${el.horaPartida}\` : '';
          const horaText = hp ? \`<span style="font-weight:normal; margin-left:8px; font-size:10px; color:var(--text-sec)">\${hp}</span>\` : '';

          return \`
            <div style="margin-bottom:16px; border-left:3px solid var(--blue);`
);


fs.writeFileSync('public/js/roteiros.js', code);
console.log("Patched!");
