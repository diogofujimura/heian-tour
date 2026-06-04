const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'texts', 'HEIAN Tour - Rascunho de Roteiro Sakura Abr 2026.txt');
const text = fs.readFileSync(filePath, 'utf8');
const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

console.log("=== DEBUG LINES ===");
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('QUIOTO')) {
    console.log(`Line ${i}: [${line}]`);
    
    // Teste de limpeza
    const lineClean = line.replace(/^[v\*\s\-\>•§🡪à➔—]+/g, '').trim();
    console.log(`Line Clean: [${lineClean}]`);
    
    // Teste de regex
    const cidadesLegitimas = [
      'tokyo', 'tóquio', 'tokio',
      'kyoto', 'quioto',
      'osaka',
      'okinawa'
    ];
    
    for (const cid of cidadesLegitimas) {
      const cidRegex = new RegExp(`^${cid}\\b`, 'i');
      const match = lineClean.match(cidRegex);
      console.log(`Testing [${cid}] with regex [${cidRegex}]: ${match ? 'MATCHED' : 'FAILED'}`);
    }
  }
}
