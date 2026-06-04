const fs = require('fs');
const file = 'C:/Users/User/.gemini/antigravity/brain/f78dd171-abe1-4a86-ac38-22ce2edd7278/google_apps_script.js';
let s = fs.readFileSync(file, 'utf8');

const search = `var data = params.data;     // Objeto com os dados do item`;
const replace = `var data = params.data;     // Objeto com os dados do item
    var oldData = params.oldData; // Objeto com os dados antigos (para update)`;

s = s.replace(search, replace);

const search2 = `      // Para exclusão, força verificar todas as colunas para não apagar duplicatas erradas
      var keysToMatch = (action === 'delete') ? cfg.columns.filter(c => c !== '') : cfg.keys;
      for (var k = 0; k < keysToMatch.length; k++) {
        var keyProp = keysToMatch[k];
        var colIdx = cfg.columns.indexOf(keyProp);
        
        if (type === 'experiencias' && keyProp === 'nome') colIdx = 0;
        
        if (colIdx >= 0) {
          var sheetVal = String(values[r][colIdx]).toLowerCase().trim();
          var appVal = String(data[keyProp]).toLowerCase().trim();
          if (sheetVal !== appVal) {
            match = false;
            break;
          }
        }
      }`;

const replace2 = `      // Se tivermos oldData (em um update), usamos ele para achar a linha exata que existia antes
      // Se for delete, usamos o próprio data (que já é o item exato)
      var referenceData = (action === 'update' && oldData) ? oldData : data;
      
      // Para update e exclusão, força verificar todas as colunas se possível
      var keysToMatch = (action === 'delete' || action === 'update') ? cfg.columns.filter(c => c !== '') : cfg.keys;
      
      for (var k = 0; k < keysToMatch.length; k++) {
        var keyProp = keysToMatch[k];
        var colIdx = cfg.columns.indexOf(keyProp);
        
        if (type === 'experiencias' && keyProp === 'nome') colIdx = 0;
        
        if (colIdx >= 0) {
          var sheetVal = String(values[r][colIdx]).toLowerCase().trim();
          var appVal = String(referenceData[keyProp] || '').toLowerCase().trim();
          if (sheetVal !== appVal) {
            match = false;
            break;
          }
        }
      }`;

s = s.replace(search2, replace2);

fs.writeFileSync(file, s);
console.log('Done updating apps script artifact for oldData');
