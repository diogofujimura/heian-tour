const fs = require('fs');
let js = fs.readFileSync('C:/Users/User/.gemini/antigravity/brain/f78dd171-abe1-4a86-ac38-22ce2edd7278/scratch/roteiros.js.backup', 'utf8');
const lines = js.split('\n');
const sel = lines.findIndex(l => l.includes("addEventListener('change'"));
console.log(lines.slice(Math.max(0, sel-3), sel + 15).join('\n'));
