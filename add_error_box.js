const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');
const errorDisplayScript = `
<script>
window.addEventListener('error', function(e) {
  let errBox = document.getElementById('debugErrorBox');
  if (!errBox) {
    errBox = document.createElement('div');
    errBox.id = 'debugErrorBox';
    errBox.style.position = 'fixed';
    errBox.style.bottom = '10px';
    errBox.style.right = '10px';
    errBox.style.backgroundColor = 'red';
    errBox.style.color = 'white';
    errBox.style.padding = '10px';
    errBox.style.zIndex = '999999';
    errBox.style.maxWidth = '400px';
    errBox.style.fontSize = '12px';
    document.body.appendChild(errBox);
  }
  errBox.innerHTML += '<p>' + e.message + ' at ' + e.filename + ':' + e.lineno + '</p>';
});
window.addEventListener('unhandledrejection', function(e) {
  let errBox = document.getElementById('debugErrorBox');
  if (!errBox) {
    errBox = document.createElement('div');
    errBox.id = 'debugErrorBox';
    errBox.style.position = 'fixed';
    errBox.style.bottom = '10px';
    errBox.style.right = '10px';
    errBox.style.backgroundColor = 'red';
    errBox.style.color = 'white';
    errBox.style.padding = '10px';
    errBox.style.zIndex = '999999';
    errBox.style.maxWidth = '400px';
    errBox.style.fontSize = '12px';
    document.body.appendChild(errBox);
  }
  errBox.innerHTML += '<p>Unhandled Promise: ' + e.reason + '</p>';
});
</script>
</head>`;

if (!html.includes('debugErrorBox')) {
  html = html.replace('</head>', errorDisplayScript);
  fs.writeFileSync('public/index.html', html, 'utf8');
}
