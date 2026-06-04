const fs = require('fs');
let js = fs.readFileSync('public/js/roteiros.js', 'utf8');

const targetStr =   document.getElementById('btnSalvarEdicaoRoteiro').addEventListener('click', async () => {;
const replaceStr =   document.getElementById('btnSalvarVisualizarRoteiro').addEventListener('click', async () => {
    document.getElementById('btnSalvarEdicaoRoteiro').click();
    setTimeout(() => {
        const btnPreview = document.getElementById('btnGerarRoteiro');
        if (btnPreview && !btnPreview.disabled) {
            btnPreview.click();
        }
    }, 800);
  });

  document.getElementById('btnSalvarEdicaoRoteiro').addEventListener('click', async () => {;

if (js.includes(targetStr)) {
  js = js.replace(targetStr, replaceStr);
  fs.writeFileSync('public/js/roteiros.js', js, 'utf8');
  console.log('Success');
} else {
  console.log('Not found');
}
