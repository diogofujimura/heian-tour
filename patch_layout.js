const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

// TL TRANSP: Remove emoji block and match flex-start style
code = code.replace(
  /<div style="margin-bottom:16px; background:linear-gradient\(to right, rgba\(33,150,243,0\.06\), transparent\); border-radius:8px; padding:12px; border-left:4px solid var\(--blue\); display:flex; align-items:center">\s*<div style="font-size:24px; margin-right:16px">\$\{\(el\.tipoTransporte\|\|''\)\.toLowerCase\(\)\.includes\('voo'\) \? '✈️' : '🚅'\}<\/div>/g,
  `<div style="display:flex; align-items:flex-start; margin-bottom:16px; padding:16px; background:linear-gradient(to right, rgba(33,150,243,0.06), transparent); border-radius:8px; border-left:4px solid var(--blue)">`
);

// PDF TRANSP: Remove 🚂 emoji
code = code.replace(
  /<strong style="color:var\(--blue-dk\); font-size:12px; text-transform:uppercase; margin-right:8px">🚂 Deslocamento \$\{horaText\}<\/strong>/g,
  `<strong style="color:var(--blue-dk); font-size:12px; text-transform:uppercase; margin-right:8px">Deslocamento \${horaText}</strong>`
);

fs.writeFileSync('public/js/roteiros.js', code);
console.log("Patched emojis and layout!");
