const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

if (!code.includes('window.dragStartAtracao')) {
  code += `\n
let draggedAtr = null;

window.dragStartAtracao = function(e, dIdx, eIdx, aIdx) {
  draggedAtr = { dIdx, eIdx, aIdx };
  e.dataTransfer.effectAllowed = 'move';
  // Necessário para o Firefox:
  e.dataTransfer.setData('text/plain', aIdx);
  e.target.style.opacity = '0.5';
};

window.dragOverAtracao = function(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
};

window.dropAtracao = function(e, dIdx, eIdx, aIdx) {
  e.preventDefault();
  e.stopPropagation(); // Evita que caia no dropAtracaoBlock
  document.querySelectorAll('.chip-atracao').forEach(c => c.style.opacity = '1');
  
  if (!draggedAtr || draggedAtr.dIdx !== dIdx || draggedAtr.eIdx !== eIdx) return;
  if (draggedAtr.aIdx === aIdx) return; // Mesmo lugar
  
  const arr = roteiroEmEdicao.dias[dIdx].elementos[eIdx].atracoesDoDia;
  const item = arr.splice(draggedAtr.aIdx, 1)[0];
  arr.splice(aIdx, 0, item);
  
  draggedAtr = null;
  renderEditDias();
};

window.dropAtracaoBlock = function(e, dIdx, eIdx) {
  e.preventDefault();
  document.querySelectorAll('.chip-atracao').forEach(c => c.style.opacity = '1');
  
  if (!draggedAtr || draggedAtr.dIdx !== dIdx || draggedAtr.eIdx !== eIdx) return;
  
  // Caiu na área livre do bloco, joga pro final
  const arr = roteiroEmEdicao.dias[dIdx].elementos[eIdx].atracoesDoDia;
  const item = arr.splice(draggedAtr.aIdx, 1)[0];
  arr.push(item);
  
  draggedAtr = null;
  renderEditDias();
};

// Quando arrastar termina em qualquer lugar
document.addEventListener('dragend', function(e) {
  if (e.target && e.target.classList && e.target.classList.contains('chip-atracao')) {
    e.target.style.opacity = '1';
    draggedAtr = null;
  }
});
`;
  fs.writeFileSync('public/js/roteiros.js', code);
  console.log('Appended drag functions to roteiros.js');
} else {
  console.log('Drag functions already exist in roteiros.js');
}
