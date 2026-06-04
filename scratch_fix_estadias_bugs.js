const fs = require('fs');

let app = fs.readFileSync('public/js/app.js', 'utf8');

// 1. Fix grid layout in renderEstadiasForm
app = app.replace('<div class="form-grid-4">', '<div class="form-grid">');

// 2. Fix date inclusion in hoteisStr
const wrongStr = `const hoteisStr = currentEditingEstadias.map(e => {
      let txt = e.cidade;
      if (e.hotel) txt += \` - \${e.hotel}\`;
      return txt;
    }).join('\\n');`;

const rightStr = `const hoteisStr = currentEditingEstadias.map(e => {
      let txt = e.cidade || 'S/N';
      if (e.hotel) txt += \` - \${e.hotel}\`;
      
      let d1 = e.dataInicio ? e.dataInicio.split('-').reverse().join('/') : '';
      let d2 = e.dataFim ? e.dataFim.split('-').reverse().join('/') : '';
      let dates = (d1 && d2) ? \` (\${d1} a \${d2})\` : (d1 || d2 ? \` (\${d1||d2})\` : '');
      
      return txt + dates;
    }).join('\\n');`;

app = app.replace(wrongStr, rightStr);

fs.writeFileSync('public/js/app.js', app);
console.log('Fixed app.js visual and logic bugs');
