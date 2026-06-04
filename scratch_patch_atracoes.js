const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

const regex = /app\.delete\('\/api\/atracoes\/:id',[\s\S]*?res\.json\(\{ ok: true \}\);\n\}\);/;
const replace = `app.delete('/api/atracoes/:id', (req, res) => {
  const db = readDB();
  const oldItem = db.atracoes.find(a => a.id == req.params.id || a['Nome da Atra\u00E7\u00E3o'] === req.params.id);
  db.atracoes = db.atracoes.filter(a => a.id != req.params.id && a['Nome da Atra\u00E7\u00E3o'] !== req.params.id);
  writeDB(db);
  if (oldItem) syncToGoogleSheets('atracoes', 'delete', oldItem);
  res.json({ ok: true });
});`;

if (s.match(regex)) {
  s = s.replace(regex, replace);
  fs.writeFileSync('server.js', s);
  console.log('Patched atracoes delete');
} else {
  console.log('Not found');
}
