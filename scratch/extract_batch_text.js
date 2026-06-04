const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const pdf = require('pdf-parse');

const roteirosDir = path.join(__dirname, '..', 'Roteiros');
const outputDir = path.join(__dirname, 'texts');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log("=== INICIANDO EXTRAÇÃO DE TEXTO DOS ROTEIROS ===");

async function processAll() {
  const files = fs.readdirSync(roteirosDir);
  
  for (const file of files) {
    if (file === 'desktop.ini') continue;
    
    const filePath = path.join(roteirosDir, file);
    const ext = path.extname(file).toLowerCase();
    const baseName = path.basename(file, ext);
    const txtOutputPath = path.join(outputDir, `${baseName}.txt`);
    
    console.log(`\n• Processando: ${file}...`);
    
    try {
      if (ext === '.pdf') {
        // Processar PDF
        const dataBuffer = fs.readFileSync(filePath);
        const uint8Array = new Uint8Array(dataBuffer.buffer, dataBuffer.byteOffset, dataBuffer.byteLength);
        const parser = new pdf.PDFParse(uint8Array);
        const res = await parser.getText();
        const text = typeof res === 'string' ? res : (res.text || '');
        
        fs.writeFileSync(txtOutputPath, text, 'utf8');
        console.log(`  ✓ PDF extraído e salvo em: scratch/texts/${baseName}.txt (${text.length} caracteres)`);
      } else if (ext === '.docx') {
        // Processar DOCX usando truque nativo de zip e leitura de XML
        const tempZipPath = path.join(__dirname, 'temp_docx.zip');
        const tempExtractDir = path.join(__dirname, 'temp_docx_extract');
        
        if (fs.existsSync(tempExtractDir)) {
          fs.rmSync(tempExtractDir, { recursive: true, force: true });
        }
        
        // Copiar DOCX como ZIP e descompactar via PowerShell (nativo do Windows)
        fs.copyFileSync(filePath, tempZipPath);
        
        const psCommand = `Expand-Archive -Path "${tempZipPath}" -DestinationPath "${tempExtractDir}" -Force`;
        execSync(`powershell -Command "${psCommand}"`, { stdio: 'ignore' });
        
        const xmlPath = path.join(tempExtractDir, 'word', 'document.xml');
        if (fs.existsSync(xmlPath)) {
          const xmlContent = fs.readFileSync(xmlPath, 'utf8');
          
          // Regex robusta para capturar cada parágrafo <w:p>...</w:p>
          const pMatches = xmlContent.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
          const paragraphTexts = [];
          
          pMatches.forEach(pXml => {
            // Buscar todas as tags w:t neste parágrafo
            const tMatches = pXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
            let pText = '';
            
            tMatches.forEach(tXml => {
              // Extrair conteúdo interno
              const contentMatch = tXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/);
              if (contentMatch) {
                pText += contentMatch[1];
              }
            });
            
            // Decodificar entidades XML básicas
            const decoded = pText
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'");
            
            // Adicionar apenas se não for vazio
            if (decoded.trim().length > 0) {
              paragraphTexts.push(decoded);
            }
          });
          
          let cleanText = paragraphTexts.join('\n');
          
          // Rede de segurança absoluta: Remove qualquer tag XML residual que tenha escapado
          cleanText = cleanText.replace(/<[^>]+>/g, '');
          
          fs.writeFileSync(txtOutputPath, cleanText, 'utf8');
          console.log(`  ✓ DOCX extraído e salvo em: scratch/texts/${baseName}.txt (${cleanText.length} caracteres)`);
        } else {
          console.log(`  ❌ Erro: word/document.xml não encontrado no DOCX descompactado.`);
        }
        
        // Limpar temporários
        if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
        if (fs.existsSync(tempExtractDir)) fs.rmSync(tempExtractDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.error(`  ❌ Erro ao processar arquivo ${file}:`, err);
    }
  }
  
  console.log("\n=== FIM DA EXTRAÇÃO EM LOTE ===");
}

processAll();
