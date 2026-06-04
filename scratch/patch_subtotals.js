const fs = require('fs');
let content = fs.readFileSync('public/js/app.js', 'utf-8');

// Fix subtotal string in renderTransportesForm
content = content.replace(
  /const div = document\.createElement\('div'\);\s*div\.className = 'item-row';\s*div\.innerHTML = `\s*<div class="item-row-header">\s*<span class="item-row-num">Transporte \$\{i\+1\}<\/span>\s*<span class="item-subtotal" id="subtotal-transp-\$\{t\.id\}">\$\{fmt\(t\.preco\)\} - \$\{t\.pessoas\}\$\{t\.taxaAtiva\?` \+ taxa`:''\}  =  \$\{fmt\(total\)\}  \$\{fmtUSD\(total\*getUSD\(\)\)\}<\/span>/,
  `const div = document.createElement('div');
      div.className = 'item-row';
      const labelPessoas = t.precoTipo === 'grupo' ? '(Fixo)' : '\u00d7 ' + t.pessoas;
      div.innerHTML = \`
        <div class="item-row-header">
          <span class="item-row-num">Transporte \${i+1}</span>
          <span class="item-subtotal" id="subtotal-transp-\${t.id}">¥\${fmt(t.preco)} \${labelPessoas}\${t.taxaAtiva?' + taxa':''}  =  ¥\${fmt(total)} ≈ \${fmtUSD(total*getUSD())}</span>`
);

content = content.replace(
  /if\(el\) el\.textContent = `\$\{fmt\(t\.preco\)\} - \$\{t\.pessoas\}\$\{t\.taxaAtiva\?` \+ taxa`:''\} = \$\{fmt\(total\)\}  \$\{fmtUSD\(total\*getUSD\(\)\)\}`;/,
  `if(el) {
      const labelPessoas = t.precoTipo === 'grupo' ? '(Fixo)' : '\u00d7 ' + t.pessoas;
      el.textContent = \`¥\${fmt(t.preco)} \${labelPessoas}\${t.taxaAtiva?' + taxa':''} = ¥\${fmt(total)} ≈ \${fmtUSD(total*getUSD())}\`;
    }`
);

// Fix subtotal string in renderExperienciasForm
content = content.replace(
  /const div = document\.createElement\('div'\);\s*div\.className = 'item-row';\s*div\.innerHTML = `\s*<div class="item-row-header">\s*<span class="item-row-num">ExperiǦncia \$\{i\+1\}<\/span>\s*<span class="item-subtotal" id="subtotal-exp-\$\{e\.id\}">\$\{fmt\(e\.preco\)\} - \$\{e\.pessoas\}\$\{e\.taxaAtiva\?` \+ taxa`:''\}  =  \$\{fmt\(total\)\}  \$\{fmtUSD\(total\*getUSD\(\)\)\}<\/span>/,
  `const div = document.createElement('div');
      div.className = 'item-row';
      const labelPessoasExp = e.precoTipo === 'grupo' ? '(Fixo)' : '\u00d7 ' + e.pessoas;
      div.innerHTML = \`
        <div class="item-row-header">
          <span class="item-row-num">Experiência \${i+1}</span>
          <span class="item-subtotal" id="subtotal-exp-\${e.id}">¥\${fmt(e.preco)} \${labelPessoasExp}\${e.taxaAtiva?' + taxa':''}  =  ¥\${fmt(total)} ≈ \${fmtUSD(total*getUSD())}</span>`
);

content = content.replace(
  /if\(el\) el\.textContent = `\$\{fmt\(e\.preco\)\} - \$\{e\.pessoas\}\$\{e\.taxaAtiva\?` \+ taxa`:''\} = \$\{fmt\(total\)\}  \$\{fmtUSD\(total\*getUSD\(\)\)\}`;/,
  `if(el) {
      const labelPessoasExp = e.precoTipo === 'grupo' ? '(Fixo)' : '\u00d7 ' + e.pessoas;
      el.textContent = \`¥\${fmt(e.preco)} \${labelPessoasExp}\${e.taxaAtiva?' + taxa':''} = ¥\${fmt(total)} ≈ \${fmtUSD(total*getUSD())}\`;
    }`
);

fs.writeFileSync('public/js/app.js', content, 'utf-8');
console.log('Patched subtotals in app.js');
