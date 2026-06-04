const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'texts', 'Rascunho de Roteiro Família Cohen.txt');
const text = fs.readFileSync(filePath, 'utf8');
const lines = text.split('\n');

console.log("=== ROTEIRO COHEN - PRIMEIRAS 150 LINHAS ===");
for (let i = 0; i < 150 && i < lines.length; i++) {
  console.log(`${i+1}: [${lines[i].trim()}]`);
}
