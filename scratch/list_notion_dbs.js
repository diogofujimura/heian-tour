const dotenv = require('dotenv');
dotenv.config(); // Carrega o .env do diretório de trabalho atual

const NOTION_TOKEN = process.env.NOTION_API_KEY;

if (!NOTION_TOKEN) {
  console.error('NOTION_API_KEY não encontrada no .env');
  process.exit(1);
}

async function listDbs() {
  console.log('Buscando bases de dados no Notion com o Token...');
  const response = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filter: {
        value: 'database',
        property: 'object'
      }
    })
  });

  if (!response.ok) {
    console.error('Erro ao chamar a API do Notion:', response.status, await response.text());
    return;
  }

  const data = await response.json();
  console.log(`Encontradas ${data.results.length} bases de dados:`);
  data.results.forEach(db => {
    const title = db.title && db.title[0] ? db.title[0].plain_text : 'Sem título';
    console.log(`- Nome: "${title}" | ID: ${db.id}`);
    console.log('  Propriedades disponíveis:');
    Object.keys(db.properties).forEach(prop => {
      console.log(`    * ${prop}: ${db.properties[prop].type}`);
    });
  });
}

listDbs().catch(console.error);
