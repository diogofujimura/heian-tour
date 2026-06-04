const fs = require('fs');

let serverCode = fs.readFileSync('server.js', 'utf8');

const targetStr = \`app.delete('/api/rotas-base/:id', (req, res) => {
    const db = readDB();
    if (!db.rotas || !db.rotas['[PLANILHA] Base de Rotas']) return res.status(404).json({ error: 'Base vazia' });
    
    // EXCLUSÃO DO GOOGLE SHEETS DESATIVADA A PEDIDO DO USUÁRIO
    db.rotas['[PLANILHA] Base de Rotas'].dias = db.rotas['[PLANILHA] Base de Rotas'].dias.filter(d => d.id != req.params.id);
    writeDB(db);
    res.json({ ok: true });
  });\`;

const newStr = \`app.delete('/api/rotas-base/:id', (req, res) => {
    const db = readDB();
    if (!db.rotas || !db.rotas['[PLANILHA] Base de Rotas']) return res.status(404).json({ error: 'Base vazia' });
    
    const dias = db.rotas['[PLANILHA] Base de Rotas'].dias;
    const oldItem = dias.find(d => d.id == req.params.id);
    db.rotas['[PLANILHA] Base de Rotas'].dias = dias.filter(d => d.id != req.params.id);
    writeDB(db);
    
    if (oldItem) syncToGoogleSheets('rotas', 'delete', oldItem);
    res.json({ ok: true });
  });\`;

// We'll use string replacement, but just in case of newline differences, let's just find the start of the block and the end.
const startIdx = serverCode.indexOf("app.delete('/api/rotas-base/:id'");
if (startIdx !== -1) {
    const endIdx = serverCode.indexOf("});", startIdx) + 3;
    serverCode = serverCode.substring(0, startIdx) + newStr + serverCode.substring(endIdx);
    fs.writeFileSync('server.js', serverCode, 'utf8');
    console.log('Patch success!');
} else {
    console.log('Could not find the block!');
}
