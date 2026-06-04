const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

// 1. Fix text abbreviation
code = code.replace(
  /const txtPessoas = \(roteiroEmEdicao\.cliente\?\.adultos \? `\$\{roteiroEmEdicao\.cliente\.adultos\} Ad` : ''\) \+ \(roteiroEmEdicao\.cliente\?\.criancas > 0 \? `, \$\{roteiroEmEdicao\.cliente\.criancas\} Cr` : ''\);/g,
  "const txtPessoas = (roteiroEmEdicao.cliente?.adultos ? `${roteiroEmEdicao.cliente.adultos} Adultos` : '') + (roteiroEmEdicao.cliente?.criancas > 0 ? `, ${roteiroEmEdicao.cliente.criancas} Crianças` : '');"
);

// 2. Add logo to header in btnGerarRoteiro
const btnGerarHtmlOld = `<div style="padding:40px; font-family:var(--ff-body)">
        <h1 style="color:var(--crimson); font-family:var(--ff-display); text-align:center; font-size:32px; margin-bottom:10px">Roteiro Personalizado</h1>`;

const btnGerarHtmlNew = `<div style="padding:40px; font-family:var(--ff-body)">
        <div style="text-align:center; margin-bottom:20px"><img src="/assets/logo.png" style="max-height:80px; object-fit:contain;" alt="Heian Tour"></div>
        <h1 style="color:var(--crimson); font-family:var(--ff-display); text-align:center; font-size:32px; margin-bottom:10px">Roteiro Personalizado</h1>`;

code = code.replace(btnGerarHtmlOld, btnGerarHtmlNew);


// 3. Add logo to header in btnPrevisualizarRoteiro
const btnPreviewHtmlOld = `<div style="padding:40px; font-family:var(--ff-body)">
        <h1 style="color:var(--crimson); font-family:var(--ff-display); text-align:center; font-size:32px; margin-bottom:10px">Roteiro Personalizado</h1>`;
        
const btnPreviewHtmlNew = `<div style="padding:40px; font-family:var(--ff-body)">
        <div style="text-align:center; margin-bottom:20px"><img src="/assets/logo.png" style="max-height:80px; object-fit:contain;" alt="Heian Tour"></div>
        <h1 style="color:var(--crimson); font-family:var(--ff-display); text-align:center; font-size:32px; margin-bottom:10px">Roteiro Personalizado</h1>`;

// Note: since they are identical replacements, wait... the string is exactly the same, but wait, btnGerarHtmlOld was exactly the same.
// Did the replace on line 16 replace both occurrences or just the first?
// `code.replace()` string replaces only the first occurrence in Node.js. 
// So doing it twice will replace both.
code = code.replace(btnGerarHtmlOld, btnGerarHtmlNew);

fs.writeFileSync('public/js/roteiros.js', code);
console.log('Patched preview header and abbreviations');
