const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const correctBlock = `           } catch(e) {
             console.error(e);
           }
         };
      }
    } else {`;

app = app.replace(/           \} catch\(e\) \{\n             console\.error\(e\); \} \}; \} \} else \{/g, correctBlock);

fs.writeFileSync('public/js/app.js', app);
