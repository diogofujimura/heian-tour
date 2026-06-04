const fs = require('fs');

// 1. Update index.html
let html = fs.readFileSync('public/index.html', 'utf-8');
const oldBtn = /<button class="btn-secondary" onclick="roteiroParaCotacao\(roteiroEmEdicao, roteiroOriginalNome \|\| document\.getElementById\('editRoteiroNome'\)\.value\)">? Gerar Cotação<\/button>/;
const newBtns = '<div id="roteiroCotacaoActions" style="display:flex; gap:8px;"></div>';
html = html.replace(oldBtn, newBtns);
fs.writeFileSync('public/index.html', html, 'utf-8');

// 2. Update roteiros.js
let roteirosJS = fs.readFileSync('public/js/roteiros.js', 'utf-8');
const renderDiasMatch = 'function renderEditDias() {';
const updateActionsLogic = \unction atualizarBotoesCotacao() {
    const actionsDiv = document.getElementById('roteiroCotacaoActions');
    if (!actionsDiv) return;
    const roteiroNome = roteiroOriginalNome || document.getElementById('editRoteiroNome').value;
    const existingCotacao = state.orcamentosDB.find(o => o.orcRoteiroVinculado === roteiroNome);
    
    if (existingCotacao) {
        actionsDiv.innerHTML = \\\
            <button class="btn-secondary" onclick="abrirOrcamento(\\\); navToPage('orcamento');" title="Visualizar a cotação existente sem alterar nada">??? Ver Cotação</button>
            <button class="btn-secondary" onclick="roteiroParaCotacao(roteiroEmEdicao, '\\\', false)" title="Atualizar a cotação existente com os dados atuais deste roteiro">?? Atualizar Cotação</button>
        \\\;
    } else {
        actionsDiv.innerHTML = \\\
            <button class="btn-secondary" onclick="roteiroParaCotacao(roteiroEmEdicao, '\\\', true)">? Gerar Cotação</button>
        \\\;
    }
}
function renderEditDias() {\;

roteirosJS = roteirosJS.replace(renderDiasMatch, updateActionsLogic);

// Add call to atualizarBotoesCotacao at the end of renderEditDias
const endOfRenderDias = /document\.getElementById\('btnGerarDiasAutomaticamente'\)\.style\.display = roteiroEmEdicao\.dias\.length === 0 \? 'inline-block' : 'none';\s*\}/;
roteirosJS = roteirosJS.replace(endOfRenderDias, match => match.replace('}', '  atualizarBotoesCotacao();\n}'));

fs.writeFileSync('public/js/roteiros.js', roteirosJS, 'utf-8');

// 3. Update sync_roteiro_cotacao.js
let syncJS = fs.readFileSync('public/js/sync_roteiro_cotacao.js', 'utf-8');
syncJS = syncJS.replace(
    /window\.roteiroParaCotacao = function\(roteiro, nomeRoteiro\) \{/,
    'window.roteiroParaCotacao = function(roteiro, nomeRoteiro, isNew = true) {'
);
syncJS = syncJS.replace(
    /if \(typeof novoOrcamento === 'function'\) novoOrcamento\(\);/,
    \if (isNew && typeof novoOrcamento === 'function') {
        novoOrcamento();
    } else {
        // If updating existing, clear arrays to repopulate
        state.orcamento.tours = [];
        state.orcamento.transportes = [];
        state.orcamento.experiencias = [];
    }\
);

// We need to also make sure that updating an existing cotacao opens it first!
syncJS = syncJS.replace(
    /if \(isNew && typeof novoOrcamento === 'function'\)/,
    \if (!isNew) {
        const existingCotacao = state.orcamentosDB.find(o => o.orcRoteiroVinculado === nomeRoteiro);
        if (existingCotacao && state.orcamento.id !== existingCotacao.id) {
            abrirOrcamento(existingCotacao.id);
        }
    }
    if (isNew && typeof novoOrcamento === 'function')\
);

fs.writeFileSync('public/js/sync_roteiro_cotacao.js', syncJS, 'utf-8');
console.log('Scripts patched.');
