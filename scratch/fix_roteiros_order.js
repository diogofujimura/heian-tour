const fs = require('fs');
let content = fs.readFileSync('public/js/roteiros.js', 'utf-8');

const regexDom = /document\.addEventListener\('DOMContentLoaded', async \(\) => \{\s*setupEvents\(\);\s*await carregarBases\(\);\s*if \(typeof setupEditorEvents === 'function'\) setupEditorEvents\(\);/m;
const replaceDom = `document.addEventListener('DOMContentLoaded', async () => {\n  setupEvents();\n  if (typeof setupEditorEvents === 'function') setupEditorEvents();\n  await carregarBases();`;

if (content.match(regexDom)) {
  content = content.replace(regexDom, replaceDom);
  fs.writeFileSync('public/js/roteiros.js', content, 'utf-8');
  console.log('Patched roteiros.js: setupEditorEvents called before carregarBases');
} else {
  console.log('Regex not found');
}
