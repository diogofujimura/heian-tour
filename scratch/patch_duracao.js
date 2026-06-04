const fs = require('fs');
let content = fs.readFileSync('public/js/roteiros.js', 'utf-8');

// Update UI Editor grid
const regexGrid = /<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px">\s*<div class="field" style="margin:0"><label \s*style="font-size:10px;color:var\(--gold-dk\)">Data<\/label><input type="date" value="\$\{el\.dataDoTour\}" \s*onchange="updElementoEdit\(\$\{idx\}, \$\{eIdx\}, 'dataDoTour', this\.value\)"><\/div>\s*<div class="field" style="margin:0"><label \s*style="font-size:10px;color:var\(--gold-dk\)">Horǭrio<\/label><input type="time" value="\$\{el\.horarioEncontro\}" \s*onchange="updElementoEdit\(\$\{idx\}, \$\{eIdx\}, 'horarioEncontro', this\.value\)"><\/div>\s*<div class="field" style="margin:0"><label \s*style="font-size:10px;color:var\(--gold-dk\)">Local<\/label><input type="text" placeholder="Local\.\.\." \s*value="\$\{el\.localEncontro\}" onchange="updElementoEdit\(\$\{idx\}, \$\{eIdx\}, 'localEncontro', this\.value\)"><\/div>\s*<\/div>/;

const replaceGrid = `<div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px">
                <div class="field" style="margin:0"><label style="font-size:10px;color:var(--gold-dk)">Data</label><input type="date" value="\${el.dataDoTour}" onchange="updElementoEdit(\${idx}, \${eIdx}, 'dataDoTour', this.value)"></div>
                <div class="field" style="margin:0"><label style="font-size:10px;color:var(--gold-dk)">Horário</label><input type="time" value="\${el.horarioEncontro}" onchange="updElementoEdit(\${idx}, \${eIdx}, 'horarioEncontro', this.value)"></div>
                <div class="field" style="margin:0"><label style="font-size:10px;color:var(--gold-dk)">Duração</label><input type="text" placeholder="Ex: 6h" value="\${el.duracaoTour || '6h'}" onchange="updElementoEdit(\${idx}, \${eIdx}, 'duracaoTour', this.value)"></div>
                <div class="field" style="margin:0"><label style="font-size:10px;color:var(--gold-dk)">Local</label><input type="text" placeholder="Local..." value="\${el.localEncontro}" onchange="updElementoEdit(\${idx}, \${eIdx}, 'localEncontro', this.value)"></div>
              </div>`;

// Actually the regex with ǭ might fail. Let's use a robust string replace.
content = content.replace(
  '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px">',
  '<div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px">'
);

content = content.replace(
  /<div class="field" style="margin:0"><label[^>]*>Local<\/label><input type="text" placeholder="Local\.\.\." \s*value="\$\{el\.localEncontro\}" onchange="updElementoEdit\(\$\{idx\}, \$\{eIdx\}, 'localEncontro', this\.value\)"><\/div>/,
  `<div class="field" style="margin:0"><label style="font-size:10px;color:var(--gold-dk)">Duração</label><input type="text" placeholder="Ex: 6h" value="\${el.duracaoTour || ''}" onchange="updElementoEdit(\${idx}, \${eIdx}, 'duracaoTour', this.value)"></div>
   <div class="field" style="margin:0"><label style="font-size:10px;color:var(--gold-dk)">Local</label><input type="text" placeholder="Local..." value="\${el.localEncontro}" onchange="updElementoEdit(\${idx}, \${eIdx}, 'localEncontro', this.value)"></div>`
);


// Update PDF/Preview generators. There are two instances:
// if (el.horarioEncontro) parts.push(`🕒 ${el.horarioEncontro}`);
// We will add duration after horarioEncontro.
content = content.replace(
  /if \(el\.horarioEncontro\) parts\.push\(`[^`]+ \$\{el\.horarioEncontro\}`\);/g,
  `if (el.horarioEncontro) parts.push(\`🕒 \${el.horarioEncontro}\`);
   if (el.duracaoTour) parts.push(\`⏳ \${el.duracaoTour}\`);`
);

// Also in adicionarElemento default
content = content.replace(
  /roteiroEmEdicao\.dias\[idx\]\.elementos\.push\(\{ tipo: 'info', dataDoTour: '', horarioEncontro: '', localEncontro: '' \}\);/g,
  `roteiroEmEdicao.dias[idx].elementos.push({ tipo: 'info', dataDoTour: '', horarioEncontro: '', duracaoTour: '6h', localEncontro: '' });`
);

fs.writeFileSync('public/js/roteiros.js', content, 'utf-8');
console.log('Patched roteiros.js: duracaoTour');
