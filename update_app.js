const fs = require('fs');

let js = fs.readFileSync('public/js/app.js', 'utf8');

// 1. In renderTransportesForm (dropdown option)
js = js.replace(
  /\`\$\{g\.trecho\} \| \$\{g\.tipo\} \| \$\{g\.linha\} \| \$\{g\.categoria\} — Ad: ¥\$\{fmt\(pAd\)\} \/ Inf: ¥\$\{fmt\(pInf\)\}\<\/option\>\`;/g,
  "`${g.trecho} | ${g.tipo} | ${g.linha} | ${g.categoria} ${g.tempo ? '(⏱ ' + g.tempo + ') ' : ''}— Ad: ¥${fmt(pAd)} / Inf: ¥${fmt(pInf)}</option>`;"
);

// 2. In preencherTransporte (populating descricao field automatically)
js = js.replace(
  /t\.descricao = \`\$\{dbT\.trecho\} \| \$\{dbT\.tipo\} \| \$\{dbT\.linha\} \| \$\{dbT\.categoria\}\`;/g,
  "t.descricao = `${dbT.trecho} | ${dbT.tipo} | ${dbT.linha} | ${dbT.categoria}${dbT.tempo ? ' (⏱ ' + dbT.tempo + ')' : ''}`;"
);

fs.writeFileSync('public/js/app.js', js, 'utf8');
console.log('App.js updated successfully');
