const fs = require('fs');
const path = require('path');

const hexMap = {
  '#8B1A2B': '#6B1F2A',
  '#8b1a2b': '#6B1F2A',
  'rgba(139,26,43': 'rgba(107,31,42',
  'rgba(139, 26, 43': 'rgba(107, 31, 42',
  '#6B1220': '#3D0F16',
  '#A82035': '#D9A89A',
  
  '#C9A05A': '#C4A35A',
  '#c9a05a': '#C4A35A',
  'rgba(201,160,90': 'rgba(196,163,90',
  'rgba(201, 160, 90': 'rgba(196, 163, 90',
  '#DDB978': '#E8D5A3',
  '#A8823A': '#9c8248',
  
  '#FAF8F4': '#F5EDE0',
  '#FFFDF9': '#FCFAF7',
  
  '#1A1410': '#2C1A1D',
  '#1a1410': '#2C1A1D', 
  'rgba(26,20,16': 'rgba(44,26,29',
  '#4A3F35': '#4C3539',
  '#8A7A6A': '#806A6D',
  
  '#E8E0D4': '#E8DFD3',
  '#D4C8B8': '#D4C4B1',
};

const dirs = ['public/css', 'public/js'];

for (const dir of dirs) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.css') || file.endsWith('.js')) {
      const p = path.join(dir, file);
      let content = fs.readFileSync(p, 'utf8');
      let changed = false;
      for (const [oldHex, newHex] of Object.entries(hexMap)) {
        if (content.includes(oldHex)) {
           const regex = new RegExp(oldHex.replace(/[\.\*\+\?\^\$\{\}\(\)\|\[\]\\]/g, '\\$&'), 'g');
           content = content.replace(regex, newHex);
           changed = true;
        }
      }
      if (changed) {
         fs.writeFileSync(p, content, 'utf8');
         console.log('Updated ' + p);
      }
    }
  }
}
