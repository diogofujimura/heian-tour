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

async function runTests() {
  console.log('=== INICIANDO TESTES DE INTEGRAÇÃO DOS ENDPOINTS REFATORADOS ===');
  
  // 1. Orçamentos
  console.log('\n--- Testando Orçamentos ---');
  const initialOrcs = await request('/api/orcamentos');
  console.log(`Orçamentos iniciais: ${initialOrcs.length}`);
  
  const testOrcId = 999999;
  console.log(`Criando/Atualizando orçamento de teste (ID: ${testOrcId})...`);
  const t0 = Date.now();
  await request('/api/orcamentos', {
    method: 'POST',
    body: JSON.stringify({
      id: testOrcId,
      nome: 'Orçamento de Teste Refatorado',
      cliente: { nome: 'Cliente de Teste', adultos: '2', criancas: '0' },
      statusVenda: 'Pendente',
      atualizadoEm: new Date().toISOString()
    })
  });
  console.log(`POST /api/orcamentos demorou: ${Date.now() - t0}ms`);
  
  const updatedOrcs = await request('/api/orcamentos');
  const createdOrc = updatedOrcs.find(o => o.id === testOrcId);
  if (createdOrc) {
    console.log('Sucesso: Orçamento de teste encontrado no banco!');
  } else {
    throw new Error('Erro: Orçamento de teste não foi persistido');
  }
  
  console.log('Deletando orçamento de teste...');
  const t1 = Date.now();
  await request(`/api/orcamentos/${testOrcId}`, { method: 'DELETE' });
  console.log(`DELETE /api/orcamentos/${testOrcId} demorou: ${Date.now() - t1}ms`);
  
  const postDeleteOrcs = await request('/api/orcamentos');
  if (!postDeleteOrcs.some(o => o.id === testOrcId)) {
    console.log('Sucesso: Orçamento de teste deletado com sucesso!');
  } else {
    throw new Error('Erro: Orçamento de teste ainda existe no banco após DELETE');
  }
  
  // 2. Clientes Locais
  console.log('\n--- Testando Clientes Locais ---');
  const testClientId = 'client-test-999';
  console.log('Salvando dados do cliente local...');
  const t2 = Date.now();
  await request('/api/clientes/local', {
    method: 'POST',
    body: JSON.stringify({
      id: testClientId,
      estadias: [{ cidade: 'Kyoto', hotel: 'Kyoto Grand' }],
      viajantes: [{ nome: 'João', idade: 30 }],
      emails: [{ email: 'joao@teste.com' }]
    })
  });
  console.log(`POST /api/clientes/local demorou: ${Date.now() - t2}ms`);
  
  const clientData = await request(`/api/clientes/local/${testClientId}`);
  console.log('Dados do cliente local recuperados:', JSON.stringify(clientData));
  if (clientData && clientData.id === testClientId) {
    console.log('Sucesso: Dados do cliente local conferem!');
  } else {
    throw new Error('Erro: Dados do cliente local incorretos ou não encontrados');
  }
  
  console.log('Removendo dados do cliente local...');
  const t3 = Date.now();
  await request(`/api/clientes/local/${testClientId}`, { method: 'DELETE' });
  console.log(`DELETE /api/clientes/local/${testClientId} demorou: ${Date.now() - t3}ms`);
  
  const clientDataPostDelete = await request(`/api/clientes/local/${testClientId}`);
  console.log('Dados pós-deleção:', JSON.stringify(clientDataPostDelete));
  if (!clientDataPostDelete || !clientDataPostDelete.estadias || clientDataPostDelete.estadias.length === 0) {
    console.log('Sucesso: Cliente local deletado/resetado!');
  } else {
    throw new Error('Erro: Cliente local ainda possui dados após DELETE');
  }

  // 3. Configurações (Atracões, Experiências, Transportes)
  console.log('\n--- Testando Configurações (Atracões, Experiências, Transportes) ---');
  
  // Atracões
  const initialAtracoes = await request('/api/atracoes');
  console.log(`Atrações iniciais: ${initialAtracoes.length}`);
  
  const testAtracao = {
    cidade: 'Tokyo',
    nome: 'Atração de Teste Refatorada',
    duracao: '2h',
    preco: 1000,
    descricao: 'Descrição de teste'
  };
  
  console.log('Adicionando atração de teste...');
  const t4 = Date.now();
  await request('/api/atracoes', {
    method: 'POST',
    body: JSON.stringify(testAtracao)
  });
  console.log(`POST /api/atracoes demorou: ${Date.now() - t4}ms`);
  
  const updatedAtracoes = await request('/api/atracoes');
  const createdAtr = updatedAtracoes.find(a => a.nome === testAtracao.nome);
  if (createdAtr) {
    console.log('Sucesso: Atração cadastrada!');
  } else {
    throw new Error('Erro: Atração de teste não encontrada');
  }
  
  console.log('Deletando atração de teste...');
  const t5 = Date.now();
  await request(`/api/atracoes/${encodeURIComponent(createdAtr.id)}`, {
    method: 'DELETE'
  });
  console.log(`DELETE /api/atracoes/${createdAtr.id} demorou: ${Date.now() - t5}ms`);
  
  const postDeleteAtr = await request('/api/atracoes');
  if (!postDeleteAtr.some(a => a.nome === testAtracao.nome)) {
    console.log('Sucesso: Atração deletada com sucesso!');
  } else {
    throw new Error('Erro: Atração não foi deletada');
  }

  // 4. Roteiros
  console.log('\n--- Testando Roteiros ---');
  const testRoteiroNome = 'Roteiro Teste Refatorado';
  const testRoteiroObj = {
    cliente: { nome: 'Cliente do Roteiro' },
    dias: [{ dia: 1, atracoes: ['Atração 1'] }]
  };
  
  console.log('Salvando roteiro...');
  const t6 = Date.now();
  await request(`/api/roteiros/${encodeURIComponent(testRoteiroNome)}`, {
    method: 'POST',
    body: JSON.stringify(testRoteiroObj)
  });
  console.log(`POST /api/roteiros/${testRoteiroNome} demorou: ${Date.now() - t6}ms`);
  
  const roteiroDeletado = false;
  console.log('Deletando roteiro...');
  const t7 = Date.now();
  await request(`/api/roteiros/${encodeURIComponent(testRoteiroNome)}`, { method: 'DELETE' });
  console.log(`DELETE /api/roteiros/${testRoteiroNome} demorou: ${Date.now() - t7}ms`);
  
  // 5. Rotas Base
  console.log('\n--- Testando Rotas Base ---');
  const testRotaBaseObj = {
    titulo: 'Rota Base de Teste',
    dias: [{ dia: 1, atracoes: ['Atração Rota'] }]
  };
  
  console.log('Salvando rota base...');
  const t8 = Date.now();
  const createdRotaBase = await request('/api/rotas-base', {
    method: 'POST',
    body: JSON.stringify(testRotaBaseObj)
  });
  console.log(`POST /api/rotas-base demorou: ${Date.now() - t8}ms`);
  console.log('Rota base criada:', JSON.stringify(createdRotaBase));
  
  if (createdRotaBase && createdRotaBase.id) {
    console.log('Sucesso: Rota base cadastrada com ID:', createdRotaBase.id);
  } else {
    throw new Error('Erro: Rota base não retornou ID após cadastro');
  }
  
  console.log('Deletando rota base...');
  const t9 = Date.now();
  await request(`/api/rotas-base/${encodeURIComponent(createdRotaBase.id)}`, { method: 'DELETE' });
  console.log(`DELETE /api/rotas-base/${createdRotaBase.id} demorou: ${Date.now() - t9}ms`);
  
  console.log('\n=== TODOS OS TESTES PASSARAM COM SUCESSO! ===');
}

runTests().catch(err => {
  console.error('\n❌ ERRO NOS TESTES:', err);
  process.exit(1);
});
