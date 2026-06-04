const fs = require('fs');
let rot = fs.readFileSync('public/js/roteiros.js', 'utf8');

rot = rot.replace(
  `const diasHtml = roteiroEmEdicao.dias.map((diaOrig, index) => {`,
  `const diasArray = roteiroEmEdicao.dias || [];
    const diasHtml = diasArray.map((diaOrig, index) => {`
);

fs.writeFileSync('public/js/roteiros.js', rot);
console.log('Fixed roteiro preview crash when dias is undefined');
