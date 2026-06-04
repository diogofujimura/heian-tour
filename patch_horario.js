const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

// Fix the PDF preview in btnPrevisualizarRoteiro
const searchPrevisualizar = `const hp = el.horaPartida ? \`\${el.horaPartida}\` : '';
          const hc = el.horaChegada ? \`\${el.horaChegada}\` : '';
          const horaText = hp && hc ? \`(\${hp} as \${hc})\` : (hp ? \`(Partida \${hp})\` : '');`;

const replacePrevisualizar = `const h = el.horario ? \`\${el.horario}\` : '';
          const horaText = h ? \`(\${h})\` : '';`;

code = code.replace(searchPrevisualizar, replacePrevisualizar);

// Also remove emoji from the timeline visualizer in renderizarRoteiro
const searchVisualizer = `const h = el.horario ? \`⏰ \${el.horario} &nbsp;|&nbsp; \` : '';`;
const replaceVisualizer = `const h = el.horario ? \`\${el.horario} &nbsp;|&nbsp; \` : '';`;

code = code.replace(searchVisualizer, replaceVisualizer);

fs.writeFileSync('public/js/roteiros.js', code);
console.log('Fixed horario');
