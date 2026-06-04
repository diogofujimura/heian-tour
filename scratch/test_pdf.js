const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const pdfPath = path.join(__dirname, '..', 'Roteiros', 'HEIAN Tour - Rascunho de Roteiro Sakura Abr 2026.pdf');
const dataBuffer = fs.readFileSync(pdfPath);
const uint8Array = new Uint8Array(dataBuffer.buffer, dataBuffer.byteOffset, dataBuffer.byteLength);

console.log("=== TESTANDO PDFPARSE ===");
try {
  const parser = new pdf.PDFParse(uint8Array);
  console.log("Instanciado com sucesso!");
  console.log("Métodos do parser:", Object.getOwnPropertyNames(Object.getPrototypeOf(parser)));
  
  // Testando chamadas comuns de extração de texto
  if (typeof parser.getText === 'function') {
    parser.getText().then(res => {
      // res pode ser um objeto ou string
      const text = typeof res === 'string' ? res : (res.text || JSON.stringify(res));
      console.log("Texto extraído com sucesso! Comprimento:", text.length);
      console.log(text.slice(0, 1000));
      fs.writeFileSync(path.join(__dirname, 'sakura_raw.txt'), text, 'utf8');
    }).catch(err => {
      console.error("Erro no parser.getText():", err);
    });
  } else {
    console.log("Não existe getText()!");
  }
} catch (err) {
  console.error("Erro ao instanciar ou rodar:", err);
}
