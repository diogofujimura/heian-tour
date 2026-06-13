const dotenv = require('dotenv');
dotenv.config();

const NOTION_TOKEN = process.env.NOTION_API_KEY;
const NOTION_TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;

async function queryTasksByDate() {
  console.log('Buscando tarefas no Notion no intervalo de datas...');
  const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filter: {
        and: [
          {
            property: 'Data do Serviço',
            date: {
              on_or_after: '2026-06-01'
            }
          },
          {
            property: 'Data do Serviço',
            date: {
              on_or_before: '2026-06-30'
            }
          }
        ]
      }
    })
  });

  if (!response.ok) {
    console.error('Erro na API do Notion:', response.status, await response.text());
    return;
  }

  const data = await response.json();
  console.log(`Retornados ${data.results.length} itens do Tasks Tracker para Junho/2026:`);
  data.results.forEach((task, index) => {
    const name = task.properties['Task name']?.title[0]?.plain_text || 'Sem nome';
    const date = task.properties['Data do Serviço']?.date?.start || 'Sem data';
    console.log(`[${index + 1}] Nome: "${name}" | Data: ${date}`);
  });
}

queryTasksByDate().catch(console.error);
