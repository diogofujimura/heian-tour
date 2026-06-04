const fs = require('fs');
const js = fs.readFileSync('public/js/roteiros.js', 'utf8');

const s1 = js.indexOf("document.getElementById('btnGerarRoteiro').addEventListener");
if(s1 !== -1) console.log("--- btnGerarRoteiro ---\n" + js.substring(s1, s1 + 1500));

const s2 = js.indexOf("document.getElementById('btnPrevisualizarRoteiro')?.addEventListener");
if(s2 !== -1) console.log("--- btnPrevisualizarRoteiro ---\n" + js.substring(s2, s2 + 2000));
