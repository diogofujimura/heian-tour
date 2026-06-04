const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

// Ensure attachChipEvents is appended if missing
if (!code.includes('window.attachChipEvents =')) {
  code += `\nwindow.attachChipEvents = function() {
  document.querySelectorAll('.chip-atracao').forEach(chip => {
    chip.removeEventListener('mouseenter', showPopover);
    chip.removeEventListener('mouseleave', hidePopover);
    chip.addEventListener('mouseenter', showPopover);
    chip.addEventListener('mouseleave', hidePopover);
  });
};\n`;
  fs.writeFileSync('public/js/roteiros.js', code);
  console.log('Appended attachChipEvents');
} else {
  console.log('Already exists');
}
