const fs = require('fs');
let js = fs.readFileSync('public/js/sync_roteiro_cotacao.js', 'utf8');

const start = js.indexOf('window.roteiroParaCotacao = function(roteiro, nomeRoteiro, isNew = true) {');
const end = js.indexOf('window.cotacaoParaRoteiro = function(orcamento) {');

const newCode = `window.roteiroParaCotacao = function(roteiro, nomeRoteiro, isNew = true) {
    if (!isNew) {
        const existingCotacao = state.orcamentosDB.find(o => o.orcRoteiroVinculado === nomeRoteiro);
        if (existingCotacao && state.orcamento.id !== existingCotacao.id) {
            abrirOrcamento(existingCotacao.id);
        }
    }
    if (isNew && typeof novoOrcamento === 'function') {
        novoOrcamento();
    }
    if (!state.orcamento.tours) state.orcamento.tours = [];
    if (!state.orcamento.transportes) state.orcamento.transportes = [];
    if (!state.orcamento.experiencias) state.orcamento.experiencias = [];
    
    state.orcamento.nome = 'Cotação - ' + (nomeRoteiro || 'Roteiro Importado');
    state.orcamento.orcRoteiroVinculado = nomeRoteiro || '';
    if (document.getElementById('orcRoteiroVinculado')) {
        document.getElementById('orcRoteiroVinculado').value = nomeRoteiro || '';
    }
    
    // Herdando o Cliente do Notion e Estadias
    let notionId = null;
    if (typeof state !== 'undefined' && state && state.orcamentosDB && Array.isArray(state.orcamentosDB)) {
        const vinculado = state.orcamentosDB.find(o => o.orcRoteiroVinculado === nomeRoteiro);
        if (vinculado) notionId = vinculado.notionClienteId;
    }
    if (!notionId && typeof currentEditingClienteId !== 'undefined' && currentEditingClienteId) {
        notionId = currentEditingClienteId;
    }
    if (!notionId && roteiro.cliente && roteiro.cliente.notionClienteId) {
        notionId = roteiro.cliente.notionClienteId;
    }
    if (notionId) {
        state.orcamento.notionClienteId = notionId;
    }

    if (roteiro.estadias && Array.isArray(roteiro.estadias)) {
        state.orcamento.estadias = JSON.parse(JSON.stringify(roteiro.estadias));
    }

    if (roteiro.cliente) {
        if(document.getElementById('orcNome')) document.getElementById('orcNome').value = state.orcamento.nome;
        if(document.getElementById('clienteNome')) document.getElementById('clienteNome').value = roteiro.cliente.nome || '';
        if(document.getElementById('clienteAdultos')) document.getElementById('clienteAdultos').value = roteiro.cliente.adultos || '2';
        if(document.getElementById('clienteCriancas')) document.getElementById('clienteCriancas').value = roteiro.cliente.criancas || '0';
        if(document.getElementById('clienteDataOrcamento')) document.getElementById('clienteDataOrcamento').value = roteiro.cliente.dataOrcamento || today();
        
        state.orcamento.cliente = {
            nome: roteiro.cliente.nome || '',
            adultos: roteiro.cliente.adultos || '2',
            criancas: roteiro.cliente.criancas || '0',
            dataOrcamento: roteiro.cliente.dataOrcamento || today(),
            dataFim: roteiro.cliente.dataFim || '',
            vooChegada: roteiro.cliente.vooChegada || '',
            vooPartida: roteiro.cliente.vooPartida || ''
        };
    }
    
    // Mapeamento Cirurgico
    const roteiroToursIds = [];
    const roteiroTransportesIds = [];
    const roteiroExpIds = [];

    roteiro.dias.forEach((dia, i) => {
        if (dia.tourGuiado) {
            dia.refId = dia.refId || Date.now() + Math.random().toString(36).substr(2, 5);
            roteiroToursIds.push(dia.refId);
        }
        (dia.elementos || []).forEach(el => {
            if (el.tipo === 'transporte' && el.compradoHeian !== false) {
                el.refId = el.refId || Date.now() + Math.random().toString(36).substr(2, 5);
                roteiroTransportesIds.push(el.refId);
            } else if (el.tipo === 'experiencia' && el.compradoHeian !== false) {
                el.refId = el.refId || Date.now() + Math.random().toString(36).substr(2, 5);
                roteiroExpIds.push(el.refId);
            }
        });
    });

    // 1. DELETE FROM COTACAO se não existe mais no Roteiro
    state.orcamento.tours = state.orcamento.tours.filter(t => roteiroToursIds.includes(t._roteiroRefId));
    state.orcamento.transportes = state.orcamento.transportes.filter(t => roteiroTransportesIds.includes(t._roteiroRefId));
    state.orcamento.experiencias = state.orcamento.experiencias.filter(e => roteiroExpIds.includes(e._roteiroRefId));

    const fallbackAd = parseInt(document.getElementById('clienteAdultos')?.value) || parseInt(roteiro.cliente?.adultos) || 2;
    const fallbackCr = parseInt(document.getElementById('clienteCriancas')?.value) || parseInt(roteiro.cliente?.criancas) || 0;

    // 2. UPSERT items
    roteiro.dias.forEach((dia, i) => {
        let diaData = dia.data || '';
        
        // TOURS
        if (dia.tourGuiado) {
            let duracao = '8h';
            let locais = [];
            dia.elementos.forEach(el => {
                if (el.tipo === 'info') {
                    if (el.duracaoTour) duracao = el.duracaoTour;
                    if (el.dataDoTour) diaData = el.dataDoTour;
                }
                if (el.tipo === 'sequencia' && el.atracoesDoDia) locais.push(...el.atracoesDoDia);
            });
            
            let foundT = state.orcamento.tours.find(t => t._roteiroRefId === dia.refId);
            if (foundT) {
                foundT.data = diaData;
                foundT.pontos = locais.join('\\n');
                foundT.duracao = duracao;
                foundT.valor = state.orcamento.valoresTour ? (state.orcamento.valoresTour[duracao] || 0) : 0;
            } else {
                state.orcamento.tours.push({
                    id: Date.now() + Math.floor(Math.random() * 10000),
                    _roteiroRefId: dia.refId,
                    data: diaData,
                    descricao: 'Tour Dia ' + (i+1),
                    pontos: locais.join('\\n'),
                    duracao: duracao,
                    valor: state.orcamento.valoresTour ? (state.orcamento.valoresTour[duracao] || 0) : 0,
                    desconto: 0, descontoAtivo: false, observacao: ''
                });
            }
        }
        
        // TRANSPORTES E EXP
        dia.elementos.forEach(el => {
            if (el.tipo === 'transporte' && el.compradoHeian !== false) {
                let dbId = ''; let preco = 0; let precoInfantil = 0;
                let ctg = el.categoria || 'Comum';
                let desc = el.cidadeOrigem + ' ➔ ' + el.cidadeDestino + ' | ' + el.tipoTransporte + ' | ' + (el.linha || '') + ' | ' + ctg;
                
                if (state.transportesDB) {
                    let tdb = null;
                    if (el.trechoId) tdb = state.transportesDB.find(db => String(db.id) === String(el.trechoId));
                    if (!tdb && el.cidadeOrigem && el.cidadeDestino) {
                        tdb = state.transportesDB.find(db => {
                            const trecho = (db.trecho || '').toLowerCase();
                            const dbCategoria = (db.categoria || '').toLowerCase();
                            const elCategoria = (el.categoria || 'comum').toLowerCase();
                            const matchTrecho = trecho.includes(el.cidadeOrigem.toLowerCase()) && trecho.includes(el.cidadeDestino.toLowerCase());
                            if (!matchTrecho) return false;
                            if (elCategoria.includes('green') && dbCategoria.includes('green')) return true;
                            if (!elCategoria.includes('green') && !dbCategoria.includes('green')) return true;
                            return false;
                        });
                        if (!tdb) tdb = state.transportesDB.find(db => (db.trecho || '').toLowerCase().includes(el.cidadeOrigem.toLowerCase()) && (db.trecho || '').toLowerCase().includes(el.cidadeDestino.toLowerCase()));
                    }
                    if (tdb) {
                        dbId = tdb.id;
                        const matches = state.transportesDB.filter(x => x.trecho === tdb.trecho && x.tipo === tdb.tipo && x.linha === tdb.linha && x.categoria === tdb.categoria);
                        matches.forEach(m => {
                            if ((m.idade || 'adulto').toLowerCase().includes('infantil')) { precoInfantil = m.preco_jpy || 0; }
                            else { preco = m.preco_jpy || 0; dbId = m.id; }
                        });
                        desc = \`\${tdb.trecho} | \${tdb.tipo} | \${tdb.linha} | \${ctg}\`;
                    }
                }
                
                let found = state.orcamento.transportes.find(t => t._roteiroRefId === el.refId);
                if (found) {
                    found.data = diaData;
                    found.categoria = ctg;
                    found._dbId = dbId;
                    found.descricao = desc;
                    found.preco = preco;
                    found.precoInfantil = precoInfantil;
                    // Mantem adultos e crianças como o usuário editou na Cotação
                } else {
                    const ad = el.adultos !== undefined ? el.adultos : fallbackAd;
                    const cr = el.criancas !== undefined ? el.criancas : fallbackCr;
                    state.orcamento.transportes.push({
                        id: Date.now() + Math.floor(Math.random() * 10000),
                        _roteiroRefId: el.refId,
                        categoria: ctg, _dbId: dbId, data: diaData, descricao: desc,
                        preco: preco, precoInfantil: precoInfantil, adultos: ad, criancas: cr,
                        taxaAtiva: false, taxaTipo: 'grupo', taxaValor: 3000,
                        observacao: (el.horario ? 'Embarque às ' + el.horario : ''), compradoHeian: true
                    });
                }
            }
            
            if (el.tipo === 'experiencia' && el.compradoHeian !== false) {
                let dbId = ''; let preco = 0; let nomeExp = el.nomeExp;
                if (state.experienciasDB) {
                    let edb = null;
                    if (el.expId) edb = state.experienciasDB.find(db => String(db.id) === String(el.expId));
                    if (!edb && el.nomeExp) edb = state.experienciasDB.find(db => db.nome?.toLowerCase() === el.nomeExp.toLowerCase());
                    if (edb) { dbId = edb.id; preco = edb.preco_jpy || edb.precoAdulto || 0; nomeExp = edb.nome; }
                }
                
                let found = state.orcamento.experiencias.find(ex => ex._roteiroRefId === el.refId);
                if (found) {
                    found.data = diaData;
                    found._dbId = dbId;
                    found.nome = nomeExp;
                    found.descricao = nomeExp;
                    found.preco = preco;
                    // Mantem pessoas customizadas
                } else {
                    const ad = el.adultos !== undefined ? el.adultos : fallbackAd;
                    const cr = el.criancas !== undefined ? el.criancas : fallbackCr;
                    state.orcamento.experiencias.push({
                        id: Date.now() + Math.floor(Math.random() * 10000),
                        _roteiroRefId: el.refId,
                        data: diaData, _dbId: dbId, nome: nomeExp, descricao: nomeExp, preco: preco,
                        pessoas: ad + cr, observacao: (el.horaPartida ? 'Horário: ' + el.horaPartida : ''), compradoHeian: true
                    });
                }
            }
        });
    });
    
    if (typeof renderToursForm === 'function') renderToursForm();
    if (typeof renderTransportesForm === 'function') renderTransportesForm();
    if (typeof renderExperienciasForm === 'function') renderExperienciasForm();
    if (typeof renderEstadiasReadOnly === 'function') renderEstadiasReadOnly();
    if (typeof updateResumo === 'function') updateResumo();
    if (typeof triggerRoteiroAutoSave === 'function') triggerRoteiroAutoSave();
    if (typeof salvarOrcamentoAtual === 'function') salvarOrcamentoAtual();
    
    alert('Cotação importada com sucesso do Roteiro!');
    if (typeof navToPage === 'function') navToPage('orcamento');
    
    if (state.orcamento && state.orcamento.notionClienteId && typeof syncClienteAtivo === 'function') {
        syncClienteAtivo(state.orcamento.notionClienteId);
    }
};\n\n`;

js = js.substring(0, start) + newCode + js.substring(end);
fs.writeFileSync('public/js/sync_roteiro_cotacao.js', js, 'utf8');
console.log('Cirurgia Roteiro -> Cotacao completa.');
