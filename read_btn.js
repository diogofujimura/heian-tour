const fs = require('fs');
const js = fs.readFileSync('public/js/roteiros.js', 'utf8');
const lines = js.split('\n');

const start = lines.findIndex(l => l.includes("document.getElementById('btnGerarRoteiro').addEventListener"));
const end = lines.findIndex((l,i) => i > start && l.includes("document.getElementById('btnCancelarEdicaoRoteiro').addEventListener"));

console.log(lines.slice(start, end).join('\n'));
