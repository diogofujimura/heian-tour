const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');
let lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  // Ignore the Firefox comment
  if (line.includes('// Necessário para o Firefox:')) continue;
  
  if (line.trim().endsWith(':')) {
    // If it's a ternary operator that had its empty string removed
    // wait, what if it's an object property? `cidade: `
    // Look at the lines we found:
    // `const badgeGuiado = rota.tourGuiado ? \`<span ...></span>\` :`
    // If it contains `?` and ends with `:`
    if (line.includes('?')) {
        // If it ends with `,` or `;`, we should match what was there.
        // Actually, most of these were just string concatenations or assignments.
        // I'll append ` '';` if it was a statement (e.g. `const x = cond ? 'a' :`)
        // Or if it was part of a string interpolation, it might just need `''`.
        // Let's look at line 280: `const pText = formatarPessoas(el); const p = pText ? \` | 👥 \${pText}\` :` (missing `'';`)
        // Let's look at line 278: `return el.conteudo ? \`<div ...>\${el.conteudo}</div>\` :` (missing `'';`)
        // I will append ` '';` for lines that are statements.
        // Wait, line 278 `return ... :` needs ` '';`
        if (line.trim().startsWith('return ') || line.includes('const ') || line.includes('let ')) {
            lines[i] = line + " '';";
        } else {
            // inside a template literal or mapping?
            // like `const p = ... ? ... : ` -> handled above.
            lines[i] = line + " '';";
        }
    }
  } else if (line.trim().endsWith('||')) {
    lines[i] = line + " '';";
  }
}

fs.writeFileSync('public/js/roteiros.js', lines.join('\n'));
console.log('Fixed syntax on all missing : and ||');
