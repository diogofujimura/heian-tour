const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

const regex = /const disponiveis = atracoesDaCidade\.filter\(a => !window\._tempAtracoesSelecionadas\.includes\(a\)\);/g;
const replacement = `const busca = (document.getElementById('modalRotSearch')?.value || '').trim().toLowerCase();
    const disponiveis = atracoesDaCidade.filter(a => !window._tempAtracoesSelecionadas.includes(a) && a.toLowerCase().includes(busca));`;

code = code.replace(regex, replacement);

fs.writeFileSync('public/js/app.js', code, 'utf8');
console.log('Filter patch applied successfully.');
