const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

app = app.replace(/console\.error\(e\);\s*\}\s*\};\s*\}\s*\}/, "console.error(e); } } catch(err) { alert('ERRO GRAVE: ' + err.message); } }; } }");

fs.writeFileSync('public/js/app.js', app);
