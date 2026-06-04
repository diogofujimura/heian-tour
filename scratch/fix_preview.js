const fs = require('fs');
let appCode = fs.readFileSync('public/js/app.js', 'utf-8');

// 1. Add calcTotalTour
appCode = appCode.replace(/function addTour\(\) \{/, 'function calcTotalTour(t) {\n  let base = parseFloat(t.valor) || 0;\n  if (t.descontoAtivo && t.desconto > 0) base = base - (base * (t.desconto / 100));\n  return base;\n}\nfunction addTour() {');

// 2. Fix updateResumo
appCode = appCode.replace(
  /const tT = \(state\.orcamento\.tours\|\|\[\]\)\.reduce\(\(sum, t\) => \{\s*let base = parseFloat\(t\.valor\) \|\| 0;\s*if \(t\.descontoAtivo && t\.desconto > 0\) base = base - \(base \* \(t\.desconto \/ 100\)\);\s*return sum \+ base;\s*\}, 0\);/g,
  'const tT = (state.orcamento.tours||[]).reduce((sum, t) => sum + calcTotalTour(t), 0);'
);

// 3. Fix renderPreview tT
appCode = appCode.replace(
  /const tT  = o\.tours\.reduce\(\(s,t\)=>s\+\(t\.valor\|\|0\),0\);/g,
  'const tT  = o.tours.reduce((s,t)=>s+calcTotalTour(t),0);'
);

// 4. Fix tourRows in renderPreview
appCode = appCode.replace(
  /const tourRows = o\.tours\.map\(t=>\{([\s\S]*?)return `<tr><td>\$\{t\.data\?fmtDataBR\(t\.data\):'.+?'\}<\/td><td><div class="pdf-desc-trecho">\$\{t\.descricao\|\|'.+?'\}\$\{duracaoLabel\}<\/div>\$\{pontos\?`<div class="pdf-pontos-wrap">\$\{pontos\}<\/div>`:''\} \$\{t\.observacao\?`<div class="pdf-desc-obs">\$\{t\.observacao\}<\/div>`:''\}<\/td><td class="num">.+?\$\{fmt\(t\.valor\)\}<\/td><td>\$\{t\.descontoAtivo&&t\.desconto\?t\.desconto\+'%':'.+?'\}<\/td><\/tr>`;\s*\}\)\.join\(''\);/g,
  function(match, p1) {
    return 'const tourRows = o.tours.map(t=>{' + p1 +
      '      const finalValor = calcTotalTour(t);\n' +
      '      const isDesc = t.descontoAtivo && t.desconto > 0;\n' +
      '      const valorHTML = isDesc ? `<span style="text-decoration:line-through; font-size:10px; color:#999; display:block">¥${fmt(t.valor)}</span>¥${fmt(finalValor)}` : `¥${fmt(t.valor)}`;\n' +
      '      return `<tr><td>${t.data?fmtDataBR(t.data):\'—\'}</td><td><div class="pdf-desc-trecho">${t.descricao||\'—\'}${duracaoLabel}</div>${pontos?`<div class="pdf-pontos-wrap">${pontos}</div>`:\'\'} ${t.observacao?`<div class="pdf-desc-obs">${t.observacao}</div>`:\'\'}</td><td class="num">${valorHTML}</td><td>${isDesc?t.desconto+\'%\':\'—\'}</td></tr>`;\n    }).join(\'\');';
  }
);

fs.writeFileSync('public/js/app.js', appCode, 'utf-8');
console.log('App.js patched successfully');
