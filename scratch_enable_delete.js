const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

const tSearch = `app.delete('/api/transportes/:id', (req, res) => {
  const db = readDB();
  // EXCLUSÃO DO GOOGLE SHEETS DESATIVADA A PEDIDO DO USUÁRIO
  db.transportes = db.transportes.filter(t => t.id != req.params.id);
  writeDB(db);
  res.json({ ok: true });
});`;
const tReplace = `app.delete('/api/transportes/:id', (req, res) => {
  const db = readDB();
  const oldItem = db.transportes.find(t => t.id == req.params.id);
  db.transportes = db.transportes.filter(t => t.id != req.params.id);
  writeDB(db);
  if (oldItem) syncToGoogleSheets('transportes', 'delete', { _oldKey: oldItem.trecho });
  res.json({ ok: true });
});`;

const eSearch = `app.delete('/api/experiencias/:id', (req, res) => {
  const db = readDB();
  // EXCLUSÃO DO GOOGLE SHEETS DESATIVADA A PEDIDO DO USUÁRIO
  db.experiencias = db.experiencias.filter(e => e.id != req.params.id);
  writeDB(db);
  res.json({ ok: true });
});`;
const eReplace = `app.delete('/api/experiencias/:id', (req, res) => {
  const db = readDB();
  const oldItem = db.experiencias.find(e => e.id == req.params.id);
  db.experiencias = db.experiencias.filter(e => e.id != req.params.id);
  writeDB(db);
  if (oldItem) syncToGoogleSheets('experiencias', 'delete', { _oldKey: oldItem.nome });
  res.json({ ok: true });
});`;

const aSearch = `app.delete('/api/atracoes/:id', (req, res) => {
  const db = readDB();
  // EXCLUSÃO DO GOOGLE SHEETS DESATIVADA A PEDIDO DO USUÁRIO
  db.atracoes = db.atracoes.filter(a => a.id != req.params.id && a['Nome da Atração'] !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});`;
const aReplace = `app.delete('/api/atracoes/:id', (req, res) => {
  const db = readDB();
  const oldItem = db.atracoes.find(a => a.id == req.params.id || a['Nome da Atração'] === req.params.id);
  db.atracoes = db.atracoes.filter(a => a.id != req.params.id && a['Nome da Atração'] !== req.params.id);
  writeDB(db);
  if (oldItem) syncToGoogleSheets('atracoes', 'delete', { _oldKey: oldItem['Nome da Atração'] });
  res.json({ ok: true });
});`;

const rSearch = `app.delete('/api/rotas-base/:id', (req, res) => {
  const db = readDB();
  if (!db.rotas || !db.rotas['[PLANILHA] Base de Rotas']) return res.status(404).json({ error: 'Base vazia' });
  
  // EXCLUSÃO DO GOOGLE SHEETS DESATIVADA A PEDIDO DO USUÁRIO
  db.rotas['[PLANILHA] Base de Rotas'].dias = db.rotas['[PLANILHA] Base de Rotas'].dias.filter(d => d.id != req.params.id);
  writeDB(db);
  res.json({ ok: true });
});`;
const rReplace = `app.delete('/api/rotas-base/:id', (req, res) => {
  const db = readDB();
  if (!db.rotas || !db.rotas['[PLANILHA] Base de Rotas']) return res.status(404).json({ error: 'Base vazia' });
  
  const oldItem = db.rotas['[PLANILHA] Base de Rotas'].dias.find(d => d.id == req.params.id);
  db.rotas['[PLANILHA] Base de Rotas'].dias = db.rotas['[PLANILHA] Base de Rotas'].dias.filter(d => d.id != req.params.id);
  writeDB(db);
  if (oldItem) syncToGoogleSheets('rotas', 'delete', { _oldKey: oldItem.nomeDaRota });
  res.json({ ok: true });
});`;

// Replace ignoring special characters by using simpler regex if strictly needed, but exact string replace should work if encoding matches
// The file is utf8, so let's try direct replace. If it fails due to encoding (e.g. 'Atração' vs 'Atrao'), we'll use generic regex.

function cleanStr(s) { return s.replace(/[^\x20-\x7E]/g, '.'); }

function patch(str, searchStr, replaceStr) {
    // Escape regex
    const regexStr = cleanStr(searchStr).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s+').replace(/\./g, '.');
    const regex = new RegExp(regexStr);
    return str.replace(regex, replaceStr);
}

server = patch(server, tSearch, tReplace);
server = patch(server, eSearch, eReplace);
server = patch(server, aSearch, aReplace);
server = patch(server, rSearch, rReplace);

fs.writeFileSync('server.js', server);
console.log('Deletions enabled in server.js');
