const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server.js');
let code = fs.readFileSync(serverFile, 'utf8');

// Helper to replace block
function replaceBlock(regex, replacement) {
  code = code.replace(regex, replacement);
}

// 1. Remove readDB and writeDB
code = code.replace(/function readDB\(\) \{[\s\S]*?function writeDB\(data\) \{[\s\S]*?\}\n\}/m, '');

// 2. Change /api/config
code = code.replace(/app\.get\('\/api\/config', \(req, res\) => \{[\s\S]*?\}\);/m, 
`app.get('/api/config', async (req, res) => {
  const { data } = await supabase.from('config').select('data').eq('id', 'app_config').single();
  res.json(data ? data.data : {});
});`);

code = code.replace(/app\.post\('\/api\/config', \(req, res\) => \{[\s\S]*?\}\);/m, 
`app.post('/api/config', async (req, res) => {
  const { data: current } = await supabase.from('config').select('data').eq('id', 'app_config').single();
  const config = current ? current.data : {};
  const newConfig = { ...config, ...req.body };
  await supabase.from('config').upsert({ id: 'app_config', data: newConfig });
  res.json({ ok: true });
});`);

// 3. Change /api/orcamentos
code = code.replace(/app\.get\('\/api\/orcamentos', \(req, res\) => res\.json\(readDB\(\)\.orcamentosDB\)\);/m, 
`app.get('/api/orcamentos', async (req, res) => {
  const { data } = await supabase.from('orcamentos').select('data');
  res.json((data || []).map(r => r.data));
});`);

code = code.replace(/app\.post\('\/api\/orcamentos', \(req, res\) => \{[\s\S]*?\}\);/m, 
`app.post('/api/orcamentos', async (req, res) => {
  await supabase.from('orcamentos').upsert({ id: req.body.id, data: req.body });
  res.json({success:true});
});`);

code = code.replace(/app\.delete\('\/api\/orcamentos\/:id', \(req, res\) => \{[\s\S]*?\}\);/m, 
`app.delete('/api/orcamentos/:id', async (req, res) => {
  await supabase.from('orcamentos').delete().eq('id', req.params.id);
  res.json({success:true});
});`);

// 4. Change /api/clientes/local
code = code.replace(/app\.get\('\/api\/clientes\/local\/:id', \(req, res\) => \{[\s\S]*?\}\);/m, 
`app.get('/api/clientes/local/:id', async (req, res) => {
  const { data } = await supabase.from('clientes_locais').select('data').eq('id', req.params.id).single();
  res.json(data ? data.data : { id: req.params.id, estadias: [] });
});`);

code = code.replace(/app\.post\('\/api\/clientes\/local', \(req, res\) => \{[\s\S]*?\}\);/m, 
`app.post('/api/clientes/local', async (req, res) => {
  await supabase.from('clientes_locais').upsert({ id: req.body.id, data: req.body });
  res.json({success:true});
});`);

// We'll write the rest of the file updates for transportes, experiencias, atracoes, rotas
fs.writeFileSync(path.join(__dirname, 'refactor.js'), code);
console.log("Refactor logic prepared.");
