const fs = require('fs');
let rotJs = fs.readFileSync('public/js/roteiros.js', 'utf8');

const targetSave = `  document.getElementById('btnSalvarEdicaoRoteiro').addEventListener('click', async () => {
    const novoNome = document.getElementById('editRoteiroNome').value.trim();
    if (!novoNome) return alert('Dê um nome ao roteiro.');
    if (!roteiroEmEdicao.dias || roteiroEmEdicao.dias.length === 0) return alert('Adicione pelo menos um dia ao roteiro.');

    const btn = document.getElementById('btnSalvarEdicaoRoteiro');`;

const replaceSave = `  document.getElementById('btnSalvarEdicaoRoteiro').addEventListener('click', async () => {
    const novoNome = document.getElementById('editRoteiroNome').value.trim();
    if (!novoNome) return alert('Dê um nome ao roteiro.');
    if (!roteiroEmEdicao.dias || roteiroEmEdicao.dias.length === 0) return alert('Adicione pelo menos um dia ao roteiro.');

    if (!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {};
    roteiroEmEdicao.cliente.nome = document.getElementById('rotClienteNome').value;
    roteiroEmEdicao.cliente.adultos = document.getElementById('rotClienteAdultos').value;
    roteiroEmEdicao.cliente.criancas = document.getElementById('rotClienteCriancas').value;
    roteiroEmEdicao.cliente.dataInicio = document.getElementById('rotClienteData') ? document.getElementById('rotClienteData').value : '';
    roteiroEmEdicao.cliente.dataFim = document.getElementById('rotClienteDataFim') ? document.getElementById('rotClienteDataFim').value : '';
    roteiroEmEdicao.cliente.vooChegada = document.getElementById('rotClienteVooChegada') ? document.getElementById('rotClienteVooChegada').value : '';
    roteiroEmEdicao.cliente.vooPartida = document.getElementById('rotClienteVooPartida') ? document.getElementById('rotClienteVooPartida').value : '';

    const btn = document.getElementById('btnSalvarEdicaoRoteiro');`;

rotJs = rotJs.replace(targetSave, replaceSave);
fs.writeFileSync('public/js/roteiros.js', rotJs);
