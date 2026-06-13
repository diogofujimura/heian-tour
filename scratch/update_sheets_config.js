const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateConfig() {
  console.log('=== ATUALIZANDO CONFIGURAÇÃO DE ABAS NO SUPABASE ===');
  
  // 1. Obter config atual
  const { data: cfgData, error: cfgErr } = await supabase.from('config').select('data').eq('id', 'app_config').single();
  if (cfgErr) {
    console.error('Erro ao ler config:', cfgErr);
    return;
  }
  
  const currentConfig = cfgData.data || {};
  console.log('Config atual:', JSON.stringify(currentConfig, null, 2));
  
  // 2. Atualizar os campos das abas
  const updatedConfig = {
    ...currentConfig,
    sheets_aba_transportes: 'Base',
    sheets_aba_experiencias: 'BaseEX'
  };
  
  // 3. Salvar de volta
  const { error: upsertErr } = await supabase.from('config').upsert({ id: 'app_config', data: updatedConfig });
  if (upsertErr) {
    console.error('Erro ao salvar config atualizada:', upsertErr);
  } else {
    console.log('Configurações atualizadas com sucesso!sheets_aba_transportes = "Base" e sheets_aba_experiencias = "BaseEX"');
  }
}

updateConfig().catch(console.error);
