const fs = require('fs');
const js = fs.readFileSync('public/js/roteiros.js', 'utf8');

const start = js.indexOf("document.getElementById('btnGerarRoteiro').addEventListener");
if (start !== -1) {
    const end = js.indexOf("document.getElementById('btnPrevisualizarRoteiro')", start);
    console.log(js.substring(start + 1500, end || start + 3000));
}
