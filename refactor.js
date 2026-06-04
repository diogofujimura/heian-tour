const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

// Faz o replace das funções de Express para async
code = code.replace(/app\.(get|post|put|delete|patch)\(([^,]+),\s*(async\s*)?\(req,\s*res\)\s*=>/g, 'app.$1($2, async (req, res) =>');

// Troca o readDB() por await readDB()
code = code.replace(/const db = readDB\(\);/g, 'const db = await readDB();');
code = code.replace(/writeDB\(db\);/g, 'await writeDB(db);');

// Troca o syncToGoogleSheets(..., oldItem) por await
code = code.replace(/syncToGoogleSheets\(/g, 'await syncToGoogleSheets(');

// Reescreve readDB
const newRead = `async function readDB() {
  try {
    const defaultData = { config: {}, transportes: [], experiencias: [], atracoes: [], rotas: {}, orcamentosDB: [], clientesDB: [] };
    
    // Traz config
    const { data: cfg } = await supabase.from('config').select('data').eq('id', 'app_config').single();
    if (cfg && cfg.data) defaultData.config = cfg.data;
    
    // Traz transportes, experiencias, atracoes da config
    const { data: transp } = await supabase.from('config').select('data').eq('id', 'transportes').single();
    if (transp && transp.data) defaultData.transportes = transp.data;

    const { data: exp } = await supabase.from('config').select('data').eq('id', 'experiencias').single();
    if (exp && exp.data) defaultData.experiencias = exp.data;

    const { data: atr } = await supabase.from('config').select('data').eq('id', 'atracoes').single();
    if (atr && atr.data) defaultData.atracoes = atr.data;

    // Traz orcamentos
    const { data: orcs } = await supabase.from('orcamentos').select('data');
    if (orcs) defaultData.orcamentosDB = orcs.map(r => r.data);

    // Traz clientes_locais
    const { data: clis } = await supabase.from('clientes_locais').select('data');
    if (clis) defaultData.clientesDB = clis.map(r => r.data);

    // Traz roteiros
    const { data: rots } = await supabase.from('roteiros').select('*');
    if (rots) {
      rots.forEach(r => {
        defaultData.rotas[r.nome] = r.data;
      });
    }

    // Traz rotas_base
    const { data: base } = await supabase.from('rotas_base').select('data').eq('id', 'base').single();
    if (base && base.data) {
      defaultData.rotas['[PLANILHA] Base de Rotas'] = { dias: base.data };
    }

    return defaultData;
  } catch(e) {
    console.error('Erro no readDB do Supabase:', e);
    return { config: {}, transportes: [], experiencias: [], atracoes: [], rotas: {}, orcamentosDB: [], clientesDB: [] };
  }
}`;

const newWrite = `async function writeDB(db) {
  try {
    // Para simplificar essa transição imediata 1:1, gravamos as tabelas chaves
    await supabase.from('config').upsert({ id: 'app_config', data: db.config || {} });
    await supabase.from('config').upsert({ id: 'transportes', data: db.transportes || [] });
    await supabase.from('config').upsert({ id: 'experiencias', data: db.experiencias || [] });
    await supabase.from('config').upsert({ id: 'atracoes', data: db.atracoes || [] });

    for (let o of db.orcamentosDB || []) {
      await supabase.from('orcamentos').upsert({ id: String(o.id), data: o });
    }
    for (let c of db.clientesDB || []) {
      await supabase.from('clientes_locais').upsert({ id: String(c.id), data: c });
    }

    // Deleta rotas velhas e insere novas
    for (let [nome, dados] of Object.entries(db.rotas || {})) {
      if (nome === '[PLANILHA] Base de Rotas') {
        await supabase.from('rotas_base').upsert({ id: 'base', data: dados.dias });
      } else {
        await supabase.from('roteiros').upsert({ nome, data: dados });
      }
    }
  } catch(e) {
    console.error('Erro no writeDB:', e);
  }
}`;

code = code.replace(/function readDB\(\) \{[\s\S]*?function writeDB\(data\) \{[\s\S]*?\n\}/m, newRead + '\n\n' + newWrite);

fs.writeFileSync('server.js', code);
console.log('Done!');
