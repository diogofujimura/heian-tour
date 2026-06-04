const fs = require('fs');
let rot = fs.readFileSync('public/js/roteiros.js', 'utf8');

rot = rot.replace(`document.getElementById('selectRoteiroBase').disabled = true;`, `// document.getElementById('selectRoteiroBase').disabled = true;`);
rot = rot.replace(`document.getElementById('selectRoteiroBase').disabled = false;`, `// document.getElementById('selectRoteiroBase').disabled = false;`);

fs.writeFileSync('public/js/roteiros.js', rot);
console.log('Removed disabled flag from select box');
