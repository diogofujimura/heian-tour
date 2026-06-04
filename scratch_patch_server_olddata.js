const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Update function signature and payload
s = s.replace(
  'async function syncToGoogleSheets(type, action, data) {',
  'async function syncToGoogleSheets(type, action, data, oldData = null) {'
);
s = s.replace(
  'const payload = { action, type, sheetName, data };',
  'const payload = { action, type, sheetName, data, oldData };'
);

// Update calls to pass oldData instead of mutating payload
s = s.replace(
  `const payload = { ...db.transportes[idx], _oldKey: oldItem.trecho };
  syncToGoogleSheets('transportes', 'update', payload);`,
  `syncToGoogleSheets('transportes', 'update', db.transportes[idx], oldItem);`
);

s = s.replace(
  `const payload = { ...db.experiencias[idx], _oldKey: oldItem.nome };
  syncToGoogleSheets('experiencias', 'update', payload);`,
  `syncToGoogleSheets('experiencias', 'update', db.experiencias[idx], oldItem);`
);

s = s.replace(
  `const payload = { ...db.atracoes[idx], _oldKey: oldItem['Nome da Atração'] };
  syncToGoogleSheets('atracoes', 'update', payload);`,
  `syncToGoogleSheets('atracoes', 'update', db.atracoes[idx], oldItem);`
);

s = s.replace(
  `const payload = { ...dias[idx], _oldKey: oldItem.nomeDaRota };
  syncToGoogleSheets('rotas', 'update', payload);`,
  `syncToGoogleSheets('rotas', 'update', dias[idx], oldItem);`
);

fs.writeFileSync('server.js', s);
console.log('Done updating server.js');
