const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const oldLine = `const headerDiv = document.querySelector('#previewOverlay .preview-header div');`;
const newLine = `const headerDiv = document.querySelector('#previewOverlay .preview-toolbar div');`;

app = app.replace(oldLine, newLine);
fs.writeFileSync('public/js/app.js', app);
console.log('Fixed preview-header to preview-toolbar');
