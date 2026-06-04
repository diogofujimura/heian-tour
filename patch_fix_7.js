const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');
let lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim().endsWith('=')) {
     if (lines[i].includes('innerHTML =')) {
        lines[i] = lines[i] + " '';";
     } else if (lines[i].includes('roteiroOriginalNome =') || lines[i].includes('elementosHtml =')) {
        lines[i] = lines[i] + " '';";
     }
  }
}

fs.writeFileSync('public/js/roteiros.js', lines.join('\n'));
console.log('Fixed syntax on all missing assignments');
