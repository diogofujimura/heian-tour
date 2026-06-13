const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debug() {
  const targetClientId = '2f1b6e48-f954-80a0-948d-f8a4b3b0feae';
  const { data: calCfg } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
  const eventos = calCfg && calCfg.data ? calCfg.data : [];
  
  const evsCliente = eventos.filter(ev => ev.clienteId === targetClientId || (ev.clientes && ev.clientes.includes(targetClientId)));
  
  console.log(`Cliente: "Sakura" (ID: ${targetClientId})`);
  console.log(`Total de eventos associados a este cliente: ${evsCliente.length}`);
  
  evsCliente.forEach(ev => {
    console.log(`\n- Evento: "${ev.titulo}"`);
    console.log(`  Data: ${ev.dataServico}`);
    console.log(`  Guias Designados:`, ev.assignee);
    console.log(`  Diária dos Guias (valorDiariaColab):`, ev.valorDiariaColab);
    console.log(`  Status de Pagamento (pagoColab):`, ev.pagoColab);
  });
}

debug();
