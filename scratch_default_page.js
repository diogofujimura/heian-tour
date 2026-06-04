const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const oldCode1 = `  if (!hash) navToPage('orcamento');
  else navToPage(hash);`;

const newCode1 = `  if (!hash) navToPage('clientes');
  else navToPage(hash);`;

app = app.replace(oldCode1, newCode1);

fs.writeFileSync('public/js/app.js', app);
console.log('Default page changed to clientes');
