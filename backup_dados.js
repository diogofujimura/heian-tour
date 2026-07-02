// backup_dados.js — Backup completo dos dados do Supabase para arquivos locais
// Uso: node backup_dados.js
// Cria a pasta backups/AAAA-MM-DD_HHMM/ com um JSON por tabela.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const agora = new Date();
  const pasta = path.join(__dirname, 'backups',
    agora.toISOString().slice(0, 10) + '_' + String(agora.getHours()).padStart(2, '0') + String(agora.getMinutes()).padStart(2, '0'));
  fs.mkdirSync(pasta, { recursive: true });

  const tabelas = ['roteiros', 'orcamentos', 'clientes_locais', 'config', 'rotas_base'];
  for (const t of tabelas) {
    const { data, error } = await supabase.from(t).select('*');
    if (error) {
      console.error(`ERRO ao ler ${t}:`, error.message);
      continue;
    }
    fs.writeFileSync(path.join(pasta, t + '.json'), JSON.stringify(data, null, 2), 'utf-8');
    console.log(`OK ${t}: ${(data || []).length} registros`);
  }
  console.log('\nBackup salvo em:', pasta);
}

main().catch(e => { console.error('Falha no backup:', e.message); process.exit(1); });
