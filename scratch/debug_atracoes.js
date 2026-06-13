const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('config').select('data').eq('id', 'atracoes').single();
  if (error) {
    console.error('Erro:', error);
    return;
  }
  const list = data?.data || [];
  console.log('Total de atrações:', list.length);
  const testItems = list.filter(a => a.nome && a.nome.includes('Refatorada'));
  console.log('Itens de teste encontrados:', JSON.stringify(testItems, null, 2));
}

check();
