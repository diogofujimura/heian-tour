const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'texts', 'Rascunho de Roteiro Família Cohen.txt');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');
  console.log("=== ROTEIRO COHEN ===");
  console.log(text);
} else {
  console.log("Arquivo Cohen não encontrado!");
}
