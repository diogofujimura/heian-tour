const fs = require('fs');
const path = require('path');

const textPath = path.join(__dirname, 'fukuchi_text_raw.txt');

if (!fs.existsSync(textPath)) {
  console.log(`Arquivo de texto bruto não encontrado: ${textPath}`);
  process.exit(1);
}

const text = fs.readFileSync(textPath, 'utf8');
const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

const atracoes = [];
const diasProntos = {};

let currentCity = 'Tokyo'; // Cidade padrão inicial
let currentDay = '';
let startParsing = false; // Flag para ignorar a primeira página de Voos/Estadias

console.log("Processando linhas do roteiro de texto de forma inteligente...");

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // REGRA DE OURO 1: Ignora tudo até chegar de fato na seção de Cidades e Rotas
  if (!startParsing) {
    if (line.includes('CIDADES / ROTAS') || line.match(/^[A-ZÀ-ÿ\s]{3,15}\s*\[\d/)) {
      startParsing = true;
      console.log("✓ Seção de Roteiro diário iniciada! Ignorados voos e estadias da capa.");
    } else {
      continue; // Ignora cabeçalhos de voos e estadias
    }
  }
  
  // Detectar cidade/região (Ex: TOKYO [16 – 19/05 (3 noites)], KYOTO [19 – 21/05 (2 noites)])
  const cityMatch = line.match(/^([A-ZÀ-ÿ\s]{3,15})\s*\[\d/);
  if (cityMatch) {
    currentCity = cityMatch[1].trim().toLowerCase();
    // Capitalizar primeira letra
    currentCity = currentCity.charAt(0).toUpperCase() + currentCity.slice(1);
    console.log(`> Cidade Ativa: ${currentCity}`);
    continue;
  }
  
  // Detectar dia (Ex: Dia 17/05 (dia inteiro): Tsukiji + Ginza...)
  const dayMatch = line.match(/^Dia\s*(\d{2}\/\d{2})/i);
  if (dayMatch) {
    currentDay = line;
    diasProntos[currentDay] = {
      cidade: currentCity,
      nome: line,
      atracoes: []
    };
    console.log(`  > Dia Ativo: ${currentDay}`);
    continue;
  }
  
  // REGRA DE OURO 2: Ignorar linhas de trajetos/transporte na lista de atrações
  if (line.startsWith('Trajeto') || line.startsWith('Saída:') || line.startsWith('Chegada:') || line.startsWith('(duração:')) {
    continue;
  }
  
  // Detectar atração/ponto (iniciado por •, §, ➔, *, -)
  // Ex: • Tsukiji Outer Market – mercado externo de peixes...
  // Ex: • Ginza ➔ Área comercial...
  if (line.match(/^[•§\-*]/)) {
    let tempLine = line;
    let preco = 'Gratuito';
    
    // Extrair preço se houver (ex: "(3.800 – 4.800 ienes)" ou "(800 ienes)")
    const precoRegex = /\(([^)]*ienes[^)]*)\)/i;
    const precoMatch = tempLine.match(precoRegex);
    if (precoMatch) {
      const rawPreco = precoMatch[1];
      const numeros = rawPreco.match(/\d+[\d.,]*/g);
      if (numeros) {
        preco = numeros.map(num => num.replace(/[.,]/g, '')).join(' - ');
      }
      tempLine = tempLine.replace(precoRegex, '').trim();
    }
    
    const atracaoMatch = tempLine.match(/^[•§\-*]\s*([^–➔—]+)([–➔—])\s*(.*)/);
    if (atracaoMatch) {
      const nomeRaw = atracaoMatch[1].trim();
      const descPart = atracaoMatch[3].trim();
      
      // REGRA DE OURO 3: Ignorar se o nome for apenas metadados ou recomendações gerais de cabeçalho
      if (nomeRaw.toLowerCase().includes('sugestão:') || nomeRaw.toLowerCase().includes('recomendação de jantar')) {
        continue;
      }
      
      let nome = nomeRaw;
    
    // A descrição às vezes continua na próxima linha se não começar com outro marcador
    let descricao = descPart;
    while (
      i + 1 < lines.length && 
      !lines[i+1].match(/^[•§\-*]/) && 
      !lines[i+1].match(/^Dia\s*\d{2}\/\d{2}/i) && 
      !lines[i+1].match(/^[A-ZÀ-ÿ\s]{3,15}\s*\[\d/) &&
      !lines[i+1].startsWith('Trajeto') &&
      !lines[i+1].startsWith('Saída:') &&
      !lines[i+1].startsWith('Chegada:') &&
      !lines[i+1].startsWith('(duração:')
    ) {
      i++;
      descricao += ' ' + lines[i].trim();
    }
    
    // Deduzir o bairro de forma inteligente
    const bairro = getBairro(nome, currentCity);
    
    // Adicionar à lista geral de atrações
    atracoes.push({
      cidade: currentCity,
      bairro: bairro,
      nome: nome,
      descricao: descricao,
      preco: preco
    });
    
    // Vincular ao dia atual se houver
    if (currentDay && diasProntos[currentDay]) {
      diasProntos[currentDay].atracoes.push(nome);
    }
  }
}
}

// Função inteligente de mapeamento de Bairros baseada em dados reais do Japão
function getBairro(nome, cidade) {
  const n = nome.toLowerCase();
  if (cidade === 'Tokyo') {
    if (n.includes('tsukiji') || n.includes('ginza')) return 'Tsukiji / Ginza';
    if (n.includes('palácio imperial') || n.includes('kokyo') || n.includes('castelo edo')) return 'Chiyoda (Palácio)';
    if (n.includes('teamlab') || n.includes('borderless')) return 'Azabudai Hills';
    if (n.includes('asakusa') || n.includes('senso-ji') || n.includes('nakamise') || n.includes('sumida')) return 'Asakusa';
    if (n.includes('ueno') || n.includes('kannon-do')) return 'Ueno';
    if (n.includes('shinjuku') || n.includes('yokocho') || n.includes('kabukich') || n.includes('golden gai') || n.includes('government')) return 'Shinjuku';
    if (n.includes('meiji') || n.includes('harajuku') || n.includes('takeshita') || n.includes('omotesando')) return 'Harajuku / Omotesando';
    if (n.includes('shibuya') || n.includes('hachiko') || n.includes('sky')) return 'Shibuya';
    if (n.includes('minato') || n.includes('zojo-ji') || n.includes('shiba') || n.includes('tower')) return 'Minato';
    return 'Centro';
  }
  if (cidade === 'Kyoto') {
    if (n.includes('kamogawa') || n.includes('gion') || n.includes('shirakawa') || n.includes('hanamikoji') || n.includes('pontocho')) return 'Gion / Pontocho';
    if (n.includes('kennin-ji') || n.includes('yasaka') || n.includes('higashiyama') || n.includes('koshindo') || n.includes('kyomizu') || n.includes('sannenzaka') || n.includes('ninenzaka') || n.includes('maruyama')) return 'Higashiyama';
    if (n.includes('nishiki') || n.includes('teramachi')) return 'Centro / Nishiki';
    if (n.includes('pavilhao') || n.includes('pavilhão') || n.includes('kinkaku-ji')) return 'Kita (Norte)';
    if (n.includes('arashiyama') || n.includes('togetsukyo') || n.includes('tenryu-ji') || n.includes('floresta de bambu')) return 'Arashiyama';
    if (n.includes('fushimi')) return 'Fushimi (Sul)';
    return 'Higashiyama';
  }
  if (cidade === 'Osaka') {
    if (n.includes('shinsekai') || n.includes('tsutenkaku')) return 'Shinsekai';
    if (n.includes('castelo')) return 'Castelo de Osaka';
    if (n.includes('kuromon') || n.includes('namba') || n.includes('yasaka jinja') || n.includes('dotonbori') || n.includes('shinsaibashi')) return 'Namba / Dotonbori';
    if (n.includes('umeda') || n.includes('sky building')) return 'Umeda / Kita';
    return 'Minami / Namba';
  }
  if (cidade === 'Okinawa') {
    if (n.includes('sunset') || n.includes('american') || n.includes('vila americana')) return 'Chatan (Vila Americana)';
    if (n.includes('nirai') || n.includes('zanpa') || n.includes('maeda') || n.includes('beach 51') || n.includes('blue cave')) return 'Yomitan / Onna (Centro-Norte)';
    if (n.includes('world') || n.includes('peace') || n.includes('memorial')) return 'Nanjo / Itoman (Sul)';
    if (n.includes('senaga') || n.includes('araha') || n.includes('umikaji')) return 'Naha / Tomigusuku';
    return 'Okinawa';
  }
  return 'Geral';
}

// Filtrar duplicados nas atrações por nome
const uniqueAtracoes = [];
const seenNames = new Set();
atracoes.forEach(a => {
  const key = `${a.cidade}-${a.nome}`;
  if (!seenNames.has(key)) {
    seenNames.add(key);
    uniqueAtracoes.push(a);
  }
});

// 1. Gravar CSV de Atrações
// Usamos ponto e vírgula como separador do CSV pois é o padrão que o Excel abre direto no Windows em Português!
const csvHeaders = "Cidade;Bairro;Nome da Atração;Descrição Detalhada;Preço (Ingresso)\n";
const csvRows = uniqueAtracoes.map(a => {
  // Escapar aspas duplas no CSV
  const esc = (val) => `"${val.replace(/"/g, '""')}"`;
  return `${esc(a.cidade)};${esc(a.bairro)};${esc(a.nome)};${esc(a.descricao)};${esc(a.preco)}`;
}).join('\n');

fs.writeFileSync(path.join(__dirname, 'atracoes_fukuchi.csv'), csvHeaders + csvRows, 'utf8');
console.log(`\n✓ Sucesso! ${uniqueAtracoes.length} atrações de visita reais extraídas com a coluna Bairro.`);
console.log(`Salvo em: scratch/atracoes_fukuchi.csv`);

// 2. Gravar CSV de Dias Prontos
const dpHeaders = "Cidade;Nome da Rota / Dia Pronto;Atrações Inclusas;Descrição Geral do Dia\n";
const dpRows = Object.values(diasProntos).map(dp => {
  const esc = (val) => `"${val.replace(/"/g, '""')}"`;
  const listaAtr = dp.atracoes.join(', ');
  return `${esc(dp.cidade)};${esc(dp.nome)};${esc(listaAtr)};${esc("Passeio programado pelo dia: " + dp.nome)}`;
}).join('\n');

fs.writeFileSync(path.join(__dirname, 'dias_prontos_fukuchi.csv'), dpHeaders + dpRows, 'utf8');
console.log(`✓ Sucesso! ${Object.keys(diasProntos).length} dias/rotas prontas extraídas.`);
console.log(`Salvo em: scratch/dias_prontos_fukuchi.csv`);
