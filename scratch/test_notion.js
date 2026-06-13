// Usando fetch nativo

const authHeader = 'Basic ' + Buffer.from('heian:heiantour2026').toString('base64');
const baseUrl = 'http://localhost:3000';

async function testNotion() {
  console.log('Testando conexão com Notion via endpoint /api/notion/clientes...');
  const url = `${baseUrl}/api/notion/clientes`;
  const headers = {
    'Authorization': authHeader,
    'Content-Type': 'application/json'
  };
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Erro na API do Notion: ${res.status} - ${await res.text()}`);
  }
  const data = await res.json();
  console.log('Conexão Notion OK! Total de clientes recuperados:', data.length);
  if (data.length > 0) {
    console.log('Exemplo de cliente:', JSON.stringify(data[0], null, 2));
  }
}

testNotion().catch(console.error);
