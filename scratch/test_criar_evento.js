
async function testarCriarEvento() {
  const payload = {
    titulo: 'Teste Manual Shinkansen Sem Lançamento',
    tipoServico: 'Transporte',
    dataServico: '2026-06-25',
    clienteId: 'cliente_desconhecido',
    cidade: 'Tokyo ➔ Kyoto',
    observacoes: 'Testando bilhete sem lançar contabilidade',
    richData: {
      tipoTransporte: 'Shinkansen',
      horario: '11:30',
      origem: 'Tokyo',
      destino: 'Kyoto',
      linha: 'Nozomi 25',
      categoria: 'Green Car',
      tempo: '2h15m',
      adultos: 2,
      compradoHeian: true
    },
    lancarFinanceiro: false,
    contaFinanceiraId: '2bab6e48-f954-8012-8b90-c5bf3c14eb6a',
    valorCusto: 8500
  };

  try {
    const response = await fetch('http://localhost:3000/api/calendario/eventos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Resposta do Servidor:', JSON.stringify(data, null, 2));
    if (data.success) {
      console.log('✅ Sucesso: O evento manual foi cadastrado com sucesso!');
    } else {
      console.error('❌ Falha ao cadastrar evento:', data.error);
    }
  } catch (error) {
    console.error('❌ Erro de conexão:', error.message);
  }
}

testarCriarEvento();
