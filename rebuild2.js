const fs = require('fs');

let jsRotCot = fs.readFileSync('rewrite_rot_cot.js', 'utf8');
let start1 = jsRotCot.indexOf('window.roteiroParaCotacao = function');
let end1 = jsRotCot.lastIndexOf('};\\n\\n');
let code1 = jsRotCot.substring(start1, end1 + 2);
code1 = code1.replace(/ExperiǦncia/g, 'Experiência').replace(/Cotaǜo/g, 'Cotação');

let jsCotRot = fs.readFileSync('rewrite.js', 'utf8');
let start2 = jsCotRot.indexOf('window.cotacaoParaRoteiro = function');
let end2 = jsCotRot.lastIndexOf('};\\n\\n');
let code2 = jsCotRot.substring(start2, end2 + 2);
code2 = code2.replace(/z\\"/g, '➔').replace(/ExperiǦncia/g, 'Experiência').replace(/Cotaǜo/g, 'Cotação');

fs.writeFileSync('public/js/sync_roteiro_cotacao.js', code1 + '\n\n' + code2, 'utf8');
console.log('Done!');
