const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const oldFunc = `window.abrirVisaoGeralCliente = function(clientId) {`;
const newFunc = `window.abrirVisaoGeralCliente = function(clientId) {
try {`;

app = app.replace(oldFunc, newFunc);

const oldEnd = `    document.body.style.overflow = 'hidden';
  }
};`;
const newEnd = `    document.body.style.overflow = 'hidden';
  }
} catch (err) {
  alert('DEBUG ERRO: ' + err.message + '\\n' + err.stack);
  console.error(err);
}
};`;

app = app.replace(oldEnd, newEnd);
fs.writeFileSync('public/js/app.js', app);
console.log('Added try-catch to abrirVisaoGeralCliente');
