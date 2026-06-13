// Usando fetch nativo

const sheets_id = "1E1zOsZ3-dKIkXepx61a0ejWNempftS12-3i7LwwsWWo";

async function run() {
  const url = `https://docs.google.com/spreadsheets/d/${sheets_id}/htmlview`;
  console.log('Buscando HTMLview da planilha...');
  const res = await fetch(url);
  const html = await res.text();
  
  console.log('HTML recebido. Procurando por padrões de abas...');
  
  // 1. Procurar por todas as ocorrências de nomes de abas dentro de trechos que definem as abas
  const tabNames = [];
  
  // Tentar encontrar pelo padrão JSON do bootstrapData ou de abas
  const jsonRegex = /"name"\s*:\s*"([^"]+)"/g;
  let match;
  while ((match = jsonRegex.exec(html)) !== null) {
    const name = match[1];
    // Se o nome tiver cara de aba (curto, sem caracteres bizarros)
    if (name.length < 50 && !tabNames.includes(name) && !name.includes('{') && !name.includes('}')) {
      tabNames.push(name);
    }
  }

  // Tentar encontrar pelo padrão de título da aba no HTMLview
  const tabTitleRegex = /"sheetName"\s*:\s*"([^"]+)"/g;
  while ((match = tabTitleRegex.exec(html)) !== null) {
    const name = match[1];
    if (!tabNames.includes(name)) {
      tabNames.push(name);
    }
  }

  console.log('Nomes de possíveis abas encontrados:', tabNames);
  
  // Vamos ver se o HTML contém termos conhecidos
  console.log('Contém "Transportes"?', html.includes('Transportes'));
  console.log('Contém "Experiências"?', html.includes('Experiências'));
  console.log('Contém "Experiencias"?', html.includes('Experiencias'));
  console.log('Contém "Atracoes"?', html.includes('Atracoes'));
  console.log('Contém "Rotas"?', html.includes('Rotas'));
}

run().catch(console.error);
