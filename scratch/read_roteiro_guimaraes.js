const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoteiro() {
  const nome = 'Roteiro - Família Guimarães';
  console.log(`Buscando roteiro: "${nome}"...`);
  const { data, error } = await supabase.from('roteiros').select('*').eq('nome', nome).single();
  if (error) {
    console.error('Erro:', error);
    return;
  }
  console.log('Roteiro encontrado!');
  console.log('notionClienteId:', data.data?.notionClienteId);
  console.log('cliente (no roteiro):', JSON.stringify(data.data?.cliente, null, 2));
}

checkRoteiro().catch(console.error);
