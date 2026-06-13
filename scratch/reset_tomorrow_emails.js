require('dotenv').config({ path: 'c:/Users/User/Documents/heian-quote/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function resetTomorrowEmails() {
  console.log('--- Resetando logs de e-mail para os compromissos de amanhã (2026-06-14) ---');
  try {
    const { data: calCfg, error: calErr } = await supabase
      .from('config')
      .select('data')
      .eq('id', 'calendario_eventos')
      .single();

    if (calErr) {
      console.error('Erro ao buscar dados do Supabase:', calErr);
      return;
    }

    let eventos = Array.isArray(calCfg.data) ? calCfg.data : [];
    let alterados = 0;

    for (let ev of eventos) {
      // Data de amanhã (2026-06-14)
      if (ev.dataServico === '2026-06-14') {
        console.log(`Resetando evento encontrado: "${ev.titulo}"`);
        ev.emails_cadastro_enviados = [];
        ev.emails_24h_enviados = [];
        ev.emails_1h_enviados = [];
        alterados++;
      }
    }

    if (alterados > 0) {
      console.log(`Salvando ${alterados} alterações no Supabase...`);
      const { error: upsertErr } = await supabase
        .from('config')
        .upsert({ id: 'calendario_eventos', data: eventos });

      if (upsertErr) {
        console.error('Erro ao salvar no Supabase:', upsertErr);
      } else {
        console.log('Logs de e-mail resetados com sucesso no banco de dados!');
      }
    } else {
      console.log('Nenhum evento agendado para amanhã (2026-06-14) foi encontrado no calendário.');
    }
  } catch (err) {
    console.error('Erro geral durante o reset:', err);
  }
}

resetTomorrowEmails();
