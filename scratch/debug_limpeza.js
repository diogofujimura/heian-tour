const fs = require('fs');
const path = require('path');

const textsDir = path.join(__dirname, 'texts');

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

function detectarCidade(linha) {
  const m1 = linha.match(/^([A-ZÀ-ÿ][A-ZÀ-ÿ\s\-]{1,25}?)\s*[\[(]\s*(?:\d{1,2}|entre)/i);
  const candidato1 = m1 ? m1[1].trim() : null;

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

function detectarDia(linha) {
  if (/^Dia\s+\d{1,2}\/\d{2}/i.test(linha)) return linha;
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
  res = res.replace(/\s*\+\s*(?:Ida\s+a|Ida\s+para|Ida\s+de|Volta\s+ao|Volta\s+aos|Voo\s+para|trajeto\s+a|voo\s+de|trajeto\s+para|volta\s+para).*/gi, '');

  // 5. Se houver setas, traços, espaços ou sinal de mais soltos nas pontas, limpa-os
  res = res.trim().replace(/\s*(?:[:\-–—➔→🡪à➔]|\+|->)\s*$/g, '');

  return res.trim();
}

const files = fs.readdirSync(textsDir).filter(f => f.endsWith('.txt'));

files.forEach(file => {
  const filePath = path.join(textsDir, file);
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  console.log(`\n=== ARQUIVO: ${file} ===`);
  let count = 0;
  for (let line of lines) {
    // Parar na tabela resumo
    if (
      line.toUpperCase().includes('MODELO ALTERNATIVO') ||
      line.toUpperCase().includes('ROTEIRO RESUMIDO POR DIA') ||
      line.toUpperCase().includes('ROTEIRO POR DIA')
    ) {
      break;
    }
    const nomeDia = detectarDia(line);
    if (nomeDia) {
      count++;
      const limpo = limparNomeRota(nomeDia);
      console.log(`  Original: "${nomeDia}"`);
      console.log(`  Limpo   : "${limpo}"`);
      console.log('  --------------------------------------------');
    }
  }
});
