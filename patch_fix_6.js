const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

code = code.replace("cont.innerHTML =\n  if (!roteiroEmEdicao.cliente", "cont.innerHTML = '';\n  if (!roteiroEmEdicao.cliente");
code = code.replace("cont.innerHTML =\r\n  if (!roteiroEmEdicao.cliente", "cont.innerHTML = '';\n  if (!roteiroEmEdicao.cliente");

fs.writeFileSync('public/js/roteiros.js', code);
console.log('Fixed cont.innerHTML');
