const fs = require('fs');

let js = fs.readFileSync('public/js/roteiros.js', 'utf8');

// 1. In atualizarOpcoesTransporte (the select dropdown)
js = js.replace(
  /opt\.textContent = t\.trecho \+ ' - ' \+ t\.tipo \+ ' \(' \+ t\.linha \+ '\) \| ' \+ t\.categoria;/,
  "opt.textContent = t.trecho + ' - ' + t.tipo + ' (' + t.linha + ') | ' + t.categoria + (t.tempo ? ' (⏱ ' + t.tempo + ')' : '');"
);

// 2. In selecionarTransporte (saving el.tempo)
js = js.replace(
  /el\.categoria = t\.categoria;/,
  "el.categoria = t.categoria;\n      el.tempo = t.tempo;"
);

// 3. In renderEditDias (the small text showing the selected transport)
js = js.replace(
  /\$\{el\.tipoTransporte \? `\<div style="font-size:11px; margin-top:8px; color:var\(--text-sec\)"\>Selecionado: \<strong\>\$\{el\.tipoTransporte\}\<\/strong\> \(\$\{el\.linha\}\) - \$\{el\.categoria\}\<\/div\>` : ''\}/,
  "${el.tipoTransporte ? `<div style=\"font-size:11px; margin-top:8px; color:var(--text-sec)\">Selecionado: <strong>${el.tipoTransporte}</strong> (${el.linha}) - ${el.categoria} ${el.tempo ? `<strong style=\"color:var(--gold-dk); margin-left:8px;\">⏱ ${el.tempo}</strong>` : ''}</div>` : ''}"
);

// 4. In btnGerarRoteiro preview HTML (the PDF generator)
// We need to match the HTML block inside `el.tipo === 'transporte'` inside `btnGerarRoteiro`
// Currently it is: <div style="font-size:11px; color:var(--text-sec); margin-top:2px">${transpNome}${ctg}${pss} ...
js = js.replace(
  /const transpNome = el\.tipoTransporte \? `\$\{el\.tipoTransporte\} \(\$\{el\.linha\}\)` : 'Deslocamento a definir';\s+const ctg = el\.categoria \? ` - \$\{el\.categoria\}` : '';\s+const pText = formatarPessoas\(el\); const pss = pText \? ` - \$\{pText\}` : '';\s+const h = el\.horario \? `\$\{el\.horario\}` : '';\s+const horaText = h \? `\<span style="color:#000; font-weight:bold; font-size:14px; margin-left:8px;"\>\$\{h\}\<\/span\>` : '';/g,
  `const transpNome = el.tipoTransporte ? \`\${el.tipoTransporte} (\${el.linha})\` : 'Deslocamento a definir';
          const ctg = el.categoria ? \` - \${el.categoria}\` : '';
          const duracao = el.tempo ? \` <span style="color:var(--gold-dk); font-weight:bold;">[⏱ \${el.tempo}]</span>\` : '';
          const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : ''); const pss = pText ? \` - \${pText}\` : '';
          const h = el.horario ? \`\${el.horario}\` : '';
          const horaText = h ? \`<span style="color:#000; font-weight:bold; font-size:14px; margin-left:8px;">\${h}</span>\` : '';`
);
js = js.replace(
  /\<div style="font-size:11px; color:var\(--text-sec\); margin-top:2px"\>\$\{transpNome\}\$\{ctg\}\$\{pss\}/g,
  "<div style=\"font-size:11px; color:var(--text-sec); margin-top:2px\">${transpNome}${ctg}${duracao}${pss}"
);

// 5. In renderizarRoteiro (the view screen)
// Currently it is: <div style="font-size:12px; color:var(--text-main); margin-bottom:4px">${el.tipoTransporte || 'Deslocamento'} (${el.linha || 'Geral'}) - ${el.categoria || 'Normal'} ...
js = js.replace(
  /\<div style="font-size:12px; color:var\(--text-main\); margin-bottom:4px"\>\$\{el\.tipoTransporte \|\| 'Deslocamento'\} \(\$\{el\.linha \|\| 'Geral'\}\) - \$\{el\.categoria \|\| 'Normal'\}/g,
  "<div style=\"font-size:12px; color:var(--text-main); margin-bottom:4px\">${el.tipoTransporte || 'Deslocamento'} (${el.linha || 'Geral'}) - ${el.categoria || 'Normal'} ${el.tempo ? `<span style=\"color:var(--gold-dk); font-weight:bold;\">⏱ ${el.tempo}</span>` : ''}"
);

fs.writeFileSync('public/js/roteiros.js', js, 'utf8');
console.log('Replaced successfully');
