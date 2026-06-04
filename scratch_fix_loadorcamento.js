const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

// Replace loadOrcamento(orc) with abrirOrcamento(orc.id)
app = app.replace(/loadOrcamento\(orc\);/g, 'abrirOrcamento(orc.id);');

fs.writeFileSync('public/js/app.js', app);
console.log('Fixed loadOrcamento -> abrirOrcamento(orc.id)');
