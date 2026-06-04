const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

// 1. ADD COMPRADO HEIAN BADGE (TL & PDF)

// TL Transporte (around line 286)
// Find: </div>\s*<div style="font-size:11px; color:var\(--text-sec\)
code = code.replace(
  /<div style="font-size:12px; color:var\(--text-main\); margin-bottom:4px">\$\{el\.tipoTransporte \|\| 'Deslocamento'\} \(\$\{el\.linha \|\| 'Geral'\}\) - \$\{el\.categoria \|\| 'Normal'\}<\/div>/g,
  `<div style="font-size:12px; color:var(--text-main); margin-bottom:4px">\${el.tipoTransporte || 'Deslocamento'} (\${el.linha || 'Geral'}) - \${el.categoria || 'Normal'} \${el.compradoHeian ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em">✅ Emitido p/ Heian</span>' : ''}</div>`
);

// TL Experiencia (around line 297)
code = code.replace(
  /<div style="font-size:12px; color:var\(--text-main\); margin-bottom:4px">\$\{el\.nomeExp \|\| 'Experiência a definir'\}<\/div>/g,
  `<div style="font-size:12px; color:var(--text-main); margin-bottom:4px">\${el.nomeExp || 'Experiência a definir'} \${el.compradoHeian ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em">✅ Emitido p/ Heian</span>' : ''}</div>`
);
code = code.replace(
  /<div style="font-size:12px; color:var\(--text-main\); margin-bottom:4px">\$\{el\.nomeExp \|\| 'Experincias a definir'\}<\/div>/g,
  `<div style="font-size:12px; color:var(--text-main); margin-bottom:4px">\${el.nomeExp || 'Experiência a definir'} \${el.compradoHeian ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em">✅ Emitido p/ Heian</span>' : ''}</div>`
);
code = code.replace(
  /<div style="font-size:12px; color:var\(--text-main\); margin-bottom:4px">\$\{el\.nomeExp \|\| 'Experincia a definir'\}<\/div>/g,
  `<div style="font-size:12px; color:var(--text-main); margin-bottom:4px">\${el.nomeExp || 'Experiência a definir'} \${el.compradoHeian ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em">✅ Emitido p/ Heian</span>' : ''}</div>`
);


// PDF Transporte (around line 509)
code = code.replace(
  /<div style="font-size:11px; color:var\(--text-sec\); margin-top:2px">\$\{transpNome\}\$\{ctg\}\$\{pss\}<\/div>/g,
  `<div style="font-size:11px; color:var(--text-sec); margin-top:2px">\${transpNome}\${ctg}\${pss} \${el.compradoHeian ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em">✅ Emitido p/ Heian</span>' : ''}</div>`
);

// PDF Experiencia (around line 489)
code = code.replace(
  /<div style="font-size:13px; color:var\(--text-main\); font-weight:600">\$\{nomeExp\}<\/div>/g,
  `<div style="font-size:13px; color:var(--text-main); font-weight:600">\${nomeExp} \${el.compradoHeian ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em">✅ Emitido p/ Heian</span>' : ''}</div>`
);

// 2. ADD COMPRADO HEIAN CHECKBOX (EDITOR)

// Transporte (around line 690)
const trCheckboxStr = `</div>
              <div class="field" style="margin:0; display:flex; align-items:flex-end">
                <label style="font-size:11px; color:var(--ink-mid); display:flex; align-items:center; cursor:pointer; height:34px">
                  <input type="checkbox" \${el.compradoHeian ? 'checked' : ''} onchange="updElementoEdit(\${idx}, \${eIdx}, 'compradoHeian', this.checked)" style="margin-right:4px"> Emitido p/ Heian
                </label>
              </div>
            </div>`;
code = code.replace(
  /onchange="updElementoEdit\(\$\{idx\}, \$\{eIdx\}, 'criancas', parseInt\(this\.value\)\|\|0\)" style="width:50px">\s*<\/div>\s*<\/div>/g,
  `onchange="updElementoEdit(\${idx}, \${eIdx}, 'criancas', parseInt(this.value)||0)" style="width:50px">\n              ${trCheckboxStr}`
);

// 3. EDIT DIA HEADER (EDITOR)
const diaSearch = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid #eee; padding-bottom:12px">
        <h4 style="margin:0; font-family:var(--ff-display); color:var(--crimson); font-size:18px">Dia \${idx + 1}</h4>
        <div>
          <label style="font-size:12px; margin-right:12px; cursor:pointer">
            <input type="checkbox" \${dia.tourGuiado ? 'checked' : ''} onchange="updDiaEdit(\${idx}, 'tourGuiado', this.checked)">
            Tour Guiado
          </label>
          <button class="btn-secondary" onclick="delDia(\${idx})" style="padding:4px 8px; font-size:12px; border-color:#ff4444; color:#ff4444">Excluir Dia</button>
        </div>
      </div>`;
      
const diaReplace = `<div style="display:flex; justify-content:space-between; align-items:center; margin:-20px -20px 16px -20px; border-radius:8px 8px 0 0; padding:12px 20px; background:var(--crimson); color:white">
        <h4 style="margin:0; font-family:var(--ff-display); color:white; font-size:18px">Dia \${idx + 1}</h4>
        <div style="display:flex; align-items:center;">
          <label style="font-size:12px; margin-right:12px; cursor:pointer; color:white; display:flex; align-items:center;">
            <input type="checkbox" \${dia.tourGuiado ? 'checked' : ''} onchange="updDiaEdit(\${idx}, 'tourGuiado', this.checked)" style="margin-right:4px">
            Tour Guiado
          </label>
          <button class="btn-secondary" onclick="delDia(\${idx})" style="padding:4px 8px; font-size:12px; border-color:white; color:white; background:transparent">Excluir Dia</button>
        </div>
      </div>`;

code = code.replace(diaSearch, diaReplace);

fs.writeFileSync('public/js/roteiros.js', code);
console.log('Patched features');
