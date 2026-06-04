const fs = require('fs');
const js = fs.readFileSync('public/js/roteiros.js', 'utf8');
const lines = js.split('\n');
const start = lines.findIndex(l => l.includes("el.tipo === 'transporte'") && l.includes("else if"));
console.log(lines.slice(start - 2, start + 30).join('\n'));
