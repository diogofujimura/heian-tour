const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

const { NOTION_API_KEY, NOTION_TOKEN, NOTION_SAIDAS_DB_ID, NOTION_ENTRADAS_DB_ID, NOTION_TASKS_DB_ID } = process.env;
const token = NOTION_API_KEY || NOTION_TOKEN;

async function inspect() {
  if (!token) {
    console.error('Token do Notion não configurado (NOTION_API_KEY ou NOTION_TOKEN).');
    return;
  }
  const dbId = NOTION_TASKS_DB_ID;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };

  try {
    console.log('--- INSPECIONANDO BASE DE TASKS ---');
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}`, { headers });
    const data = await res.json();
    console.log('Propriedades de Tasks:');
    Object.entries(data.properties || {}).forEach(([name, prop]) => {
      if (prop.type === 'formula') {
        console.log(`- ${name}: tipo = formula, expressão =`, JSON.stringify(prop.formula));
      } else {
        console.log(`- ${name}: tipo = ${prop.type}`);
      }
    });
  } catch (e) {
    console.error('Erro ao inspecionar:', e);
  }
}

inspect();
