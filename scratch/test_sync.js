require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  try {
    const { data: cfgData, error: cfgErr } = await supabase.from('config').select('data').eq('id', 'app_config').single();
    if (cfgErr) throw cfgErr;
    
    const url = cfgData.data.sheets_script_url;
    const sheetName = cfgData.data.sheets_aba_atracoes || 'Atracoes';
    
    console.log('Testando sincronização para URL:', url);
    console.log('Nome da aba:', sheetName);
    
    if (!url) {
      console.error('URL de sincronização do Sheets não configurada.');
      return;
    }
    
    const testData = {
      'Cidade': 'Tokyo',
      'Bairro': 'Shibuya',
      'Nome da Atração': 'Atração de Teste Sync',
      'Descrição Detalhada': 'Testando sincronização com as novas colunas',
      'Preço (Ingresso)': 'Gratuito',
      'diasFechados': [1, 2], // Segunda e Terça
      'id': '9999999999999', // ID de teste
      'manutencaoInicio': '2026-07-01',
      'manutencaoFim': '2026-07-15',
      'manutencaoMotivo': 'Reforma'
    };
    
    // 1. Inserção
    console.log('1. Inserindo atração de teste...');
    const insertPayload = {
      action: 'insert',
      type: 'atracoes',
      sheetName,
      data: testData
    };
    const insRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insertPayload)
    });
    const insResVal = await insRes.json();
    console.log('Resposta do Google Sheets (Inserção):', insResVal);
    
    // 2. Atualização
    console.log('2. Atualizando atração de teste...');
    const updatePayload = {
      action: 'update',
      type: 'atracoes',
      sheetName,
      data: {
        ...testData,
        'Descrição Detalhada': 'Descrição atualizada pelo teste de sincronização'
      }
    };
    const updRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload)
    });
    const updResVal = await updRes.json();
    console.log('Resposta do Google Sheets (Atualização):', updResVal);
    
    // 3. Deleção (Limpeza)
    console.log('3. Removendo atração de teste do Sheets (Limpeza)...');
    const delPayload = {
      action: 'delete',
      type: 'atracoes',
      sheetName,
      data: testData
    };
    const delRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(delPayload)
    });
    const delResVal = await delRes.json();
    console.log('Resposta do Google Sheets (Deleção):', delResVal);
    
  } catch (e) {
    console.error('Erro no teste de sincronização:', e);
  }
}

run();
