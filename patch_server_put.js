const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

// Transportes
code = code.replace(
  "  db.transportes[idx] = { ...db.transportes[idx], ...req.body };\n  writeDB(db);\n  \n  // Sincroniza em background\n  syncToGoogleSheets('transportes', 'update', db.transportes[idx]);",
  "  const oldItem = db.transportes[idx];\n  db.transportes[idx] = { ...db.transportes[idx], ...req.body };\n  writeDB(db);\n  \n  // Sincroniza em background\n  const payload = { ...db.transportes[idx], _oldKey: oldItem.trecho };\n  syncToGoogleSheets('transportes', 'update', payload);"
);

// Experiencias
code = code.replace(
  "  db.experiencias[idx] = { ...db.experiencias[idx], ...req.body };\n  writeDB(db);\n  \n  // Sincroniza em background\n  syncToGoogleSheets('experiencias', 'update', db.experiencias[idx]);",
  "  const oldItem = db.experiencias[idx];\n  db.experiencias[idx] = { ...db.experiencias[idx], ...req.body };\n  writeDB(db);\n  \n  // Sincroniza em background\n  const payload = { ...db.experiencias[idx], _oldKey: oldItem.nome };\n  syncToGoogleSheets('experiencias', 'update', payload);"
);

// Atracoes
code = code.replace(
  "  db.atracoes[idx] = { ...db.atracoes[idx], ...req.body };\n  writeDB(db);\n  \n  // Sincroniza em background\n  syncToGoogleSheets('atracoes', 'update', db.atracoes[idx]);",
  "  const oldItem = db.atracoes[idx];\n  db.atracoes[idx] = { ...db.atracoes[idx], ...req.body };\n  writeDB(db);\n  \n  // Sincroniza em background\n  const payload = { ...db.atracoes[idx], _oldKey: oldItem['Nome da Atração'] };\n  syncToGoogleSheets('atracoes', 'update', payload);"
);

// Rotas
code = code.replace(
  "  dias[idx] = { ...dias[idx], ...req.body };\n  writeDB(db);\n  \n  syncToGoogleSheets('rotas', 'update', dias[idx]);",
  "  const oldItem = dias[idx];\n  dias[idx] = { ...dias[idx], ...req.body };\n  writeDB(db);\n  \n  const payload = { ...dias[idx], _oldKey: oldItem.nomeDaRota };\n  syncToGoogleSheets('rotas', 'update', payload);"
);

fs.writeFileSync('server.js', code);
console.log('Server patched for _oldKey.');
