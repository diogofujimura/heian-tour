const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const badEnd = `          } catch(e) {
          console.error(e); alert(e.message); } } catch(err) { alert('CRASH: ' + err.message + ' ' + err.stack); } }; } }); }`;

const fixedEnd = `          } catch(e) {
          console.error(e);
        }
      };
    }
  });
}`;

app = app.replace(badEnd, fixedEnd);

fs.writeFileSync('public/js/app.js', app);
