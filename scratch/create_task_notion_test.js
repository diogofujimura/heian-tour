const dotenv = require('dotenv');
dotenv.config();

const NOTION_TOKEN = process.env.NOTION_API_KEY;
const NOTION_TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;

// Usando dados do teste de query anterior
const TEST_CLIENT_ID = '357b6e48-f954-805c-8b8f-dd2298ed9e6b';
const TEST_USER_ID = '7c01dfe3-3608-44a5-9f89-a99d78f4e01f'; // Diogo Fujimura

async function testCreateTask() {
  console.log('Tentando criar tarefa no Tasks Tracker do Notion...');
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      parent: { database_id: NOTION_TASKS_DB_ID },
      properties: {
        'Task name': {
          title: [
            { text: { content: 'TESTE DE CRIAÇÃO API' } }
          ]
        },
        'Data do Serviço': {
          date: { start: '2026-06-20' }
        },
        'Tipo de Serviço': {
          select: { name: 'Experiência' }
        },
        '🎀 Clientes': {
          relation: [
            { id: TEST_CLIENT_ID }
          ]
        },
        'Assignee': {
          people: [
            { id: TEST_USER_ID }
          ]
        }
      }
    })
  });

  if (!response.ok) {
    console.error('Erro ao chamar a API do Notion:', response.status, await response.text());
    return;
  }

  const data = await response.json();
  console.log('Tarefa criada com sucesso! ID da Página:', data.id);
}

testCreateTask().catch(console.error);
