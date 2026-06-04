const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'texts', 'HEIAN Tour - Roteiro Famílias Flanzer e Gorodovits.docx.txt');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  
  console.log("=== ROTEIRO FLANZER ===");
  lines.forEach((line, idx) => {
    if (line.includes('dedicado') || line.includes('divindades')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log("Arquivo Flanzer não encontrado!");
}
