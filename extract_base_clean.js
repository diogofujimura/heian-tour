const fs = require('fs');
const txt = fs.readFileSync('public/index.html', 'utf8');
const start = txt.indexOf('<div id="page-base"');
const end = txt.indexOf('<!-- ── CONFIGURAÇÕES', start);
if(start !== -1 && end !== -1) {
  fs.writeFileSync('page-base-clean.html', txt.substring(start, end), 'utf8');
  console.log('Extracted cleanly. Length:', txt.substring(start, end).length);
} else {
  console.log('Not found in 3d383ee');
}
