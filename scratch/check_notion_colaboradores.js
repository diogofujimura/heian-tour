require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_API_KEY;
const DB_ID = process.env.NOTION_COLABORADORES_DB_ID || '2a0b6e48f954816082afde2815056602';

async function test() {
  try {
    const { default: fetch } = await import('node-fetch');
    console.log("DB_ID:", DB_ID);
    console.log("TOKEN prefix:", NOTION_TOKEN.substring(0, 10));
    const response = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("Erro Notion:", text);
      return;
    }
    const data = await response.json();
    console.log("Número de resultados:", data.results.length);
    if (data.results.length > 0) {
      console.log("Exemplo de item properties:", JSON.stringify(data.results[0].properties, null, 2));
    } else {
      console.log("Nenhum colaborador retornado.");
    }
  } catch (err) {
    console.error("Erro:", err);
  }
}

test();
