const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

code = code.replace("datalist.innerHTML =\n  const cidadesUnicas = new Set();", "datalist.innerHTML = '';\n  const cidadesUnicas = new Set();");
code = code.replace("datalist.innerHTML =\r\n  const cidadesUnicas = new Set();", "datalist.innerHTML = '';\n  const cidadesUnicas = new Set();");

fs.writeFileSync('public/js/roteiros.js', code);
console.log('Fixed syntax!');
