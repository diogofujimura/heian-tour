const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

// Patch Transporte editor wrapper
code = code.replace(
  /<div style="border-left: 2px solid var\(--gold-mid\); padding-left: 12px; margin-bottom: 16px; background:#f4f7f8; padding-top:8px; padding-bottom:8px; border-radius:8px">\s*<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">\s*<strong style="color:var\(--ink-dk\); font-size:11px; text-transform:uppercase">.*Transporte<\/strong>/,
  `<div style="border-left: 4px solid #2196F3; padding-left: 12px; margin-bottom: 16px; background:rgba(33,150,243,0.08); padding-top:8px; padding-bottom:8px; border-radius:8px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <strong style="color:#1565C0; font-size:11px; text-transform:uppercase">Deslocamento</strong>`
);

// Patch Experiencia editor wrapper
code = code.replace(
  /<div style="border-left: 2px solid var\(--purple\); padding-left: 12px; margin-bottom: 16px; padding-top:8px; padding-bottom:8px">\s*<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">\s*<strong style="color:var\(--purple\); font-size:12px">Tickets & Experincias<\/strong>/,
  `<div style="border-left: 4px solid var(--crimson); padding-left: 12px; margin-bottom: 16px; background:rgba(139,26,43,0.08); padding-top:8px; padding-bottom:8px; border-radius:8px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <strong style="color:var(--crimson); font-size:12px; text-transform:uppercase">Tickets & Experiências</strong>`
);
// In case of encoding issues with the text above:
code = code.replace(
  /<div style="border-left: 2px solid var\(--purple\); padding-left: 12px; margin-bottom: 16px; padding-top:8px; padding-bottom:8px">\s*<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">\s*<strong style="color:var\(--purple\); font-size:12px">Tickets & Experiências<\/strong>/,
  `<div style="border-left: 4px solid var(--crimson); padding-left: 12px; margin-bottom: 16px; background:rgba(139,26,43,0.08); padding-top:8px; padding-bottom:8px; border-radius:8px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <strong style="color:var(--crimson); font-size:12px; text-transform:uppercase">Tickets & Experiências</strong>`
);

fs.writeFileSync('public/js/roteiros.js', code);
console.log('Patched editor UI headers');
