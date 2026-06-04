const fs = require('fs');
let content = fs.readFileSync('public/js/roteiros.js', 'utf-8');
content = content.replace(/list=\"datalistCidades\" placeholder=\"Cidade\"/g, 'list=\"datalistCidades\" autocomplete=\"off\" placeholder=\"Cidade\"');
content = content.replace(/list=\"dlRotas_\$\{idx\}_\$\{eIdx\}\" placeholder/g, 'list=\"dlRotas_${idx}_${eIdx}\" autocomplete=\"off\" placeholder');
content = content.replace(/list=\"datalistCidades\" placeholder=\"De onde sai\?\"/g, 'list=\"datalistCidades\" autocomplete=\"off\" placeholder=\"De onde sai?\"');
content = content.replace(/list=\"datalistCidades\" placeholder=\"Para onde vai\?\"/g, 'list=\"datalistCidades\" autocomplete=\"off\" placeholder=\"Para onde vai?\"');
fs.writeFileSync('public/js/roteiros.js', content, 'utf-8');
console.log('Patched roteiros.js');
