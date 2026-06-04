const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

// TL TRANSP
code = code.replace(
  /border-radius:6px; padding:12px; border-left:4px solid var\(--blue\); display:flex; align-items:center"/g,
  'border-radius:8px; padding:12px; border-left:4px solid var(--blue); display:flex; align-items:center"'
);

// PDF EXP
code = code.replace(
  /padding-bottom:8px; border-radius:0 4px 4px 0"/g,
  'padding-bottom:8px; border-radius:8px"'
);

fs.writeFileSync('public/js/roteiros.js', code);
console.log("Patched borders!");
