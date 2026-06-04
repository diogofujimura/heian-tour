const fs = require('fs');
const path = require('path');

const textsDir = path.join(__dirname, 'texts');
const files = fs.readdirSync(textsDir);
const katzFile = files.find(f => f.includes('Katz'));

if (katzFile) {
  const filePath = path.join(textsDir, katzFile);
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  
  console.log(`=== LENDO ARQUIVO: ${katzFile} ===`);
  lines.forEach((line, idx) => {
    const lUpper = line.toUpperCase();
    if (lUpper.includes('OPEN AIR') || lUpper.includes('ASHI') || lUpper.includes('HAKONE') || lUpper.includes('FUJI') || lUpper.includes('TÓQUIO') || lUpper.includes('TOKYO')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log("Arquivo Katz não encontrado!");
}
