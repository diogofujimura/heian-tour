// Usando fetch nativo

const authHeader = 'Basic ' + Buffer.from('heian:heiantour2026').toString('base64');
const baseUrl = 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
    ...options.headers
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${path}: ${await res.text()}`);
  }
  return res.json();
}

async function run() {
  console.log('1. Obtendo atrações iniciais...');
  const list1 = await request('/api/atracoes');
  console.log('Total de atrações iniciais:', list1.length);
  
  console.log('2. Cadastrando nova atração...');
  const novo = await request('/api/atracoes', {
    method: 'POST',
    body: JSON.stringify({
      cidade: 'Tokyo',
      nome: 'Atração Teste Fluxo',
      duracao: '1h',
      preco: 500,
      descricao: 'Desc'
    })
  });
  console.log('Atração cadastrada:', JSON.stringify(novo));
  
  console.log('3. Obtendo atrações após cadastro...');
  const list2 = await request('/api/atracoes');
  console.log('Total de atrações:', list2.length);
  const item = list2.find(a => a.id === novo.id);
  console.log('Item encontrado na lista?', !!item, JSON.stringify(item));
  
  console.log('4. Deletando atração cadastrada...');
  const delRes = await request(`/api/atracoes/${novo.id}`, {
    method: 'DELETE'
  });
  console.log('Resposta do DELETE:', JSON.stringify(delRes));
  
  console.log('5. Obtendo atrações após deleção...');
  const list3 = await request('/api/atracoes');
  console.log('Total de atrações final:', list3.length);
  const itemFinal = list3.find(a => a.id === novo.id);
  console.log('Item ainda existe na lista final?', !!itemFinal);
}

run().catch(console.error);
