const fs = require('fs');
const oldHtml = fs.readFileSync('old_index.html', 'utf8'); // Wait, old_index.html might not be utf16. Let's try utf8.
let start = oldHtml.indexOf('<div id="page-base"');
if(start === -1) {
  // try utf16le
  const oldHtml16 = fs.readFileSync('old_index.html', 'utf16le');
  start = oldHtml16.indexOf('<div id="page-base"');
  if (start !== -1) {
    const end = oldHtml16.indexOf('<!-- ── CONFIGURAÇÕES', start);
    let extracted = oldHtml16.substring(start, end);
    fs.writeFileSync('page-base-restored.html', extracted, 'utf8');
    console.log('Extracted from utf16le. Length:', extracted.length);
  } else {
    console.log('Not found in utf16le either');
  }
} else {
  const end = oldHtml.indexOf('<!-- ── CONFIGURAÇÕES', start);
  let extracted = oldHtml.substring(start, end);
  fs.writeFileSync('page-base-restored.html', extracted, 'utf8');
  console.log('Extracted from utf8. Length:', extracted.length);
}
