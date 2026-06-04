const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'texts', 'Heian Tour - Rascunho de Roteiro Família Katz.txt');
const text = fs.readFileSync(filePath, 'utf8');
const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

console.log("=== DEBUG KATZ PARSER ===");
let currentCity = 'Tokyo';
let currentDay = '';
let startParsing = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (!startParsing) {
    if (line.includes('CIDADES / ROTAS') || line.match(/^[A-ZÀ-ÿ\s]{3,15}\s*\[\d/)) {
      startParsing = true;
      continue;
    } else {
      continue;
    }
  }
  
  // Detecção de Cidade
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
  
  let detectouCidade = false;
  const lineClean = line.replace(/^[v\*\s\-\>•§🡪à➔—]+/g, '').trim();
  
  for (const cid of cidadesLegitimas) {
    const cidRegex = new RegExp(`^${cid}\\b`, 'i');
    if (lineClean.match(cidRegex)) {
      let rawCity = cid;
      if (rawCity === 'tóquio' || rawCity === 'tokio') rawCity = 'tokyo';
      if (rawCity === 'quioto') rawCity = 'kyoto';
      if (rawCity === 'shirakawa') rawCity = 'shirakawa-go';
      if (rawCity === 'fuji' || rawCity === 'monte fuji') rawCity = 'fujiyoshida';
      
      currentCity = rawCity.charAt(0).toUpperCase() + rawCity.slice(1);
      detectouCidade = true;
      console.log(`[CIDADE] Line ${i+1}: [${line}] -> ${currentCity}`);
      break;
    }
  }
  
  if (detectouCidade) {
    continue;
  }
  
  const dayMatch = line.match(/^Dia\s*(\d{2}\/\d{2})/i);
  if (dayMatch) {
    currentDay = line;
    continue;
  }
  
  let tempLine = line;
  let isAtracao = false;
  let nome = '';
  let descricao = '';
  
  const delimiterMatch = tempLine.match(/^(?:[•§\-*]\s*)?([^–➔—🡪à\-\>]+)\s*(?:–|➔|—|🡪|à|->)\s*(.*)/);
  if (delimiterMatch) {
    nome = delimiterMatch[1].trim();
    descricao = delimiterMatch[2].trim();
    isAtracao = true;
  } else {
    const markerMatch = tempLine.match(/^[•§\-*]\s*(.*)/);
    if (markerMatch) {
      const itemContent = markerMatch[1].trim();
      const parenMatch = itemContent.match(/^([^()]+)\(([^()]+)\)(.*)/);
      if (parenMatch) {
        nome = parenMatch[1].trim();
        descricao = parenMatch[2].trim() + (parenMatch[3] ? ' ' + parenMatch[3].trim() : '');
      } else {
        nome = itemContent;
        descricao = 'Visitação livre programada.';
      }
      isAtracao = true;
    }
  }
  
  if (isAtracao && nome) {
    const nLower = nome.toLowerCase();
    if (nLower.match(/\d{2}:\d{2}/) || nLower.match(/\d{1,2}:\d{2}/) || nLower.match(/\d{2}\s*hrs/) || nLower.match(/\d{2}h/)) continue;
    if (nLower.match(/\d{2}\/\d{2}/)) continue;
    
    if (nome.includes('Open Air') || nome.includes('Ashi')) {
      console.log(`[ATRAÇÃO] Line ${i+1} | City: ${currentCity} | Nome: [${nome}]`);
    }
  }
}
