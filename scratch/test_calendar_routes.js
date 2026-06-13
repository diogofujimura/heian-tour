const authHeader = 'Basic ' + Buffer.from('heian:heiantour2026').toString('base64');
const baseUrl = 'http://localhost:3000';

async function runTests() {
  console.log('=== INICIANDO TESTES DO CALENDÁRIO & COLABORADORES ===\n');

  // Teste 1: Colaboradores
  console.log('--- Testando GET /api/notion/colaboradores ---');
  const resCol = await fetch(`${baseUrl}/api/notion/colaboradores`, {
    headers: { 'Authorization': authHeader }
  });
  if (!resCol.ok) {
    throw new Error(`Erro colaboradores: ${resCol.status} - ${await resCol.text()}`);
  }
  const colaboradores = await resCol.json();
  console.log(`Sucesso: ${colaboradores.length} colaboradores encontrados.`);
  if (colaboradores.length > 0) {
    console.log('Exemplo colaborador:', colaboradores[0]);
  }

  // Teste 2: Eventos do Calendário
  console.log('\n--- Testando GET /api/calendario/eventos ---');
  const resEv = await fetch(`${baseUrl}/api/calendario/eventos?data_inicio=2026-06-01&data_fim=2026-06-30`, {
    headers: { 'Authorization': authHeader }
  });
  if (!resEv.ok) {
    throw new Error(`Erro eventos: ${resEv.status} - ${await resEv.text()}`);
  }
  const eventos = await resEv.json();
  console.log(`Sucesso: ${eventos.length} eventos encontrados para Junho/2026.`);
  if (eventos.length > 0) {
    console.log('Exemplo evento:', eventos[0]);
  }

  // Teste 3: Atualizar Assignee
  if (eventos.length > 0 && colaboradores.length > 0) {
    const targetEvent = eventos[0];
    const targetColaborador = colaboradores[0];
    console.log(`\n--- Testando PATCH /api/calendario/eventos/${targetEvent.id} (Designar ${targetColaborador.name}) ---`);
    
    const resPatch = await fetch(`${baseUrl}/api/calendario/eventos/${targetEvent.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assigneeIds: [targetColaborador.id]
      })
    });
    if (!resPatch.ok) {
      throw new Error(`Erro patch: ${resPatch.status} - ${await resPatch.text()}`);
    }
    console.log('Sucesso: Assignee do evento atualizado no Notion!');
  } else {
    console.log('\nPulando teste de patch pois não há eventos ou colaboradores disponíveis.');
  }

  console.log('\n=== TODOS OS TESTES DE CALENDÁRIO PASSARAM COM SUCESSO! ===');
}

runTests().catch(console.error);
