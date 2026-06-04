const fs = require('fs');
const path = require('path');
const { limparAtracao } = require('./limpeza');

const textsDir = path.join(__dirname, 'texts');
const fukuchiCsvPath = path.join(__dirname, 'atracoes_fukuchi.csv');
const outputPath = path.join(__dirname, 'novidades_atracoes.csv');

// Conjunto para controle de duplicados
const seenUnique = new Set();
const allAtracoes = [];

// 1. Carregar a base de dados existente da Família Fukuchi para evitar qualquer duplicata
if (fs.existsSync(fukuchiCsvPath)) {
  const fukuchiData = fs.readFileSync(fukuchiCsvPath, 'utf8');
  const lines = fukuchiData.split('\n').slice(1); // Ignorar cabeçalho
  
  lines.forEach(line => {
    if (!line.trim()) return;
    // Split básico por ponto e vírgula considerando aspas
    const parts = line.match(/(".*?"|[^;]+)/g) || [];
    if (parts.length >= 3) {
      const cidade = parts[0].replace(/"/g, '').trim();
      const nome = parts[2].replace(/"/g, '').trim();
      const key = `${cidade.toLowerCase()}-${nome.toLowerCase()}`;
      seenUnique.add(key);
      
      // Adicionar à lista geral para exportarmos tudo consolidado se quisermos!
      allAtracoes.push({
        cidade: cidade,
        bairro: parts[1].replace(/"/g, '').trim(),
        nome: nome,
        descricao: parts[3] ? parts[3].replace(/"/g, '').trim() : '',
        preco: parts[4] ? parts[4].replace(/"/g, '').trim() : 'Gratuito',
        origem: 'Família Fukuchi'
      });
    }
  });
  console.log(`✓ Base da Família Fukuchi carregada! ${seenUnique.size} atrações registradas.`);
} else {
  console.log("⚠ Planilha de atrações Fukuchi não encontrada em scratch. Começando do zero.");
}

// Lista de arquivos TXT na pasta texts
const files = fs.readdirSync(textsDir).filter(f => f.endsWith('.txt'));

console.log("\n=== INICIANDO EXTRAÇÃO DE ATRAÇÕES DOS OUTROS ROTEIROS ===");

files.forEach(file => {
  // Ignorar o próprio arquivo do Fukuchi pois ele já é nossa base de dados primária
  // Removido if que ignorava Fukuchi
  
  const filePath = path.join(textsDir, file);
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const roteiroName = file.replace('.txt', '').replace('Heian Tour - Rascunho de Roteiro ', '').replace('Rascunho de Roteiro ', '').replace('HEIAN Tour - Roteiro ', '');
  
  console.log(`\n• Analisando roteiro de: ${roteiroName}...`);
  
  let currentCity = 'Tokyo';
  let currentDay = '';
  let startParsing = false;
  let countAdded = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Regra de segurança: Se bater em modelo alternativo ou tabela de resumo, parar a leitura desse arquivo
    if (line.toUpperCase().includes('MODELO ALTERNATIVO') || line.toUpperCase().includes('ROTEIRO RESUMIDO POR DIA')) {
      console.log(`  ➔ Seção de Tabela Resumo detectada. Leitura de ${roteiroName} encerrada preventivamente.`);
      break;
    }
    
    // Ativação do parsing
    if (!startParsing) {
      if (line.includes('CIDADES / ROTAS') || line.match(/^[A-ZÀ-ÿ\s]{3,15}\s*\[\d/)) {
        startParsing = true;
        continue;
      } else {
        continue;
      }
    }
    
    // Detectar Cidade de forma extremamente robusta por palavras-chave de cidades legítimas do Japão
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
      'monte fuji', 'fuji', 'fujiyoshida',
      'karuizawa', 'himeji'
    ];
    
    let detectouCidade = false;
    const temMarcadorAtraction = line.match(/^[•§\-\*▪●▪◦●]/);
    
    if (!temMarcadorAtraction) {
      const lineClean = line.replace(/^[v\*\s\-\>•§🡪à➔—●▪▪◦●#]+/g, '').trim();
      const lCleanLower = lineClean.toLowerCase();
      
      // A primeira palavra do cabeçalho da cidade DEVE ser totalmente maiúscula (para diferenciar de atração)
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
            break;
          }
        }
      }
    }
    
    if (detectouCidade) {
      continue;
    }
    
    // Detectar Dia (Ignora trânsito e cabeçalhos de aeroporto)
    const dayMatch = line.match(/^Dia\s*(\d{2}\/\d{2})/i);
    if (dayMatch) {
      currentDay = line;
      continue;
    }
    
    // Regra de segurança contra ruídos e dados de transporte/tours
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
      line.match(/^[0-9]{2}\/[0-9]{2}/) // Linhas de datas soltas no resumo
    ) {
      continue;
    }
    
    // Regex híbrida e super flexível para extração da atração
    // Trata marcadores: •, §, -, *, ou sem marcadores com seta/traço/parênteses
    let tempLine = line;
    let preco = 'Gratuito';
    
    // 1. Extrair preço se houver no padrão ienes
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
    
    // 2. Tentar quebrar a linha no delimitador (seta ➔, 🡪, à, traço –, —, -)
    let isAtracao = false;
    let nome = '';
    let descricao = '';
    
    // Regex inteligente com suporte a marcadores estendidos e delimitadores robustos
    const delimiterMatch = tempLine.match(/^(?:[•§\-*▪●▪◦●]\s*)?([^–➔—🡪à\->]+?)(?:\s+(?:–|➔|—|🡪|à|->|-)\s*|–|➔|—|🡪|->)\s*(.*)/);
    if (delimiterMatch) {
      nome = delimiterMatch[1].trim();
      descricao = delimiterMatch[2].trim();
      isAtracao = true;
    } else {
      // Caso não tenha traço, mas comece com um marcador claro de item
      const markerMatch = tempLine.match(/^[•§\-*▪●▪◦●]\s*(.*)/);
      if (markerMatch) {
        const itemContent = markerMatch[1].trim();
        // Separar nome e descrição caso tenha parênteses
        const parenMatch = itemContent.match(/^([^()]+)\(([^()]+)\)(.*)/);
        if (parenMatch) {
          nome = parenMatch[1].trim();
          descricao = parenMatch[2].trim() + (parenMatch[3] ? ' ' + parenMatch[3].trim() : '');
        } else {
          nome = itemContent;
          descricao = 'Visitação livre programada.';
        }
        isAtracao = true;
      } else {
        // Caso esteja no corpo das Cidades/Rotas, seja longa, e pareça um item de atração contendo parênteses
        const parenMatch = tempLine.match(/^([^()]{5,40})\(([^()]{15,})\)/);
        if (parenMatch && startParsing && currentDay) {
          nome = parenMatch[1].trim();
          descricao = parenMatch[2].trim();
          isAtracao = true;
        }
      }
    }
    
    // Limpezas adicionais de lixo
    if (isAtracao && nome) {
      nome = limparAtracao(nome);
      if (!nome || nome.length > 45) continue;
      
      const nLower = nome.toLowerCase();
      
      // 2. Descartar se a primeira letra for minúscula (continuação de descrição que escapou)
      const firstChar = nome.charAt(0);
      if (firstChar && firstChar === firstChar.toLowerCase() && firstChar.match(/[a-zà-ÿ]/)) {
        continue;
      }
      
      // Se contiver padrões de páginas como "- 1 of 10 --" ou "3 of 12" ou se for apenas marcadores de quebra de página
      if (nLower.match(/\d+\s*of\s*\d+/) || nLower.includes('--') || nLower.match(/^-\s*\d+\s*-$/)) {
        continue;
      }
      
      // Se o nome contiver fechar parênteses solto no final sem abrir
      if (nome.includes(')') && !nome.includes('(')) {
        continue;
      }
      
      // Se o nome começar com pontuações estranhas
      if (nome.match(/^[^A-Za-zÀ-ÿ0-9•§▪*]/)) {
        continue;
      }
      
      // Se for um cabeçalho de cidade disfarçado de atração (ex: "QUIOTO (10" com descrição "13/04)")
      let ehCabecalhoCidade = false;
      const cidadesParaFiltro = [
        'tokyo', 'tóquio', 'tokio', 'kyoto', 'quioto', 'osaka', 'okinawa', 'kanazawa', 
        'takayama', 'nara', 'hakone', 'shirakawa', 'naoshima', 'koyasan', 'hiroshima', 
        'miyajima', 'nikko', 'fuji', 'fujiyoshida', 'karuizawa', 'himeji'
      ];
      for (const cid of cidadesParaFiltro) {
        if (nLower.startsWith(cid)) {
          if (
            (nome.includes('(') || nome.includes('[')) && 
            (descricao.includes(')') || descricao.includes(']') || descricao.match(/\d{2}\/\d{2}/))
          ) {
            ehCabecalhoCidade = true;
            break;
          }
          if (nLower.match(/\d+/) && (descricao.match(/\d+/) || nLower.includes('noite') || nLower.includes('noites'))) {
            ehCabecalhoCidade = true;
            break;
          }
        }
      }
      if (ehCabecalhoCidade) {
        continue;
      }
      
      // Ignorar cabeçalhos de sugestão, almoço solto ou recomendações gerais
      
      // 1. Ignorar se contiver horários (ex: 15:40, 22:50, 10:00 am, 18:30 hrs, 6:00 pm)
      if (nLower.match(/\d{2}:\d{2}/) || nLower.match(/\d{1,2}:\d{2}/) || nLower.match(/\d{2}\s*hrs/) || nLower.match(/\d{2}h/)) {
        continue;
      }
      
      // 2. Ignorar se contiver datas (ex: 21/04, 23/04)
      if (nLower.match(/\d{2}\/\d{2}/)) {
        continue;
      }
      
      // 3. Ignorar se tiver palavras de ruído no nome
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
      
      // 4. Ignorar se começar com verbos típicos de instrução/recomendação
      if (
        nLower.startsWith('escolher') ||
        nLower.startsWith('comprar') ||
        nLower.startsWith('visitar') ||
        nLower.startsWith('ir a') ||
        nLower.startsWith('fazer') ||
        nLower.startsWith('jantar em') ||
        nLower.startsWith('almoçar em') ||
        nLower.startsWith('dormir') ||
        nLower.startsWith('contratar') ||
        nLower.startsWith('definir') ||
        nLower.startsWith('acordar')
      ) {
        continue;
      }
      
      // 5. Nomes de atrações legítimos não são extremamente longos
      if (nome.length < 3 || nome.length > 65) {
        continue;
      }
      
      // Limpar resíduos de tabs
      nome = nome.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
      descricao = descricao.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Continuação multilinha inteligente para a descrição
      while (
        i + 1 < lines.length && 
        !lines[i+1].match(/^[•§\-*▪●▪◦●]/) && 
        !lines[i+1].match(/^Dia\s*\d{2}\/\d{2}/i) && 
        !lines[i+1].match(/^[A-ZÀ-ÿ\s]{3,15}\s*\[\d/i) &&
        !lines[i+1].startsWith('Trajeto') &&
        !lines[i+1].startsWith('Saída:') &&
        !lines[i+1].startsWith('Chegada:') &&
        !lines[i+1].startsWith('(duração:') &&
        !lines[i+1].toUpperCase().includes('MODELO ALTERNATIVO') &&
        !lines[i+1].toUpperCase().includes('ROTEIRO RESUMIDO')
      ) {
        i++;
        descricao += ' ' + lines[i].trim();
      }
      
      // Limpar resíduos de tags XML se houver
      nome = nome.replace(/<[^>]+>/g, '').trim();
      descricao = descricao.replace(/<[^>]+>/g, '').trim();
      
      // Deduzir o bairro
      const bairro = getBairroConsolidado(nome, currentCity);
      
      const key = `${currentCity.toLowerCase()}-${nome.toLowerCase()}`;
      
      if (!seenUnique.has(key)) {
        seenUnique.add(key);
        countAdded++;
        
        allAtracoes.push({
          cidade: currentCity,
          bairro: bairro,
          nome: nome,
          descricao: descricao,
          preco: preco,
          origem: roteiroName
        });
      }
    }
  }
  
  console.log(`  ✓ Concluído! Extraídas ${countAdded} novas atrações exclusivas.`);
});

// Função inteligente unificada de Bairros para todas as cidades do Japão
function getBairroConsolidado(nome, cidade) {
  const n = nome.toLowerCase();
  
  if (cidade === 'Tokyo') {
    if (n.includes('tsukiji') || n.includes('ginza') || n.includes('chuo dori') || n.includes('mitsukoshi') || n.includes('wako') || n.includes('kitte')) return 'Tsukiji / Ginza';
    if (n.includes('palácio imperial') || n.includes('kokyo') || n.includes('castelo edo') || n.includes('chiyoda')) return 'Chiyoda (Palácio)';
    if (n.includes('teamlab borderless') || n.includes('borderless') || n.includes('azabudai')) return 'Azabudai Hills';
    if (n.includes('teamlab planets') || n.includes('planets') || n.includes('odaiba')) return 'Odaiba';
    if (n.includes('asakusa') || n.includes('senso-ji') || n.includes('sensō-ji') || n.includes('nakamise') || n.includes('sumida') || n.includes('ryogoku') || n.includes('edo-tokyo') || n.includes('edo tokyo')) return 'Asakusa';
    if (n.includes('ueno') || n.includes('kannon-do') || n.includes('museu nacional')) return 'Ueno';
    if (n.includes('shinjuku') || n.includes('yokocho') || n.includes('kabukich') || n.includes('golden gai') || n.includes('government') || n.includes('gyoen') || n.includes('3d cat') || n.includes('godzilla') || n.includes('yayoi kusama')) return 'Shinjuku';
    if (n.includes('meiji') || n.includes('harajuku') || n.includes('takeshita') || n.includes('omotesando') || n.includes('cosme') || n.includes('cat street') || n.includes('aoyama')) return 'Harajuku / Omotesando';
    if (n.includes('shibuya') || n.includes('hachiko') || n.includes('sky') || n.includes('tokyu stay')) return 'Shibuya';
    if (n.includes('minato') || n.includes('zojo-ji') || n.includes('shiba') || n.includes('tower')) return 'Minato';
    if (n.includes('roppongi') || n.includes('mori')) return 'Roppongi';
    if (n.includes('akihabara') || n.includes('maid')) return 'Akihabara';
    if (n.includes('daikanyama')) return 'Daikanyama';
    if (n.includes('kagurazaka')) return 'Kagurazaka';
    if (n.includes('nakameguro') || n.includes('meguro')) return 'Meguro / Nakameguro';
    if (n.includes('shimokitazawa')) return 'Shimokitazawa';
    return 'Centro';
  }
  
  if (cidade === 'Kyoto') {
    if (n.includes('kamogawa') || n.includes('gion') || n.includes('shirakawa') || n.includes('hanamikoji') || n.includes('pontocho')) return 'Gion / Pontocho';
    if (n.includes('kennin-ji') || n.includes('yasaka') || n.includes('higashiyama') || n.includes('koshindo') || n.includes('kyomizu') || n.includes('sannenzaka') || n.includes('ninenzaka') || n.includes('maruyama')) return 'Higashiyama';
    if (n.includes('nishiki') || n.includes('teramachi')) return 'Centro / Nishiki';
    if (n.includes('pavilhao') || n.includes('pavilhão') || n.includes('kinkaku-ji')) return 'Kita (Norte)';
    if (n.includes('arashiyama') || n.includes('togetsukyo') || n.includes('tenryu-ji') || n.includes('floresta de bambu') || n.includes('nenbutsu')) return 'Arashiyama';
    if (n.includes('fushimi')) return 'Fushimi (Sul)';
    if (n.includes('nijo') || n.includes('nijo-jo')) return 'Área do Castelo Nijo';
    return 'Higashiyama';
  }
  
  if (cidade === 'Osaka') {
    if (n.includes('shinsekai') || n.includes('tsutenkaku')) return 'Shinsekai';
    if (n.includes('castelo')) return 'Castelo de Osaka';
    if (n.includes('kuromon') || n.includes('namba') || n.includes('yasaka jinja') || n.includes('dotonbori') || n.includes('shinsaibashi') || n.includes('hozen-ji')) return 'Namba / Dotonbori';
    if (n.includes('umeda') || n.includes('sky building') || n.includes('elcient')) return 'Umeda / Kita';
    if (n.includes('toyosu') || n.includes('universal') || n.includes('usj')) return 'Baía de Osaka';
    if (n.includes('tenma')) return 'Tenma';
    if (n.includes('nakanoshima')) return 'Nakanoshima';
    if (n.includes('nakazakicho')) return 'Nakazakicho';
    return 'Minami / Namba';
  }
  
  if (cidade === 'Okinawa') {
    if (n.includes('sunset') || n.includes('american') || n.includes('vila americana')) return 'Chatan (Vila Americana)';
    if (n.includes('nirai') || n.includes('zanpa') || n.includes('maeda') || n.includes('beach 51') || n.includes('blue cave')) return 'Yomitan / Onna (Centro-Norte)';
    if (n.includes('world') || n.includes('peace') || n.includes('memorial')) return 'Nanjo / Itoman (Sul)';
    if (n.includes('senaga') || n.includes('araha') || n.includes('umikaji')) return 'Naha / Tomigusuku';
    return 'Okinawa';
  }
  
  if (cidade === 'Kanazawa') {
    if (n.includes('kenroku')) return 'Jardim Kenroku-en';
    if (n.includes('castelo')) return 'Castelo de Kanazawa';
    if (n.includes('nagamachi') || n.includes('nomura')) return 'Nagamachi (Samurais)';
    if (n.includes('omicho')) return 'Mercado Omicho';
    if (n.includes('higashi') || n.includes('chaya')) return 'Higashi Chaya (Gueixas)';
    return 'Centro';
  }
  
  if (cidade === 'Takayama') {
    if (n.includes('miyagawa') || n.includes('morning')) return 'Miyagawa (Mercado)';
    if (n.includes('jinya')) return 'Takayama Jinya';
    if (n.includes('sanmachi')) return 'Sanmachi Suji (Histórico)';
    if (n.includes('hida')) return 'Hida no Sato';
    return 'Centro Histórico';
  }
  
  if (cidade === 'Nara') {
    if (n.includes('todai')) return 'Todai-ji (Grande Buda)';
    if (n.includes('kasuga')) return 'Santuário Kasuga Taisha';
    if (n.includes('kofuku')) return 'Kofuku-ji';
    if (n.includes('naramachi')) return 'Naramachi (Mercantil)';
    return 'Parque de Nara';
  }
  
  if (cidade === 'Naoshima') {
    if (n.includes('chichu')) return 'Chichu Art Museum';
    if (n.includes('lee ufan')) return 'Lee Ufan Museum';
    if (n.includes('benesse')) return 'Benesse House';
    if (n.includes('project') || n.includes('art house')) return 'Art House Project';
    return 'Ilha de Naoshima';
  }
  
  if (cidade === 'Hakone') {
    if (n.includes('ropeway') || n.includes('owakudani')) return 'Owakudani (Teleférico)';
    if (n.includes('ashi') || n.includes('barco') || n.includes('pirata')) return 'Lago Ashi';
    if (n.includes('shrine') || n.includes('santuario')) return 'Santuário de Hakone';
    if (n.includes('open air')) return 'Open Air Museum';
    return 'Região de Hakone';
  }
  
  return 'Geral';
}

// 3. Gravar arquivo consolidado com TUDO deduped e super limpo
const csvHeaders = "Cidade;Bairro;Nome da Atração;Descrição Detalhada;Preço (Ingresso);Origem\n";
const csvRows = allAtracoes.map(a => {
  const esc = (val) => `"${val.replace(/"/g, '""')}"`;
  return `${esc(a.cidade)};${esc(a.bairro)};${esc(a.nome)};${esc(a.descricao)};${esc(a.preco)};${esc(a.origem || 'Família Fukuchi')}`;
}).join('\n');

fs.writeFileSync(outputPath, csvHeaders + csvRows, 'utf8');

console.log(`\n======================================================`);
console.log(`✓ SUCESSO ABSOLUTO!`);
console.log(`Total de atrações na biblioteca unificada: ${allAtracoes.length} atrações.`);
console.log(`Novas atrações catalogadas em: scratch/novidades_atracoes.csv`);
console.log(`======================================================\n`);
