require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_API_KEY;
const AGENDA_DB_ID = '2a0b6e48-f954-81d0-97bf-e301d90552b2';

async function queryItems() {
  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(`https://api.notion.com/v1/databases/${AGENDA_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        page_size: 3
      })
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("Erro Notion:", text);
      return;
    }
    const data = await response.json();
    console.log("Número de itens encontrados:", data.results.length);
    if (data.results.length > 0) {
      console.log("Exemplo de item properties da Agenda:", JSON.stringify(data.results[0].properties, null, 2));
    }
  } catch (err) {
    console.error("Erro:", err);
  }
}

queryItems();
