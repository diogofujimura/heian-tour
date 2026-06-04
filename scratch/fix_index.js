const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf-8');

// Undo the bad replacement at line 212
html = html.replace(\          <div style="flex:1"></div>
          <div style="display:flex; gap:12px; align-items:center">
            <span id="autoSaveIndicator" style="font-size:11px;color:var(--ink-lt);opacity:0;transition:opacity 0.3s;letter-spacing:0.04em"></span>
            <button class="btn-secondary" onclick="cotacaoParaRoteiro(state.orcamento)" title="Substitui o Roteiro atual pelas informações desta Cotação">Gerar Roteiro Desta Cotação</button>
            <button id="btnNovoOrc" class="btn-primary" style="background:var(--gold); border:none; box-shadow:0 4px 12px rgba(212,175,55,0.2)">Nova Cotação</button>
          </div>
          <button id="btnSalvarEdicaoRoteiro" class="btn-primary">Salvar Roteiro</button>
          <button id="btnCancelarEdicaoRoteiro" class="btn-secondary" style="border-color:transparent; background:transparent">Cancelar</button>\, \          <button id="btnPrevisualizarRoteiro" class="btn-secondary">Pré-visualizar Roteiro</button>
          <span id="roteiroAutoSaveIndicator" style="font-size:11px;color:var(--ink-lt);opacity:0;transition:opacity 0.3s;letter-spacing:0.04em; margin-left:10px"></span>
          <button id="btnFecharEditorRoteiro" class="btn-secondary">Voltar / Fechar</button>
          <button id="btnSalvarEdicaoRoteiro" class="btn-primary">Salvar Roteiro</button>
          <button id="btnCancelarEdicaoRoteiro" class="btn-secondary" style="border-color:transparent; background:transparent">Cancelar</button>\);

// Add Cotacao Para Roteiro inside page-orcamento header
const targetOrcHeader = \<button id="btnNovoOrc" class="btn-primary" style="background:var(--gold); border:none; box-shadow:0 4px 12px rgba(212,175,55,0.2)">Nova Cotação</button>\;
const replacementOrcHeader = \
            <button class="btn-secondary" onclick="cotacaoParaRoteiro(state.orcamento)" title="Substitui o Roteiro atual pelas informações desta Cotação">Gerar Roteiro Desta Cotação</button>
            <button id="btnNovoOrc" class="btn-primary" style="background:var(--gold); border:none; box-shadow:0 4px 12px rgba(212,175,55,0.2)">Nova Cotação</button>\;
html = html.replace(targetOrcHeader, replacementOrcHeader.trim());

// Add Roteiro Para Cotacao inside roteiros editor modal
const targetRotHeader = \<button id="btnPrevisualizarRoteiro" class="btn-secondary">Pré-visualizar Roteiro</button>\;
const replacementRotHeader = \<button id="btnGerarCotacaoRoteiro" class="btn-secondary" onclick="roteiroParaCotacao(roteiroEmEdicao, roteiroOriginalNome || document.getElementById('editRoteiroNome').value)" title="Cria/Atualiza a Cotação Baseada neste Roteiro">Gerar Cotação Deste Roteiro</button>
          <button id="btnPrevisualizarRoteiro" class="btn-secondary">Pré-visualizar Roteiro</button>\;
html = html.replace(targetRotHeader, replacementRotHeader);


fs.writeFileSync('public/index.html', html);
console.log('Fixed index.html');
