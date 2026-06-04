const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'texts', 'Heian Tour - Rascunho de Roteiro Família Katz.txt');
const text = fs.readFileSync(filePath, 'utf8');
const lines = text.split('\n');

console.log("=== LINHAS 250 A 280 ===");
for (let i = 250; i <= 280; i++) {
  console.log(`${i+1}: [${lines[i].trim()}]`);
}
