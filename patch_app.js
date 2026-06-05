const fs = require('fs');
let js = fs.readFileSync('public/js/app.js', 'utf8');

js = js.replace(/const tbody = document\.querySelector\('#tabelaExperiencias tbody'\);\s+const lista/g, "const tbody = document.querySelector('#tabelaExperiencias tbody');\n  if(!tbody) return;\n  const lista");

js = js.replace(/const tbody = document\.querySelector\('#tabelaTransportes tbody'\);\s+const lista/g, "const tbody = document.querySelector('#tabelaTransportes tbody');\n  if(!tbody) return;\n  const lista");

js = js.replace(/const tbody = document\.querySelector\('#tabelaAtracoes tbody'\);\s+const lista/g, "const tbody = document.querySelector('#tabelaAtracoes tbody');\n  if(!tbody) return;\n  const lista");

fs.writeFileSync('public/js/app.js', js, 'utf8');
console.log('Patched app.js');
