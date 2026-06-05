const fs = require('fs');
let txt = fs.readFileSync('public/js/roteiros.js', 'utf8');

const target = `document.getElementById('modalVincularClienteRoteiro').classList.add('hidden');`;
const replacement = `document.getElementById('modalVincularClienteRoteiro').classList.add('hidden');
    
    // Trava os campos imediatamente após o vínculo
    ['rotClienteNome', 'rotClienteAdultos', 'rotClienteCriancas'].forEach(id => {
      const el = document.getElementById(id);
      if(el) { el.readOnly = true; el.style = 'background:#f1f5f9; cursor:not-allowed'; }
    });`;

txt = txt.replace(target, replacement);
fs.writeFileSync('public/js/roteiros.js', txt);
