const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  const { data: calCfg } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
  const eventos = calCfg && calCfg.data ? calCfg.data : [];
  
  // Se vier como { data: [...] } ou diretamente o array
  const listaEventos = Array.isArray(eventos.data) ? eventos.data : (Array.isArray(eventos) ? eventos : []);
  
  console.log(`Total de eventos no calendário: ${listaEventos.length}`);
  
  const alvos = listaEventos.filter(ev => {
    // Procura por colab_deborah_fake_id
    if (ev.assignee && ev.assignee.length > 0) {
      return ev.assignee.some(colab => colab.id === 'colab_deborah_fake_id' || colab.name === 'colab_deborah_fake_id');
    }
    return false;
  });
  
  console.log(`Encontrados ${alvos.length} eventos com o ID falso.`);
  
  alvos.forEach(ev => {
    console.log('\n--- Evento Falso ---');
    console.log(`ID: ${ev.id}`);
    console.log(`Título: ${ev.titulo}`);
    console.log(`Data: ${ev.dataServico}`);
    console.log(`Assignees:`, ev.assignee);
    console.log(`Diária:`, ev.valorDiariaColab);
    console.log(`Pago:`, ev.pagoColab);
  });
}

inspect();
