const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'texts', 'Heian Tour - Rascunho de Roteiro Família Katz.txt');
const text = fs.readFileSync(filePath, 'utf8');
const lines = text.split('\n');

console.log("=== LINHAS 235 A 260 ===");
for (let i = 235; i <= 260; i++) {
  console.log(`${i+1}: [${lines[i].trim()}]`);
}
