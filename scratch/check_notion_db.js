require('dotenv').config({ path: '../.env' });

const NOTION_TOKEN = process.env.NOTION_API_KEY;
const NOTION_AGENDA_DB_ID = process.env.NOTION_AGENDA_DB_ID;

if (!NOTION_TOKEN || !NOTION_AGENDA_DB_ID) {
  console.error('NOTION_API_KEY ou NOTION_AGENDA_DB_ID não configurados no .env');
  process.exit(1);
}

async function run() {
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_AGENDA_DB_ID}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!res.ok) {
      console.error('Erro na resposta do Notion:', await res.text());
      return;
    }

    const data = await res.json();
    console.log('Colunas encontradas na base de dados de Agenda do Notion:');
    Object.keys(data.properties).sort().forEach(prop => {
      console.log(`- ${prop} (${data.properties[prop].type})`);
    });
  } catch (err) {
    console.error(err);
  }
}

run();
