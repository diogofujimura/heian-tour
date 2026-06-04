const fs = require('fs');

// 1. Update index.html
let html = fs.readFileSync('public/index.html', 'utf8');

const btnHTML = '<button id="btnVincularClienteRoteiro" class="btn-secondary" style="font-size:12px; padding:4px 10px; margin-right:8px;" type="button" onclick="abrirModalVincularClienteRoteiro()">🔗 Vincular Cliente</button>';
html = html.replace(
    '<button id="btnEditarClienteRoteiro" class="btn-secondary"',
    btnHTML + '\n          <button id="btnEditarClienteRoteiro" class="btn-secondary"'
);

const modalHTML = `
<!-- Modal Vincular Cliente ao Roteiro -->
<div id="modalVincularClienteRoteiro" class="modal-overlay hidden">
  <div class="modal" style="max-width:400px">
    <h3>Vincular Cliente ao Roteiro</h3>
    <div class="form-grid">
      <div class="field">
        <label>Selecione o Cliente do Notion</label>
        <select id="selClienteParaVincular" style="width:100%">
        </select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="document.getElementById('modalVincularClienteRoteiro').classList.add('hidden')">Cancelar</button>
      <button class="btn-primary" onclick="confirmarVincularClienteRoteiro()">Vincular</button>
    </div>
  </div>
</div>
`;

if (!html.includes('modalVincularClienteRoteiro')) {
    html = html.replace('</body>', modalHTML + '\n</body>');
}

fs.writeFileSync('public/index.html', html, 'utf8');


// 2. Update roteiros.js
let js = fs.readFileSync('public/js/roteiros.js', 'utf8');

const logicJS = `
window.abrirModalVincularClienteRoteiro = function() {
    if (typeof notionClients === 'undefined' || notionClients.length === 0) {
        alert('Carregando clientes do Notion, tente novamente em alguns segundos...');
        return;
    }
    const sel = document.getElementById('selClienteParaVincular');
    if (!sel) return;
    
    sel.innerHTML = '<option value="">Selecione um cliente...</option>';
    notionClients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nome + ' (' + (c.adultos||0) + ' Ad / ' + (c.criancas||0) + ' Cr) - ' + (c.dataInicio || 'Sem Data');
        sel.appendChild(opt);
    });
    
    document.getElementById('modalVincularClienteRoteiro').classList.remove('hidden');
}

window.confirmarVincularClienteRoteiro = function() {
    const notionId = document.getElementById('selClienteParaVincular').value;
    if (!notionId) {
        alert('Selecione um cliente primeiro.');
        return;
    }
    
    const c = notionClients.find(x => x.id === notionId);
    if (!c) return;
    
    if (!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {};
    roteiroEmEdicao.cliente.notionClienteId = c.id;
    roteiroEmEdicao.cliente.nome = c.nome;
    roteiroEmEdicao.cliente.adultos = c.adultos;
    roteiroEmEdicao.cliente.criancas = c.criancas;
    roteiroEmEdicao.cliente.dataInicio = c.dataInicio;
    roteiroEmEdicao.cliente.dataFim = c.dataFim;
    roteiroEmEdicao.cliente.dataOrcamento = c.dataInicio;
    roteiroEmEdicao.cliente.vooChegada = c.vooChegada || '';
    roteiroEmEdicao.cliente.vooPartida = c.vooPartida || '';
    
    document.getElementById('rotClienteNome').value = c.nome || '';
    document.getElementById('rotClienteAdultos').value = c.adultos || '';
    document.getElementById('rotClienteCriancas').value = c.criancas || '';
    document.getElementById('rotClienteData').value = c.dataInicio || '';
    if(document.getElementById('rotClienteDataFim')) document.getElementById('rotClienteDataFim').value = c.dataFim || '';
    if(document.getElementById('rotClienteVooChegada')) document.getElementById('rotClienteVooChegada').value = c.vooChegada || '';
    if(document.getElementById('rotClienteVooPartida')) document.getElementById('rotClienteVooPartida').value = c.vooPartida || '';
    
    document.getElementById('modalVincularClienteRoteiro').classList.add('hidden');
    
    if(typeof triggerRoteiroAutoSave === 'function') triggerRoteiroAutoSave();
    if(typeof updateRoteiroHeader === 'function') updateRoteiroHeader();
    
    // Sincroniza ativamente com Notion e puxa as estadias
    if(typeof syncClienteAtivo === 'function') syncClienteAtivo(c.id);
    
    alert('Cliente vinculado com sucesso! Este roteiro agora está conectado a este cliente.');
}
`;

if (!js.includes('abrirModalVincularClienteRoteiro')) {
    js += '\n' + logicJS;
    fs.writeFileSync('public/js/roteiros.js', js, 'utf8');
}

console.log('Successfully injected Link Client to Roteiro functionality.');
