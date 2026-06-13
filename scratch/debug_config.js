const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('config').select('data').eq('id', 'app_config').single();
  if (error) {
    console.error('Erro:', error);
    return;
  }
  console.log('Configurações do aplicativo:', JSON.stringify(data.data, null, 2));
}

check();
