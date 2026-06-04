const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const badCode = `console.error(e); alert(e.message); } } catch(err) { alert(\\'CRASH: \\' + err.message); } }; } } else {`;
const fixedCode = `console.error(e); } }; } } else {`;

if(app.includes("alert(\\'CRASH:")) {
  app = app.replace(/console\.error\(e\); alert\(e\.message\); \} \} catch\(err\) \{ alert\(\\'CRASH: \\' \+ err\.message\); \} \}; \} \} else \{/g, fixedCode);
  fs.writeFileSync('public/js/app.js', app);
  console.log('Fixed syntax error');
}
