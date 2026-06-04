const fs = require('fs');

let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

// Helper to format string
const helper = `
window.formatarPessoas = function(el) {
  let text = [];
  if (el.adultos) text.push(el.adultos + (el.adultos > 1 ? ' Adultos' : ' Adulto'));
  if (el.criancas) text.push(el.criancas + (el.criancas > 1 ? ' Crianças' : ' Criança'));
  // fallback for legacy
  if (text.length === 0 && el.passageiros) return el.passageiros + (el.passageiros > 1 ? ' Passageiros' : ' Passageiro');
  return text.join(', ');
};
`;

if (!code.includes('window.formatarPessoas')) {
  code = code.replace(
    /window\.selecionarTransporte = function/,
    `${helper}\nwindow.selecionarTransporte = function`
  );
}

// 1. renderEditDias for transporte
code = code.replace(
  /<div style="flex:1">\s*<label style="font-size:10px;color:var\(--ink-mid\)">Qtd\. Pessoas<\/label>\s*<input type="number" value="\$\{el\.passageiros \|\| \(\(roteiroEmEdicao\.cliente && roteiroEmEdicao\.cliente\.adultos\) \|\| 0\) \+ \(\(roteiroEmEdicao\.cliente && roteiroEmEdicao\.cliente\.criancas\) \|\| 0\) \|\| 2\}" onchange="updElementoEdit\(\$\{idx\}, \$\{eIdx\}, 'passageiros', this\.value\)">\s*<\/div>/g,
  `<div style="flex:1">
                  <label style="font-size:10px;color:var(--ink-mid)">Adultos</label>
                  <input type="number" value="\${el.adultos !== undefined ? el.adultos : (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.adultos) || 2}" onchange="updElementoEdit(\${idx}, \${eIdx}, 'adultos', parseInt(this.value)||0)">
                </div>
                <div style="flex:1">
                  <label style="font-size:10px;color:var(--ink-mid)">Crianças</label>
                  <input type="number" value="\${el.criancas !== undefined ? el.criancas : (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.criancas) || 0}" onchange="updElementoEdit(\${idx}, \${eIdx}, 'criancas', parseInt(this.value)||0)">
                </div>`
);

// 2. Timeline Preview (renderizarRoteiro) for transporte
code = code.replace(
  /const p = el\.passageiros \? ` \| 👥 \$\{el\.passageiros\} Passag\.` : '';/,
  `const pText = formatarPessoas(el); const p = pText ? \` | 👥 \${pText}\` : '';`
);

// 3. Timeline Preview (renderizarRoteiro) for experiencia
code = code.replace(
  /\$\{el\.passageiros \? ` \| 👥 \$\{el\.passageiros\} Passag\.` : ''\}/g,
  `\${formatarPessoas(el) ? ' | 👥 ' + formatarPessoas(el) : ''}`
);

// 4. PDF Preview (abrirPreviewRoteiro) for experiencia
code = code.replace(
  /const pss = el\.passageiros \? ` - \$\{el\.passageiros\} pax` : '';/g,
  `const pText = formatarPessoas(el); const pss = pText ? \` - \${pText}\` : '';`
);

// 5. PDF Preview (abrirPreviewRoteiro) for transporte (already captured by above replace because the var name is pss)
// Wait, for transporte it also has `const pss = el.passageiros ? ...`. Let's replace globally if any.

// 6. Init passageiros in selecionarTransporte
code = code.replace(
  /if \(!el\.passageiros\) \{\s*el\.passageiros = \(\(roteiroEmEdicao\.cliente && roteiroEmEdicao\.cliente\.adultos\) \|\| 0\) \+ \(\(roteiroEmEdicao\.cliente && roteiroEmEdicao\.cliente\.criancas\) \|\| 0\) \|\| 2;\s*\}/g,
  `if (el.adultos === undefined) el.adultos = parseInt((roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.adultos) || 2);
      if (el.criancas === undefined) el.criancas = parseInt((roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.criancas) || 0);`
);

fs.writeFileSync('public/js/roteiros.js', code);
console.log("Patched!");
