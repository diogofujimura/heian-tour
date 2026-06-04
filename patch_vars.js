const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

code = code.replace(/var\(--blue\)/g, '#2196F3');
code = code.replace(/var\(--blue-dk\)/g, '#1565C0');

fs.writeFileSync('public/js/roteiros.js', code);
console.log('Fixed CSS variables');
