const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');
const baseHtml = fs.readFileSync('page-base-restored.html', 'utf8');

const target = '<!-- ── CONFIGURAÇÕES';
if (html.includes(target) && !html.includes('id="page-base"')) {
  html = html.replace(target, `<!-- ── BASE DE DADOS ───────────────────────────────────────────────────────── -->\n` + baseHtml + '\n  ' + target);
  fs.writeFileSync('public/index.html', html, 'utf8');
  console.log('Restored page-base!');
} else {
  console.log('Target not found or page-base already exists.');
}
