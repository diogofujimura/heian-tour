const fs = require('fs');
const path = require('path');

const textsDir = path.join(__dirname, 'texts');
const files = fs.readdirSync(textsDir).filter(f => f.endsWith('.txt'));

const cidadesLegitimas = [
  'tokyo', 'tóquio', 'tokio',
  'kyoto', 'quioto',
  'osaka',
  'okinawa',
  'kanazawa',
  'takayama',
  'nara',
  'hakone',
  'shirakawa-go', 'shirakawa',
  'naoshima',
  'koyasan',
  'hiroshima',
  'miyajima',
  'nikko',
  'monte fuji', 'fuji', 'fujiyoshida'
];

console.log("=== INICIANDO VALIDACÃO COM REGRA DE MAIÚSCULAS ===");

files.forEach(file => {
  const filePath = path.join(textsDir, file);
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  console.log(`\n• Arquivo: ${file}`);
  let currentCity = 'Tokyo (Default)';
  let startParsing = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.toUpperCase().includes('MODELO ALTERNATIVO') || line.toUpperCase().includes('ROTEIRO RESUMIDO POR DIA')) {
      console.log(`  [FIM] Linha ${i+1}: Parada preventiva`);
      break;
    }
    
    if (!startParsing) {
      if (line.includes('CIDADES / ROTAS') || line.match(/^[A-ZÀ-ÿ\s]{3,15}\s*\[\d/)) {
        startParsing = true;
        continue;
      } else {
        continue;
      }
    }
    
    // Nova detecção inteligente de cidade baseada em MAIÚSCULAS
    let detectouCidade = false;
    const temMarcadorAtraction = line.match(/^[•§\-\*▪]/);
    
    if (!temMarcadorAtraction) {
      const lineClean = line.replace(/^[v\*\s\-\>•§🡪à➔—]+/g, '').trim();
      const lCleanLower = lineClean.toLowerCase();
      
      // A primeira palavra do cabeçalho da cidade DEVE ser totalmente maiúscula
      const firstWord = lineClean.split(/[^a-zA-ZÀ-ÿ]+/)[0] || '';
      const isUpperCase = firstWord === firstWord.toUpperCase() && firstWord.length >= 3;
      
      if (isUpperCase) {
        for (const cid of cidadesLegitimas) {
          const cidRegex = new RegExp(`^${cid}\\b`, 'i');
          if (lCleanLower.match(cidRegex)) {
            let rawCity = cid;
            if (rawCity === 'tóquio' || rawCity === 'tokio') rawCity = 'tokyo';
            if (rawCity === 'quioto') rawCity = 'kyoto';
            if (rawCity === 'shirakawa') rawCity = 'shirakawa-go';
            if (rawCity === 'fuji' || rawCity === 'monte fuji') rawCity = 'fujiyoshida';
            
            currentCity = rawCity.charAt(0).toUpperCase() + rawCity.slice(1);
            detectouCidade = true;
            console.log(`  ➔ [CIDADE ALTERADA] Linha ${i+1}: "${line}" -> ${currentCity}`);
            break;
          }
        }
      }
    }
  }
});
