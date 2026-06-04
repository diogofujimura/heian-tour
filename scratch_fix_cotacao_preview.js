const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

// Replace state.orcamento = orc; renderPreview(); with the proper DOM loading
const oldCode1 = `        state.orcamento = orc;
        renderPreview();`;

const newCode1 = `        // Populate DOM before preview to prevent syncDOMToState from wiping it out
        state.orcamento = JSON.parse(JSON.stringify(orc));
        document.getElementById('orcNome').value = orc.nome || '';
        document.getElementById('clienteNome').value = orc.cliente?.nome || '';
        document.getElementById('clienteAdultos').value = orc.cliente?.adultos || '2';
        document.getElementById('clienteCriancas').value = orc.cliente?.criancas || '0';
        document.getElementById('clienteDataOrcamento').value = orc.cliente?.dataOrcamento || '';
        if (typeof preencherTextosForm === 'function') preencherTextosForm(orc.textos || {});
        renderPreview();`;

app = app.replace(oldCode1, newCode1);

const oldCode2 = `    state.orcamento = orc;
    renderPreview();
    document.getElementById('previewOverlay').classList.remove('hidden');`;

const newCode2 = `    // Populate DOM before preview
    state.orcamento = JSON.parse(JSON.stringify(orc));
    document.getElementById('orcNome').value = orc.nome || '';
    document.getElementById('clienteNome').value = orc.cliente?.nome || '';
    document.getElementById('clienteAdultos').value = orc.cliente?.adultos || '2';
    document.getElementById('clienteCriancas').value = orc.cliente?.criancas || '0';
    document.getElementById('clienteDataOrcamento').value = orc.cliente?.dataOrcamento || '';
    if (typeof preencherTextosForm === 'function') preencherTextosForm(orc.textos || {});
    renderPreview();
    document.getElementById('previewOverlay').classList.remove('hidden');`;

app = app.replace(oldCode2, newCode2);

fs.writeFileSync('public/js/app.js', app);
console.log('Fixed DOM population for Cotação preview in Visão Geral');
