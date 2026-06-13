require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_API_KEY;
const AGENDA_DB_ID = '2a0b6e48-f954-81d0-97bf-e301d90552b2';

async function inspectDb() {
  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(`https://api.notion.com/v1/databases/${AGENDA_DB_ID}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28'
      }
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("Erro Notion:", text);
      return;
    }
    const db = await response.json();
    console.log("Título da DB:", db.title?.[0]?.plain_text);
    console.log("Propriedades encontradas:");
    for (const [key, value] of Object.entries(db.properties)) {
      console.log(`- Nome: "${key}" | Tipo: "${value.type}"`);
    }
  } catch (err) {
    console.error("Erro:", err);
  }
}

inspectDb();
