const fs = require('fs');
let txt = fs.readFileSync('public/js/roteiros.js', 'utf8');

const targetStr = `
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
    
    // Trava os campos imediatamente após o vínculo
    ['rotClienteNome', 'rotClienteAdultos', 'rotClienteCriancas'].forEach(id => {
      const el = document.getElementById(id);
      if(el) { el.readOnly = true; el.style = 'background:#f1f5f9; cursor:not-allowed'; }
    });
    
    if(typeof triggerRoteiroAutoSave === 'function') triggerRoteiroAutoSave();
    if(typeof updateRoteiroHeader === 'function') updateRoteiroHeader();
    
    // Sincroniza ativamente com Notion e puxa as estadias
    if(typeof syncClienteAtivo === 'function') syncClienteAtivo(c.id);
    
    alert('Cliente vinculado com sucesso! Este roteiro agora está conectado a este cliente.');`;

txt = txt.replace(targetStr, "");
fs.writeFileSync('public/js/roteiros.js', txt);
