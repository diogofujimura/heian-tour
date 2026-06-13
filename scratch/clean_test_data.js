const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function clean() {
  console.log('=== LIMPANDO DADOS DE TESTE DO SUPABASE ===');
  
  // 1. Limpar Atrações de Teste
  console.log('Limpando atrações de teste...');
  const { data: atrData, error: atrErr } = await supabase.from('config').select('data').eq('id', 'atracoes').single();
  if (!atrErr && atrData && atrData.data) {
    const list = atrData.data;
    const cleanList = list.filter(a => {
      const nome = a.nome || a['Nome da Atração'] || '';
      return !nome.includes('Refatorada') && !nome.includes('Fluxo');
    });
    if (list.length !== cleanList.length) {
      const { error: upsertErr } = await supabase.from('config').upsert({ id: 'atracoes', data: cleanList });
      if (upsertErr) {
        console.error('Erro ao salvar atrações limpas:', upsertErr);
      } else {
        console.log(`Removidas ${list.length - cleanList.length} atrações de teste.`);
      }
    } else {
      console.log('Nenhuma atração de teste encontrada.');
    }
  }

  // 2. Limpar Orçamentos de Teste
  console.log('Limpando orçamentos de teste...');
  const { error: orcErr } = await supabase.from('orcamentos').delete().eq('id', '999999');
  if (orcErr) console.error('Erro ao deletar orçamento de teste:', orcErr);
  else console.log('Orçamento de teste 999999 deletado se existia.');

  // 3. Limpar Clientes Locais de Teste
  console.log('Limpando clientes locais de teste...');
  const { error: cliErr } = await supabase.from('clientes_locais').delete().eq('id', 'client-test-999');
  if (cliErr) console.error('Erro ao deletar cliente de teste:', cliErr);
  else console.log('Cliente local de teste client-test-999 deletado se existia.');

  // 4. Limpar Roteiros de Teste
  console.log('Limpando roteiros de teste...');
  const { error: rotErr } = await supabase.from('roteiros').delete().eq('nome', 'Roteiro Teste Refatorado');
  if (rotErr) console.error('Erro ao deletar roteiro de teste:', rotErr);
  else console.log('Roteiro de teste deletado se existia.');
}

clean().catch(console.error);
