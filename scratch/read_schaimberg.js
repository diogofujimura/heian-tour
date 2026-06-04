const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'texts', 'HEIAN Tour - Roteiro Família Schaimberg.docx.txt');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  
  console.log("=== ROTEIRO SCHAIMBERG ===");
  lines.forEach((line, idx) => {
    if (line.includes('estonteantes') || line.includes('dorme') || line.includes('Yasaka')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log("Arquivo Schaimberg não encontrado!");
}
