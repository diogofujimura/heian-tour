const fs = require('fs');
let content = fs.readFileSync('public/js/roteiros.js', 'utf-8');

const regexInput = /<div class="field" style="margin:0"><label style="font-size:10px;color:var\(--gold-dk\)">Duração<\/label><input type="text" placeholder="Ex: 6h" value="\$\{el\.duracaoTour \|\| ''\}" onchange="updElementoEdit\(\$\{idx\}, \$\{eIdx\}, 'duracaoTour', this\.value\)"><\/div>/;

const replaceSelect = `<div class="field" style="margin:0"><label style="font-size:10px;color:var(--gold-dk)">Duração</label><select onchange="updElementoEdit(\${idx}, \${eIdx}, 'duracaoTour', this.value)">
                  <option value="4h" \${el.duracaoTour==='4h'?'selected':''}>4h</option>
                  <option value="5h" \${el.duracaoTour==='5h'?'selected':''}>5h</option>
                  <option value="6h" \${el.duracaoTour==='6h'||!el.duracaoTour?'selected':''}>6h</option>
                  <option value="8h" \${el.duracaoTour==='8h'?'selected':''}>8h</option>
                  <option value="10h" \${el.duracaoTour==='10h'?'selected':''}>10h</option>
                  <option value="12h" \${el.duracaoTour==='12h'?'selected':''}>12h</option>
                </select></div>`;

content = content.replace(regexInput, replaceSelect);

fs.writeFileSync('public/js/roteiros.js', content, 'utf-8');
console.log('Patched duration to select');
