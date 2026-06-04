const fs = require('fs');
const path = require('path');

const textsDir = path.join(__dirname, 'texts');

function detectarDia(linha) {
  if (/^Dia\s+\d{1,2}\/\d{2}/i.test(linha)) return linha;
  const m = linha.match(/^(\d{1,2}\/\d{2}(?:\/\d{2,4})?)\s*[:\-–]\s*(.+)/);
  if (m) return `Dia ${m[1]}: ${m[2]}`;
  return null;
}

const files = fs.readdirSync(textsDir).filter(f => f.endsWith('.txt'));

files.forEach(file => {
  const filePath = path.join(textsDir, file);
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let currentDay = null;
  let startParsing = false;

  console.log(`\n=== ARQUIVO: ${file} ===`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (
      line.toUpperCase().includes('MODELO ALTERNATIVO') ||
      line.toUpperCase().includes('ROTEIRO RESUMIDO POR DIA') ||
      line.toUpperCase().includes('ROTEIRO POR DIA')
    ) {
      break;
    }

    if (!startParsing) {
      if (
        line.toUpperCase().includes('CIDADES / ROTAS') ||
        line.toUpperCase().includes('CIDADES E ROTAS') ||
        line.toUpperCase().includes('TOKYO') ||
        line.toUpperCase().includes('KYOTO')
      ) {
        startParsing = true;
      }
      continue;
    }

    const nomeDia = detectarDia(line);
    if (nomeDia) {
      currentDay = nomeDia;
      continue;
    }

    if (currentDay && line.match(/^[•§\-\*➔è]/)) {
      // Limpeza original
      let nomeOriginal = line.replace(/^[•§\-\*➔è\s]+/, '').trim();

      // Limpeza nova proposta
      let nome = line
        .replace(/^[•§\-\*➔è\s]+/, '')         // remove marcador
        .replace(/\s*[–—➔→]\s*.*/s, '')         // remove descrição após separador especial
        .replace(/\s+-\s+.*/s, '')              // remove descrição após hífen com espaços
        .replace(/\s*à\s*.*/s, '')               // remove descrição após "à"
        .replace(/\s*\([^)]*ienes[^)]*\)/gi, '') // remove preço em ienes
        .replace(/\s*\([^)]*reais[^)]*\)/gi, '')  // remove preço em reais
        .trim();

      // Normaliza espaços e tabulações
      nome = nome.replace(/[\s\t\u00A0\u2000-\u200B\u202F\u205F\u3000\ufeff]+/g, ' ');

      // Remove parênteses de descrição no final
      nome = nome.replace(/\s*\([^)]+\)\s*$/, '');

      // Limpa pontuações no final
      nome = nome.replace(/[\.\*\,;\s]+$/, '').trim();

      const ignorar = [
        'sugestão', 'recomendação', 'correio', 'transfer', 'chegada', 'saída',
        'almoço', 'jantar', 'ida a', 'volta ao', 'hotel', 'voo', 'avião',
        'tour guiado', 'sem guia', 'obs:', 'nota:', 'para dar tempo',
        'contratar', 'malas', 'locker', 'mala de mão', 'baldeação',
        'pegar', 'horário a combinar'
      ];
      const nLower = nome.toLowerCase();
      if (ignorar.some(t => nLower.includes(t))) continue;
      if (nome.length < 3) continue;

      if (nomeOriginal.length > 50) {
        console.log(`  Original: "${nomeOriginal.substring(0, 60)}..."`);
        console.log(`  Limpo   : "${nome}"`);
        console.log('  --------------------------------------------');
      }
    }
  }
});
