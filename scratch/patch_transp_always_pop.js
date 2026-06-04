const fs = require('fs');
let content = fs.readFileSync('public/js/roteiros.js', 'utf-8');

const regex = /if \(el\.tipo === 'transporte' && \(el\.cidadeOrigem \|\| el\.cidadeDestino\)\) \{/g;
const replace = `if (el.tipo === 'transporte') {`;

if (content.match(regex)) {
  content = content.replace(regex, replace);
  fs.writeFileSync('public/js/roteiros.js', content, 'utf-8');
  console.log('Patched roteiros.js: ALWAYS populate dropdown');
} else {
  console.log('Regex not found');
}
