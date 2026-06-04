const fs = require('fs');
let roteirosJS = fs.readFileSync('public/js/roteiros.js', 'utf-8');

const target = `    });
  }
  
  window.updRotCliente = function(field, val) {`;
const replacement = `    });
    if (window.atualizarBotoesCotacao) window.atualizarBotoesCotacao();
  }
  
  window.updRotCliente = function(field, val) {`;

roteirosJS = roteirosJS.replace(target, replacement);

fs.writeFileSync('public/js/roteiros.js', roteirosJS, 'utf-8');
console.log('Fixed roteiros.js!');
