require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const db = JSON.parse(fs.readFileSync('database.json', 'utf8'));

async function migrate() {
  console.log('Migrando Config...');
  await supabase.from('config').upsert({ id: 'app_config', data: db.config || {} });
  await supabase.from('config').upsert({ id: 'transportes', data: db.transportes || [] });
  await supabase.from('config').upsert({ id: 'experiencias', data: db.experiencias || [] });
  await supabase.from('config').upsert({ id: 'atracoes', data: db.atracoes || [] });

  console.log('Migrando Orcamentos...');
  for (let o of db.orcamentosDB || []) {
    await supabase.from('orcamentos').upsert({ id: String(o.id), data: o });
  }

  console.log('Migrando Clientes...');
  for (let c of db.clientesDB || []) {
    await supabase.from('clientes_locais').upsert({ id: String(c.id), data: c });
  }

  console.log('Migrando Rotas...');
  for (let [nome, dados] of Object.entries(db.rotas || {})) {
    if (nome === '[PLANILHA] Base de Rotas') {
      await supabase.from('rotas_base').upsert({ id: 'base', data: dados.dias || dados });
    } else {
      await supabase.from('roteiros').upsert({ nome, data: dados });
    }
  }
  
  console.log('Migração concluída com sucesso!');
}

migrate();
