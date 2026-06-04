const fs = require('fs');

// Patch server.js
let serverCode = fs.readFileSync('server.js', 'utf8');
const serverTarget = /app\.delete\('\/api\/rotas-base\/:id', \(req, res\) => \{[\s\S]*?res\.json\(\{ ok: true \}\);\n  \}\);/g;
const serverReplacement = `app.delete('/api/rotas-base/:id', (req, res) => {
    const db = readDB();
    if (!db.rotas || !db.rotas['[PLANILHA] Base de Rotas']) return res.status(404).json({ error: 'Base vazia' });
    
    const dias = db.rotas['[PLANILHA] Base de Rotas'].dias;
    const oldItem = dias.find(d => d.id == req.params.id);
    db.rotas['[PLANILHA] Base de Rotas'].dias = dias.filter(d => d.id != req.params.id);
    writeDB(db);
    
    if (oldItem) syncToGoogleSheets('rotas', 'delete', oldItem);
    res.json({ ok: true });
  });`;
serverCode = serverCode.replace(serverTarget, serverReplacement);
fs.writeFileSync('server.js', serverCode, 'utf8');

// Patch app.js
let appCode = fs.readFileSync('public/js/app.js', 'utf8');
const appTarget = /Remover esta Rota Base do App\? \(Ela não será apagada da Planilha, pois o robô de Rotas não apaga coisas lá\)/g;
const appReplacement = `Remover esta Rota Base do App e da Planilha?`;
appCode = appCode.replace(appTarget, appReplacement);
fs.writeFileSync('public/js/app.js', appCode, 'utf8');

console.log('Delete from sheets patch applied successfully.');
