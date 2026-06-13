const authHeader = 'Basic ' + Buffer.from('heian:heiantour2026').toString('base64');
const baseUrl = 'http://localhost:3000';

const TEST_CLIENT_ID = '357b6e48-f954-805c-8b8f-dd2298ed9e6b';
const TEST_ROTEIRO_NOME = 'Roteiro de Teste Sincronizacao';

async function testSync() {
  console.log('=== TESTE DE SINCRONIZAÇÃO DE ROTEIRO ===\n');

  // 1. Criar e Salvar Roteiro de Teste
  console.log('1. Criando roteiro de teste...');
  const roteiroMock = {
    notionClienteId: TEST_CLIENT_ID,
    cliente: {
      nome: 'Cliente Teste Sync',
      dataInicio: '2026-06-21',
      dataFim: '2026-06-23'
    },
    dias: [
      {
        elementos: [
          { tipo: 'sequencia', cidade: 'Tokyo', atracoesDoDia: [{ nome: 'Shibuya Sky' }, { nome: 'Meiji Jingu' }] },
          { tipo: 'experiencia', nomeExp: 'Ingresso Shibuya Sky', horaPartida: '10:00' }
        ]
      },
      {
        elementos: [
          { tipo: 'transporte', tipoTransporte: 'Shinkansen', cidadeOrigem: 'Tokyo', cidadeDestino: 'Kyoto', horario: '08:30' }
        ]
      }
    ]
  };

  const saveRes = await fetch(`${baseUrl}/api/roteiros/${encodeURIComponent(TEST_ROTEIRO_NOME)}`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(roteiroMock)
  });

  if (!saveRes.ok) {
    throw new Error('Falha ao salvar roteiro mock: ' + await saveRes.text());
  }
  console.log('Roteiro mock salvo no banco local!');

  // 2. Chamar Rota de Sincronização
  console.log('\n2. Chamando POST /api/calendario/sincronizar-roteiro...');
  const syncRes = await fetch(`${baseUrl}/api/calendario/sincronizar-roteiro`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      roteiroNome: TEST_ROTEIRO_NOME
    })
  });

  if (!syncRes.ok) {
    throw new Error('Erro na sincronização: ' + await syncRes.text());
  }

  const syncData = await syncRes.json();
  console.log(`Sucesso: Roteiro sincronizado! Criados ${syncData.count} eventos no Notion.`);

  // 3. Limpar/Deletar Roteiro de Teste
  console.log('\n3. Deletando roteiro de teste do banco local...');
  await fetch(`${baseUrl}/api/roteiros/${encodeURIComponent(TEST_ROTEIRO_NOME)}`, {
    method: 'DELETE',
    headers: { 'Authorization': authHeader }
  });
  console.log('Roteiro de teste removido!');

  console.log('\n=== TESTE DE SINCRONIZAÇÃO CONCLUÍDO COM SUCESSO ===');
}

testSync().catch(console.error);
