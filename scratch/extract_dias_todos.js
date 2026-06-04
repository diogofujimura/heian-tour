const fs = require('fs');
const path = require('path');
const { limparAtracao } = require('./limpeza');

const textsDir = path.join(__dirname, 'texts');
const outputPath = path.join(__dirname, 'dias_todos_roteiros.csv');

// Cidades do Japão para detecção
const cidadesJapao = [
  { regex: /^tokyo\b|^tóquio\b|^tokio\b/i,     nome: 'Tokyo'        },
  { regex: /^kyoto\b|^quioto\b/i,                nome: 'Kyoto'        },
  { regex: /^osaka\b/i,                           nome: 'Osaka'        },
  { regex: /^okinawa\b/i,                         nome: 'Okinawa'      },
  { regex: /^kanazawa\b/i,                        nome: 'Kanazawa'     },
  { regex: /^takayama\b/i,                        nome: 'Takayama'     },
  { regex: /^nara\b/i,                            nome: 'Nara'         },
  { regex: /^hakone\b/i,                          nome: 'Hakone'       },
  { regex: /^shirakawa/i,                         nome: 'Shirakawa-go' },
  { regex: /^hiroshima\b/i,                       nome: 'Hiroshima'    },
  { regex: /^miyajima\b/i,                        nome: 'Miyajima'     },
  { regex: /^nikko\b/i,                           nome: 'Nikko'        },
  { regex: /^naoshima\b/i,                        nome: 'Naoshima'     },
  { regex: /^koyasan\b/i,                         nome: 'Koyasan'      },
  { regex: /^(monte fuji|fuji|fujiyoshida)\b/i,   nome: 'Hakone / Fuji'},
  { regex: /^karuizawa\b/i,                       nome: 'Karuizawa'    },
  { regex: /^himeji\b/i,                          nome: 'Himeji'       },
  { regex: /^corea|coreia|corée/i,               nome: 'Coreia do Sul' },
];

// Detecta cidade em linha de cabeçalho (com ou sem data entre colchetes/parênteses)
function detectarCidade(linha) {
  // Formato 1: "TOKYO [16 – 19/05 ...]" ou "QUIOTO (10 – 13/04)"
  const m1 = linha.match(/^([A-ZÀ-ÿ][A-ZÀ-ÿ\s\-]{1,25}?)\s*[\[(]\s*(?:\d{1,2}|entre)/i);
  const candidato1 = m1 ? m1[1].trim() : null;

  // Formato 2: linha toda é só o nome da cidade em maiúsculas (ex: "OSAKA", "TÓQUIO")
  const m2 = linha.match(/^([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][A-ZÀ-ÿ\s\-]{2,25})$/);
  const candidato2 = m2 ? m2[1].trim() : null;

  for (const cand of [candidato1, candidato2]) {
    if (!cand) continue;
    for (const c of cidadesJapao) {
      if (c.regex.test(cand)) return c.nome;
    }
  }
  return null;
}

// Detecta linha de dia - aceita "Dia 17/05 ..." e "17/05:" e "20/04:"
function detectarDia(linha) {
  // Formato padrão: "Dia dd/mm ..."
  if (/^Dia\s+\d{1,2}\/\d{2}/i.test(linha)) return linha;
  // Formato alternativo: "dd/mm: ..." (sem a palavra "Dia")
  const m = linha.match(/^(\d{1,2}\/\d{2}(?:\/\d{2,4})?)\s*[:\-–]\s*(.+)/);
  if (m) return `Dia ${m[1]}: ${m[2]}`;
  return null;
}

function limparNomeRota(linha) {
  let res = linha;
  
  // Normalizar todos os espaços estranhos/unicode para espaço normal
  res = res.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000\ufeff]/g, ' ');

  // 1. Regex robusta para remover prefixo de data e período no início
  const prefixoRegex = /^(?:Dia\s+)?\d{1,2}\/\d{2}(?:\s*(?:[,/]|e|a|até)\s*\d{1,2}\/\d{2})*(?:\s*\([^)]+\))?\s*(?:\s*[:\-–—➔→🡪à➔]|->)*\s*/i;
  res = res.replace(prefixoRegex, '');

  // 2. Limpar sufixos e setas de tours:
  res = res.replace(/\s*(?:à|→|🡪|➔|->)\s*TOUR.*/gi, '');
  res = res.replace(/\s*🡪\s*Com outro guia:.*/gi, '');

  // 3. Remover durações ou observações entre parênteses comuns nos finais:
  res = res.replace(/\s*\(\d+\s*hrs[^)]*\)/gi, '');
  res = res.replace(/\s*\(\s*com carro[^)]*\)/gi, '');
  res = res.replace(/\s*\(\s*tour guiado[^)]*\)/gi, '');
  
  // 4. Se sobrar "+ Ida a ..." ou "+ Volta ao..." no final do nome da rota
  res = res.replace(/\s*\+\s*(?:Ida\s+a\b|Ida\s+para|Ida\s+de|Volta\s+ao\b|Volta\s+aos\b|Volta\s+a\b|Voo\s+para|trajeto\s+a\b|voo\s+de|trajeto\s+para|volta\s+para).*/gi, '');

  // 5. Se houver setas, traços, espaços ou sinal de mais soltos nas pontas, limpa-os
  res = res.trim().replace(/\s*(?:[:\-–—➔→🡪à➔]|\+|->)\s*$/g, '');

  return res.trim();
}

function nomeLimpo(file) {
  return file
    .replace('.txt', '')
    .replace('Heian Tour - Rascunho de Roteiro ', '')
    .replace('HEIAN Tour - Rascunho de Roteiro ', '')
    .replace('Rascunho de Roteiro ', '')
    .replace('HEIAN Tour - Roteiro Final ', '')
    .replace('HEIAN Tour - Roteiro ', '')
    .replace('Heian Tour - Roteiro ', '')
    .trim();
}

const todosDias = [];

const files = fs.readdirSync(textsDir).filter(f => f.endsWith('.txt'));

console.log('\n=== EXTRAINDO DIAS COMPLETOS DE TODOS OS ROTEIROS ===\n');

files.forEach(file => {
  const roteiroName = nomeLimpo(file);
  const filePath = path.join(textsDir, file);
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let currentCity = 'Tokyo';
  let currentDay = null;
  let startParsing = false;
  let diasDoRoteiro = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Para quando encontrar tabela resumo (final do documento)
    if (
      line.toUpperCase().includes('MODELO ALTERNATIVO') ||
      line.toUpperCase().includes('ROTEIRO RESUMIDO POR DIA') ||
      line.toUpperCase().includes('ROTEIRO POR DIA')
    ) {
      break;
    }

    // Aguarda o início da seção de roteiro diário
    if (!startParsing) {
      if (
        line.toUpperCase().includes('CIDADES / ROTAS') ||
        line.toUpperCase().includes('CIDADES E ROTAS') ||
        detectarCidade(line) !== null
      ) {
        startParsing = true;
        const c = detectarCidade(line);
        if (c) { currentCity = c; continue; }
      }
      continue;
    }

    // Detectar mudança de cidade
    const cidadeDetectada = detectarCidade(line);
    if (cidadeDetectada) {
      currentCity = cidadeDetectada;
      continue;
    }

    // Detectar linha de dia
    const nomeDia = detectarDia(line);
    if (nomeDia) {
      currentDay = nomeDia;
      if (!diasDoRoteiro[currentDay]) {
        diasDoRoteiro[currentDay] = {
          roteiro: roteiroName,
          cidade: currentCity,
          nomeDia: nomeDia,
          atracoes: [],
        };
      }
      continue;
    }

    // Linhas de transporte/logística — ignorar
    if (
      line.startsWith('Trajeto') ||
      line.startsWith('Saída:') ||
      line.startsWith('Chegada:') ||
      line.startsWith('(duração:') ||
      line.startsWith('Duração:') ||
      line.startsWith('Sugestão de horário') ||
      line.startsWith('Encontro com') ||
      line.startsWith('Encontro no') ||
      line.startsWith('Horário a combinar') ||
      line.startsWith('[Almoço') ||
      line.startsWith('*sugestão') ||
      line.startsWith('*Sugestão') ||
      line.startsWith('-- ')
    ) {
      continue;
    }

    // Detectar atração (bullet points: •, §, -, *, è, à como bullet)
    if (currentDay && line.match(/^[•§\-\*➔è]/)) {
      let nome = limparAtracao(line);

      // Filtra nomes que são logística e não atrações
      const ignorar = [
        'sugestão', 'recomendação', 'correio', 'transfer', 'chegada', 'saída',
        'almoço', 'jantar', 'ida a', 'volta ao', 'hotel', 'voo', 'avião',
        'tour guiado', 'sem guia', 'obs:', 'nota:', 'para dar tempo',
        'contratar', 'malas', 'locker', 'mala de mão', 'baldeação',
        'pegar', 'horário a combinar', 'escolher', 'possibilidade'
      ];
      const nLower = nome.toLowerCase();
      if (!nome || nome.length > 45 || ignorar.some(t => nLower.includes(t))) {
        continue;
      }
      if (nome.length < 3) continue;

      // Evita duplicatas no mesmo dia
      if (!diasDoRoteiro[currentDay].atracoes.includes(nome)) {
        diasDoRoteiro[currentDay].atracoes.push(nome);
      }
    }
  }

  const qtd = Object.keys(diasDoRoteiro).length;
  console.log(`• ${roteiroName}: ${qtd} dias extraídos`);
  
  Object.values(diasDoRoteiro).forEach(d => todosDias.push(d));
});

// Gerar CSV com BOM UTF-8 para Excel reconhecer corretamente
const esc = val => `"${String(val || '').replace(/"/g, '""')}"`;

// Versão 1: Ponto e Vírgula (Padrão Português - Excel / Sheets)
const headerSemicolon = 'Roteiro;Cidade;Nome da Rota;Atrações do Dia\n';
const rowsSemicolon = todosDias.map(d => {
  return [
    esc(d.roteiro),
    esc(d.cidade),
    esc(limparNomeRota(d.nomeDia)),
    esc(d.atracoes.join(', ')),
  ].join(';');
}).join('\n');

fs.writeFileSync(outputPath, '\uFEFF' + headerSemicolon + rowsSemicolon, 'utf8');

// Versão 2: Vírgula (Padrão Inglês/Internacional - Google Sheets padrão)
const outputPathComma = outputPath.replace('.csv', '_comma.csv');
const headerComma = 'Roteiro,Cidade,Nome da Rota,Atrações do Dia\n';
const rowsComma = todosDias.map(d => {
  return [
    esc(d.roteiro),
    esc(d.cidade),
    esc(limparNomeRota(d.nomeDia)),
    esc(d.atracoes.join(', ')),
  ].join(',');
}).join('\n');

fs.writeFileSync(outputPathComma, '\uFEFF' + headerComma + rowsComma, 'utf8');

console.log(`\n======================================================`);
console.log(`✓ SUCESSO! ${todosDias.length} dias/rotas extraídos no total.`);
console.log(`Versão Ponto e Vírgula (;) salva em: scratch/dias_todos_roteiros.csv`);
console.log(`Versão Vírgula (,) salva em: scratch/dias_todos_roteiros_comma.csv`);
console.log(`======================================================\n`);
