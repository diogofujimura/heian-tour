const fs = require('fs');
let content = fs.readFileSync('public/js/app.js', 'utf-8');

// 1. calcTotalTransporte
content = content.replace(
  /let base = \(t\.preco\|\|0\) \* \(t\.pessoas\|\|1\);/,
  "let base = (t.preco||0) * (t.precoTipo === 'grupo' ? 1 : (t.pessoas||1));"
);

// 2. calcTotalExp
content = content.replace(
  /let base = \(e\.preco\|\|0\) \* \(e\.pessoas\|\|1\);/,
  "let base = (e.preco||0) * (e.precoTipo === 'grupo' ? 1 : (e.pessoas||1));"
);

// 3. updTranspRefresh & updExpRefresh
content = content.replace(
  /t\[f\] = \(f==='taxaTipo'\) \? v : \(parseFloat\(v\)\|\|0\);/,
  "t[f] = (f==='taxaTipo' || f==='precoTipo') ? v : (parseFloat(v)||0);"
);
content = content.replace(
  /e\[f\] = \(f==='taxaTipo'\) \? v : \(parseFloat\(v\)\|\|0\);/,
  "e[f] = (f==='taxaTipo' || f==='precoTipo') ? v : (parseFloat(v)||0);"
);

// 4. renderTransportesForm HTMl
const regexTranspField = /<div class="field"><label>Valor Unitǭrio <\/label>\s*<input type="number" value="\$\{t\.preco\|\|''\}"\s*oninput="updTranspNum\(\$\{t\.id\},'preco',this\.value\)"\s*onblur="updTranspRefresh\(\$\{t\.id\},'preco',this\.value\)"><\/div>/;

const replaceTranspField = `<div class="field" style="min-width: 200px"><label>Valor ¥</label>
            <div style="display:flex; gap:4px">
              <input type="number" value="\${t.preco||''}" oninput="updTranspNum(\${t.id},'preco',this.value)" onblur="updTranspRefresh(\${t.id},'preco',this.value)" style="flex:1">
              <select onchange="updTranspRefresh(\${t.id},'precoTipo',this.value)" style="width:105px; padding:8px 4px; font-size:12px">
                <option value="pessoa" \${t.precoTipo!=='grupo'?'selected':''}>P/ Pessoa</option>
                <option value="grupo" \${t.precoTipo==='grupo'?'selected':''}>P/ Veículo</option>
              </select>
            </div>
          </div>`;

content = content.replace(regexTranspField, replaceTranspField);

// 5. renderExperienciasForm HTML
const regexExpField = /<div class="field"><label>Valor Unitǭrio <\/label>\s*<input type="number" value="\$\{e\.preco\|\|''\}"\s*oninput="updExpNum\(\$\{e\.id\},'preco',this\.value\)"\s*onblur="updExpRefresh\(\$\{e\.id\},'preco',this\.value\)"><\/div>/;

const replaceExpField = `<div class="field" style="min-width: 200px"><label>Valor ¥</label>
            <div style="display:flex; gap:4px">
              <input type="number" value="\${e.preco||''}" oninput="updExpNum(\${e.id},'preco',this.value)" onblur="updExpRefresh(\${e.id},'preco',this.value)" style="flex:1">
              <select onchange="updExpRefresh(\${e.id},'precoTipo',this.value)" style="width:105px; padding:8px 4px; font-size:12px">
                <option value="pessoa" \${e.precoTipo!=='grupo'?'selected':''}>P/ Pessoa</option>
                <option value="grupo" \${e.precoTipo==='grupo'?'selected':''}>P/ Grupo</option>
              </select>
            </div>
          </div>`;

content = content.replace(regexExpField, replaceExpField);

// 6. Fix PDF generator to show (Fixo) when it's per group
content = content.replace(
  /const trecho=partes\[0\]\|\|t\.descricao\|\|'\?"'; const sub=partes\.slice\(1\)\.join\('  '\);/,
  `const trecho=partes[0]||t.descricao||'—'; const sub=partes.slice(1).join(' / ');
   const isFixo = t.precoTipo === 'grupo';`
);
content = content.replace(
  /<td class="num">\$\{fmt\(t\.preco\)\}<\/td><td class="num">\$\{t\.pessoas\}<\/td>/,
  `<td class="num">¥\${fmt(t.preco)}\${isFixo ? '<br><small>(Fixo)</small>' : ''}</td><td class="num">\${t.pessoas}</td>`
);

content = content.replace(
  /const taxaLabel=!e\.taxaAtiva\?'\?"':\`\$\{fmt\(e\.taxaValor\)\} \(\$\{e\.taxaTipo==='grupo'\?'por grupo':'por pessoa'\}\)\`;/,
  `const taxaLabel=!e.taxaAtiva?'—':\`¥\${fmt(e.taxaValor)} (\${e.taxaTipo==='grupo'?'por grupo':'por pessoa'})\`;
   const isFixoExp = e.precoTipo === 'grupo';`
);
content = content.replace(
  /<td class="num">\$\{fmt\(e\.preco\)\}<\/td><td class="num">\$\{e\.pessoas\}<\/td>/,
  `<td class="num">¥\${fmt(e.preco)}\${isFixoExp ? '<br><small>(Fixo)</small>' : ''}</td><td class="num">\${e.pessoas}</td>`
);


// Save back
fs.writeFileSync('public/js/app.js', content, 'utf-8');
console.log('Patched precoTipo in app.js');
