const fs = require('fs');
const lines = fs.readFileSync('public/js/roteiros.js', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes("el.tipo === 'transporte'"));
console.log(lines.slice(Math.max(0, start - 2), start + 25).join('\n'));
