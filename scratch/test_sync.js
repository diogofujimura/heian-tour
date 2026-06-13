// Usando fetch nativo
const authHeader = 'Basic ' + Buffer.from('heian:heiantour2026').toString('base64');
const baseUrl = 'http://localhost:3000';

async function testSync() {
  console.log('Iniciando sincronização com o Google Sheets via /api/sync...');
  const url = `${baseUrl}/api/sync`;
  const headers = {
    'Authorization': authHeader,
    'Content-Type': 'application/json'
  };
  
  const res = await fetch(url, {
    method: 'POST',
    headers
  });
  
  if (!res.ok) {
    throw new Error(`Erro na sincronização: ${res.status} - ${await res.text()}`);
  }
  
  const data = await res.json();
  console.log('Sincronização concluída com sucesso!');
  console.log('Resultado da sincronização:', JSON.stringify(data, null, 2));
}

testSync().catch(console.error);
