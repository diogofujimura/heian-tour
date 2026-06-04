const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

const regex = /<h2 class="card-title" style="font-size:14px; margin:0">Dados do Cliente \(Cabeça\)<\/h2>\s*<button id="btnVincularClienteRoteiro"[^>]*>.*?<\/button>\s*<button id="btnEditarClienteRoteiro"[^>]*>.*?<\/button>/;

const match = html.match(regex);
if (match) {
    const original = match[0];
    const newContent = original.replace(/<button id="btnVincularClienteRoteiro"/, '<div>\n          <button id="btnVincularClienteRoteiro"').replace(/<\/button>$/, '</button>\n          </div>');
    html = html.replace(original, newContent);
    fs.writeFileSync('public/index.html', html, 'utf8');
    console.log('Fixed flexbox layout for buttons.');
} else {
    console.log('Regex did not match');
}
