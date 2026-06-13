const dotenv = require('dotenv');
dotenv.config();

const NOTION_TOKEN = process.env.NOTION_API_KEY;
const NOTION_TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;

if (!NOTION_TOKEN || !NOTION_TASKS_DB_ID) {
  console.error('NOTION_API_KEY ou NOTION_TASKS_DB_ID ausente');
  process.exit(1);
}

async function queryTasks() {
  console.log('Buscando tarefas do Tasks Tracker no Notion...');
  const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      page_size: 10
    })
  });

  if (!response.ok) {
    console.error('Erro ao chamar a API do Notion:', response.status, await response.text());
    return;
  }

  const data = await response.json();
  console.log(`Retornados ${data.results.length} itens da base Tasks Tracker:`);
  data.results.forEach((task, index) => {
    const properties = task.properties;
    const name = properties['Task name']?.title[0]?.plain_text || 'Sem nome';
    const dataServico = properties['Data do Serviço']?.date?.start || 'Sem data';
    const tipoServico = properties['Tipo de Serviço']?.select?.name || 'Sem tipo';
    const assignee = properties['Assignee']?.people?.map(p => p.name).join(', ') || 'Ninguém';
    const clienteRelation = properties['🎀 Clientes']?.relation?.map(r => r.id).join(', ') || 'Nenhum cliente';
    console.log(`[${index + 1}] Nome: "${name}" | Data: ${dataServico} | Tipo: ${tipoServico} | Assignee: ${assignee} | Cliente ID: ${clienteRelation}`);
  });
}

queryTasks().catch(console.error);
