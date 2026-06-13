const dotenv = require('dotenv');
dotenv.config();

const NOTION_TOKEN = process.env.NOTION_API_KEY;

async function archiveTask() {
  const taskId = '37cb6e48-f954-8154-85d5-ed3467053dc8';
  console.log(`Arquivando tarefa de teste ${taskId}...`);
  const response = await fetch(`https://api.notion.com/v1/pages/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      archived: true
    })
  });

  if (!response.ok) {
    console.error('Erro ao arquivar tarefa:', response.status, await response.text());
    return;
  }

  console.log('Tarefa arquivada com sucesso!');
}

archiveTask().catch(console.error);
