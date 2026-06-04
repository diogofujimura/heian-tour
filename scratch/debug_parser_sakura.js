const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'texts', 'HEIAN Tour - Rascunho de Roteiro Sakura Abr 2026.txt');
const text = fs.readFileSync(filePath, 'utf8');
const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

console.log("=== INICIANDO DETECÇÃO PASSO A PASSO ===");
let currentCity = 'Tokyo';
let currentDay = '';
let startParsing = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.toUpperCase().includes('MODELO ALTERNATIVO') || line.toUpperCase().includes('ROTEIRO RESUMIDO POR DIA')) {
    console.log(`PAROU EM LINHA ${i}: [${line}]`);
    break;
  }
  
  if (!startParsing) {
    if (line.includes('CIDADES / ROTAS') || line.match(/^[A-ZÀ-ÿ\s]{3,15}\s*\[\d/)) {
      startParsing = true;
      console.log(`[START PARSING] at line ${i}: [${line}]`);
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
      console.log(`[CIDADE DETECTADA] line ${i}: [${line}] -> ${currentCity}`);
      break;
    }
  }
  
  if (detectouCidade) {
    continue;
  }
  
  const dayMatch = line.match(/^Dia\s*(\d{2}\/\d{2})/i);
  if (dayMatch) {
    currentDay = line;
    console.log(`[DIA DETECTADO] line ${i}: [${line}]`);
    continue;
  }
  
  // Ignorar ruídos
  if (
    line.startsWith('Trajeto') || 
    line.startsWith('Saída:') || 
    line.startsWith('Chegada:') || 
    line.startsWith('(duração:') ||
    line.startsWith('Duração da viagem:') ||
    line.startsWith('Sugestão de horário:') ||
    line.startsWith('Horário recomendado:') ||
    line.startsWith('Encontro com') ||
    line.startsWith('Encontro no') ||
    line.startsWith('Check-in no') ||
    line.startsWith('Check in no') ||
    line.startsWith('Check-out') ||
    line.startsWith('Checkout') ||
    line.startsWith('X') ||
    line.startsWith('!') ||
    line.match(/^[0-9]{2}\/[0-9]{2}/)
  ) {
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
    
    // Ignorar ruídos adicionais
    if (nLower.match(/\d{2}:\d{2}/) || nLower.match(/\d{1,2}:\d{2}/) || nLower.match(/\d{2}\s*hrs/) || nLower.match(/\d{2}h/)) continue;
    if (nLower.match(/\d{2}\/\d{2}/)) continue;
    
    const ruidoKeywords = [
      'parceria', 'estadias', 'chegada', 'saída', 'voo', 'retorno', 'sugestão', 
      'recomendação', 'lobby', 'hotel', 'check-in', 'check-out', 'checkout', 
      'traslado', 'transfer', 'aeroporto', 'alternativo', 'resumido', 
      'of 18', 'of 16', 'of 12', 'of 14', 'datas', 'datas:', 'datas ', 'hotéis', 'datas\t',
      'júlia', 'ana:', 'samy', 'gabriel:', 'fred', 'carol', 'membros', 'florence'
    ];
    let temRuido = false;
    for (const keyword of ruidoKeywords) {
      if (nLower.includes(keyword)) {
        temRuido = true;
        break;
      }
    }
    if (temRuido) continue;
    
    if (nome.length < 3 || nome.length > 65) continue;
    
    nome = nome.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    descricao = descricao.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    
    console.log(`[ATRAÇÃO DETECTADA] line ${i} | Cidade: ${currentCity} | Nome: [${nome}] | Desc: [${descricao}]`);
  }
}
