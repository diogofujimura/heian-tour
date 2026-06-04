const fs = require('fs');
const js = fs.readFileSync('public/js/roteiros.js', 'utf8');

const start = js.indexOf("document.getElementById('btnGerarRoteiro').addEventListener");
if (start === -1) {
    console.log("NOT FOUND");
} else {
    console.log(js.substring(start, start + 800));
}
