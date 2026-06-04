const fs = require('fs');

let jsRotCot = fs.readFileSync('rewrite_rot_cot.js', 'utf8');
let start1 = jsRotCot.indexOf('const newCode = `') + 17;
let end1 = jsRotCot.indexOf('};\\n\\n`;', start1);
if (end1 === -1) end1 = jsRotCot.indexOf('};\\n\\n', start1);
if (end1 === -1) end1 = jsRotCot.indexOf('};\n\n`;', start1);
let code1 = jsRotCot.substring(start1, end1 + 2);
code1 = code1.replace(/ExperiǦncia/g, 'Experiência').replace(/Cotaǜo/g, 'Cotação');

let jsCotRot = fs.readFileSync('rewrite.js', 'utf8');
let start2 = jsCotRot.indexOf('const newCode = `') + 17;
let end2 = jsCotRot.indexOf('};\\n\\n`;', start2);
if (end2 === -1) end2 = jsCotRot.indexOf('};\\n\\n', start2);
if (end2 === -1) end2 = jsCotRot.indexOf('};\n\n`;', start2);
let code2 = jsCotRot.substring(start2, end2 + 2);
code2 = code2.replace(/z\\\"/g, '➔').replace(/z\"/g, '➔').replace(/ExperiǦncia/g, 'Experiência').replace(/Cotaǜo/g, 'Cotação').replace(/z"/g, '➔').replace(/z/g, '➔');

fs.writeFileSync('public/js/sync_roteiro_cotacao.js', code1 + '\n\n' + code2, 'utf8');
console.log('Successfully written JS.');
