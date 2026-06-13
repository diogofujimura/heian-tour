const dotenv = require('dotenv');
dotenv.config();

const NOTION_TOKEN = process.env.NOTION_API_KEY;

async function listUsers() {
  console.log('Buscando usuários do Notion...');
  const response = await fetch('https://api.notion.com/v1/users', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28'
    }
  });

  if (!response.ok) {
    console.error('Erro ao chamar a API do Notion:', response.status, await response.text());
    return;
  }

  const data = await response.json();
  console.log(`Encontrados ${data.results.length} usuários:`);
  data.results.forEach(user => {
    console.log(`- Nome: "${user.name}" | ID: ${user.id} | Tipo: ${user.type} | Avatar: ${user.avatar_url}`);
  });
}

listUsers().catch(console.error);
