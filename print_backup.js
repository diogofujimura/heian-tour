const fs = require('fs');
let js = fs.readFileSync('C:/Users/User/.gemini/antigravity/brain/f78dd171-abe1-4a86-ac38-22ce2edd7278/scratch/roteiros.js.backup', 'utf8');
const start = js.indexOf("document.getElementById('btnGerarRoteiro').addEventListener");
if (start !== -1) {
    const end = js.indexOf("document.getElementById('btnPrevisualizarRoteiro')", start);
    console.log(js.substring(start, end));
}
