const fs = require('fs');
let txt = fs.readFileSync('public/index.html', 'utf8');
txt = txt.replace(/readonly style="background:#f1f5f9; cursor:not-allowed"/g, '');
fs.writeFileSync('public/index.html', txt);
