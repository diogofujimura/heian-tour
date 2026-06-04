const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

const regex = /document\.getElementById\('rotClienteData'\)\.value = [\s\S]*?document\.getElementById\('roteiroTimeline'\)\.style\.display = 'none';/;

const replacement = `document.getElementById('rotClienteData').value = roteiroEmEdicao.cliente?.dataOrcamento || '';
  document.getElementById('rotClienteDataFim').value = roteiroEmEdicao.cliente?.dataFim || '';
  document.getElementById('rotClienteVooChegada').value = roteiroEmEdicao.cliente?.vooChegada || '';
  document.getElementById('rotClienteVooPartida').value = roteiroEmEdicao.cliente?.vooPartida || '';
  window.renderRotEstadias();

  document.getElementById('roteiroTimeline').style.display = 'none';`;

code = code.replace(regex, replacement);

fs.writeFileSync('public/js/roteiros.js', code);
console.log('Fixed script!');
