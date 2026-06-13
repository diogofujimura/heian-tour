const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  const { data: calCfg } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
  const eventos = calCfg && calCfg.data ? calCfg.data : [];
  
  const isNested = Array.isArray(eventos.data);
  const listaEventos = isNested ? eventos.data : (Array.isArray(eventos) ? eventos : []);
  
  let modificado = false;
  
  const novaLista = listaEventos.map(ev => {
    if (ev.id === 'cal_exp_1781209346219_11_0_0dx1w3p92') {
      console.log('Modificando evento Disney Sea...');
      
      // Corrige Assignees
      const novosAssignees = ev.assignee.map(colab => {
        if (colab.id === 'colab_deborah_fake_id') {
          return {
            id: '2a0b6e48-f954-81e3-9503-e6b17e7cb1c0',
            name: 'Deborah Lipka (guia e CEO)'
          };
        }
        return colab;
      });
      
      // Corrige diária
      const novasDiarias = {};
      if (ev.valorDiariaColab) {
        Object.keys(ev.valorDiariaColab).forEach(key => {
          if (key === 'colab_deborah_fake_id') {
            novasDiarias['2a0b6e48-f954-81e3-9503-e6b17e7cb1c0'] = ev.valorDiariaColab[key];
          } else {
            novasDiarias[key] = ev.valorDiariaColab[key];
          }
        });
      }
      
      // Corrige pago
      const novosPagos = {};
      if (ev.pagoColab) {
        Object.keys(ev.pagoColab).forEach(key => {
          if (key === 'colab_deborah_fake_id') {
            novosPagos['2a0b6e48-f954-81e3-9503-e6b17e7cb1c0'] = ev.pagoColab[key];
          } else {
            novosPagos[key] = ev.pagoColab[key];
          }
        });
      }
      
      modificado = true;
      return {
        ...ev,
        assignee: novosAssignees,
        valorDiariaColab: novasDiarias,
        pagoColab: novosPagos
      };
    }
    return ev;
  });
  
  if (modificado) {
    const dataToSave = isNested ? { data: novaLista } : novaLista;
    const { error } = await supabase.from('config').upsert({ id: 'calendario_eventos', data: dataToSave });
    if (error) {
      console.error('Erro ao salvar:', error);
    } else {
      console.log('Evento corrigido com sucesso no Supabase!');
    }
  } else {
    console.log('Evento não encontrado para correção.');
  }
}

fix();
