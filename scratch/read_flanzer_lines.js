const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'texts', 'HEIAN Tour - Roteiro Famílias Flanzer e Gorodovits.docx.txt');
const text = fs.readFileSync(filePath, 'utf8');
const lines = text.split('\n');

console.log("=== ROTEIRO FLANZER LINHAS 75 A 95 ===");
for (let i = 75; i <= 95; i++) {
  console.log(`${i+1}: [${lines[i].trim()}]`);
}
