const fs = require('fs');
const path = require('path');

const filePath = "C:\\Users\\User\\.gemini\\antigravity\\brain\\f78dd171-abe1-4a86-ac38-22ce2edd7278\\.system_generated\\steps\\537\\content.md";

if (fs.existsSync(filePath)) {
  const data = fs.readFileSync(filePath, 'utf8');
  const matches = new Set();
  
  // Buscar no JSON/HTML usando RegExp do JS
  const patterns = [
    '"([^"]*\\.(?:pdf|docx|doc|xls|xlsx|png|jpg|jpeg))"',
    '"([^"]*Roteiro[^"]*)"',
    '"([^"]*Itinerario[^"]*)"',
    '"([^"]*Cotacao[^"]*)"',
    '>([^<]*Roteiro[^<]*)<',
    '>([^<]*Itinerário[^<]*)<',
    '>([^<]*Proposta[^<]*)<'
  ];
  
  patterns.forEach(p => {
    try {
      const regex = new RegExp(p, 'gi');
      let match;
      while ((match = regex.exec(data)) !== null) {
        matches.add(match[1]);
      }
    } catch(err) {
      // Ignora erro de compilação de regex
    }
  });
  
  console.log("=== ARQUIVOS ENCONTRADOS NO DRIVE ===");
  let count = 0;
  const list = Array.from(matches).sort();
  list.forEach(m => {
    const mClean = m.trim();
    // Filtros para pegar apenas títulos plausíveis
    if (mClean.length > 5 && mClean.length < 100 && !mClean.includes('\\') && !mClean.includes('/') && !mClean.includes('{') && !mClean.includes('}')) {
      console.log(`- ${mClean}`);
      count++;
    }
  });
  
  if (count === 0) {
    console.log("Nenhum nome de arquivo óbvio extraído. Vamos fazer um dump de trechos de texto com palavras chave.");
    const lines = data.split('\n');
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes('roteiro') || line.toLowerCase().includes('pdf') || line.toLowerCase().includes('heian')) {
        if (line.length < 200 && line.length > 10) {
          console.log(`Linha ${index}: ${line.trim()}`);
        }
      }
    });
  }
} else {
  console.log("Arquivo content.md não encontrado.");
}
