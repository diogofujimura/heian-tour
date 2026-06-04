const fs = require('fs');
const lines = fs.readFileSync('scratch/novidades_atracoes.csv', 'utf8').split('\n');
const names = lines.slice(1).map(l => l.split(';')[2]).filter(Boolean).map(n => n.replace(/(^"|"$)/g, ''));
console.log(names.slice(0, 50));
