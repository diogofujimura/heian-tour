const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

// 1. Timeline Transporte
code = code.replace(
  /<div style="margin-bottom:16px; background:#f4f7f8; border-radius:6px; padding:12px; border-left:3px solid var\(--gold-mid\); display:flex; align-items:center">/,
  '<div style="margin-bottom:16px; background:linear-gradient(to right, rgba(33,150,243,0.06), transparent); border-radius:6px; padding:12px; border-left:4px solid var(--blue); display:flex; align-items:center">'
);

// 2. Timeline Experiência
code = code.replace(
  /<div style="display:flex; align-items:flex-start; margin-bottom:16px; padding:16px; background:var\(--bg-alt\); border-radius:8px; border-left:4px solid var\(--purple\)">\s*<div style="flex:1">\s*<div style="color:var\(--purple\); font-weight:bold; font-size:13px; font-family:var\(--ff-display\); text-transform:uppercase; margin-bottom:2px">Tickets & Experiências<\/div>/,
  `<div style="display:flex; align-items:flex-start; margin-bottom:16px; padding:16px; background:linear-gradient(to right, rgba(220,53,69,0.06), transparent); border-radius:8px; border-left:4px solid var(--crimson)">
             <div style="flex:1">
               <div style="color:var(--crimson); font-weight:bold; font-size:13px; font-family:var(--ff-display); text-transform:uppercase; margin-bottom:2px">Tickets & Experiências</div>`
);

// 3. PDF Experiência
code = code.replace(
  /<div style="margin-bottom:16px; border-left:3px solid var\(--purple\); padding-left:12px; background:rgba\(156,39,176,0\.03\); padding-top:8px; padding-bottom:8px; border-radius:0 4px 4px 0">\s*<div style="margin-bottom:4px; display:flex; align-items:center">\s*<strong style="color:var\(--purple\); font-size:12px; text-transform:uppercase; margin-right:8px">Tickets & Experiências \$\{horaText\}<\/strong>/,
  `<div style="margin-bottom:16px; border-left:4px solid var(--crimson); padding-left:12px; background:linear-gradient(to right, rgba(220,53,69,0.06), transparent); padding-top:8px; padding-bottom:8px; border-radius:0 4px 4px 0">
              <div style="margin-bottom:4px; display:flex; align-items:center">
                <strong style="color:var(--crimson); font-size:12px; text-transform:uppercase; margin-right:8px">Tickets & Experiências \${horaText}</strong>`
);

// 4. PDF Transporte
code = code.replace(
  /<div style="margin-bottom:16px; border-left:3px solid var\(--blue\); padding-left:12px; background:rgba\(33,150,243,0\.03\); padding-top:8px; padding-bottom:8px; border-radius:0 4px 4px 0">/,
  `<div style="margin-bottom:16px; border-left:4px solid var(--blue); padding-left:12px; background:linear-gradient(to right, rgba(33,150,243,0.06), transparent); padding-top:8px; padding-bottom:8px; border-radius:0 4px 4px 0">`
);

// 5. Editor UI - let's keep it purple so it doesn't conflict or look too heavy. We only care about visualizador and export.

fs.writeFileSync('public/js/roteiros.js', code);
console.log("Patched styles!");
