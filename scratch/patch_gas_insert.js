const fs = require('fs');
let content = fs.readFileSync('C:\\Users\\User\\.gemini\\antigravity\\brain\\f78dd171-abe1-4a86-ac38-22ce2edd7278\\google_apps_script.js', 'utf-8');

const regexInsert = /if \(action === 'insert'\) \{([\s\S]*?)sheet\.appendRow\(newRow\);/;
const replaceInsert = `if (action === 'insert') {
        var newRow = new Array(cfg.columns.length).fill('');
        for (var j = 0; j < cfg.columns.length; j++) {
          var prop = cfg.columns[j];
          if (prop !== '') {
            var val = data[prop] !== undefined ? data[prop] : '';
            if (Array.isArray(val)) val = val.join(', ');
            newRow[j] = val;
          }
        }
        
        var firstEmptyRow = startRow;
        for (var r = startRow - 1; r < values.length; r++) {
           if (String(values[r][0]).trim() === '') {
              firstEmptyRow = r + 1;
              break;
           }
        }
        if (firstEmptyRow === startRow && values.length > 0) {
           // means no empty row found, it will be added at the end
           firstEmptyRow = values.length + 1;
        }
        
        // Use getRange instead of appendRow so it doesn't jump to the end of the sheet if there's garbage below
        sheet.getRange(firstEmptyRow, 1, 1, newRow.length).setValues([newRow]);`;

if (content.match(regexInsert)) {
  content = content.replace(regexInsert, replaceInsert);
  fs.writeFileSync('C:\\Users\\User\\.gemini\\antigravity\\brain\\f78dd171-abe1-4a86-ac38-22ce2edd7278\\google_apps_script.js', content, 'utf-8');
  console.log('Patched google_apps_script.js insert logic');
} else {
  console.log('Regex not found');
}
