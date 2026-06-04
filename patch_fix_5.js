const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

code = code.replace("container.innerHTML =\n  if (!roteiroEmEdicao", "container.innerHTML = '';\n  if (!roteiroEmEdicao");
code = code.replace("container.innerHTML =\r\n  if (!roteiroEmEdicao", "container.innerHTML = '';\n  if (!roteiroEmEdicao");

fs.writeFileSync('public/js/roteiros.js', code);
console.log('Fixed container syntax!');
