const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/User/Documents/heian-quote/.env' });

console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Definido' : 'Indefinido');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Definido' : 'Indefinido');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Definido' : 'Indefinido');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function test() {
  const calCfg = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
  console.log('calCfg keys:', Object.keys(calCfg));
  console.log('calCfg.data keys/type:', typeof calCfg.data, Array.isArray(calCfg.data));
  if (calCfg.data) {
    console.log('calCfg.data.data type/isArray:', typeof calCfg.data.data, Array.isArray(calCfg.data.data));
    if (calCfg.data.data) {
      console.log('Length of calCfg.data.data:', calCfg.data.data.length);
    }
  }
}

test();
