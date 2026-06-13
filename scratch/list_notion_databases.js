require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_API_KEY;

async function listDbs() {
  try {
    const { default: fetch } = await import('node-fetch');
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
      const text = await response.text();
      console.error("Erro Notion:", text);
      return;
    }
    const data = await response.json();
    console.log("Bancos de dados encontrados:");
    data.results.forEach(db => {
      const title = db.title?.[0]?.plain_text || 'Sem título';
      console.log(`- Nome: "${title}" | ID: ${db.id}`);
    });
  } catch (err) {
    console.error("Erro:", err);
  }
}

listDbs();
