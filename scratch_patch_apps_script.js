const fs = require('fs');
const file = 'C:/Users/User/.gemini/antigravity/brain/f78dd171-abe1-4a86-ac38-22ce2edd7278/google_apps_script.js';
let s = fs.readFileSync(file, 'utf8');

const search = `      for (var k = 0; k < cfg.keys.length; k++) {
        var keyProp = cfg.keys[k];`;
const replace = `      // Para exclusão, força verificar todas as colunas para não apagar duplicatas erradas
      var keysToMatch = (action === 'delete') ? cfg.columns.filter(c => c !== '') : cfg.keys;
      for (var k = 0; k < keysToMatch.length; k++) {
        var keyProp = keysToMatch[k];`;

if (s.includes(search)) {
    s = s.replace(search, replace);
    fs.writeFileSync(file, s);
    console.log('Apps Script updated for strict delete matching.');
} else {
    console.log('Pattern not found.');
}
