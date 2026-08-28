window.roteiroParaCotacao = function(roteiro, nomeRoteiro, isNew = true, opts = {}) {
    // FASE 2 — UMA cotação por roteiro. Procura a existente vinculada (por roteiroId, e por
    // nome/id como fallback). Se existe, REUSA sempre (nunca cria outra) — isto elimina a
    // proliferação (cada "Gerar Cotação" ou save gerava uma nova). Se não existe, cria UMA só,
    // com id determinístico `cot_<roteiroId>`, que converge com a criada automática no servidor.
    const _rid = roteiro && roteiro.id;
    const existingCotacao = state.orcamentosDB.find(o => o && o.id && !o.deletado && (
        (_rid && o.roteiroId === _rid) ||
        (_rid && o.orcRoteiroVinculado === _rid) ||
        (nomeRoteiro && o.orcRoteiroVinculado === nomeRoteiro)
    ));
    if (existingCotacao) {
        if (state.orcamento.id !== existingCotacao.id) {
            abrirOrcamento(existingCotacao.id);
        }
    } else if (typeof novoOrcamento === 'function') {
        novoOrcamento();
        if (_rid) state.orcamento.id = 'cot_' + _rid;
    }
    if (!state.orcamento.tours) state.orcamento.tours = [];
    if (!state.orcamento.transportes) state.orcamento.transportes = [];
    if (!state.orcamento.experiencias) state.orcamento.experiencias = [];
    
    state.orcamento.nome = 'Cotação - ' + (nomeRoteiro || 'Roteiro Importado');
    state.orcamento.orcRoteiroVinculado = nomeRoteiro || '';
    if (roteiro && roteiro.id) state.orcamento.roteiroId = roteiro.id; // vínculo imutável
    if (document.getElementById('orcRoteiroVinculado')) {
        const sel = document.getElementById('orcRoteiroVinculado');
        if (nomeRoteiro && !Array.from(sel.options).some(opt => opt.value === nomeRoteiro)) {
            sel.add(new Option(nomeRoteiro, nomeRoteiro));
        }
        sel.value = nomeRoteiro || '';
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
            if (el.tipo === 'transporte') {
                el.refId = el.refId || Date.now() + Math.random().toString(36).substr(2, 5);
                roteiroTransportesIds.push(el.refId);
            } else if (el.tipo === 'experiencia') {
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
            
            let _tourValor = state.orcamento.valoresTour ? (state.orcamento.valoresTour[duracao] || 0) : 0;
            let _tourDesc = 5, _tourDescAtivo = false;
            if (dia.comercialTour) {
                if (dia.comercialTour.valor !== undefined) _tourValor = dia.comercialTour.valor;
                if (dia.comercialTour.desconto !== undefined) _tourDesc = dia.comercialTour.desconto;
                if (dia.comercialTour.descontoAtivo !== undefined) _tourDescAtivo = dia.comercialTour.descontoAtivo;
            }
            let foundT = state.orcamento.tours.find(t => t._roteiroRefId === dia.refId);
            if (foundT) {
                foundT.data = diaData;
                foundT.pontos = locais.join('\n');
                foundT.duracao = duracao;
                foundT.valor = _tourValor;
                if (dia.comercialTour) { foundT.desconto = _tourDesc; foundT.descontoAtivo = _tourDescAtivo; }
            } else {
                state.orcamento.tours.push({
                    id: Date.now() + Math.floor(Math.random() * 10000),
                    _roteiroRefId: dia.refId,
                    data: diaData,
                    descricao: 'Tour Dia ' + (i+1),
                    pontos: locais.join('\n'),
                    duracao: duracao,
                    valor: _tourValor,
                    desconto: _tourDesc, descontoAtivo: _tourDescAtivo, observacao: ''
                });
            }
        }
        
        // TRANSPORTES E EXP
        dia.elementos.forEach(el => {
            if (el.tipo === 'transporte') {
                let dbId = ''; let preco = el.precoManual || 0; let precoInfantil = el.precoManual || 0;
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
                        desc = `${tdb.trecho} | ${tdb.tipo} | ${tdb.linha} | ${ctg}`;
                    }
                }
                
                // FASE 2 — o item do roteiro é dono do próprio comercial: se migrado, ele manda.
                let _taxaAtiva = false, _taxaTipo = 'grupo', _taxaValor = 3000;
                if (el.comercial) {
                    if (el.comercial.preco !== undefined) preco = el.comercial.preco;
                    if (el.comercial.precoInfantil !== undefined) precoInfantil = el.comercial.precoInfantil;
                    if (el.comercial.taxaAtiva !== undefined) _taxaAtiva = el.comercial.taxaAtiva;
                    if (el.comercial.taxaTipo) _taxaTipo = el.comercial.taxaTipo;
                    if (el.comercial.taxaValor !== undefined) _taxaValor = el.comercial.taxaValor;
                }
                let found = state.orcamento.transportes.find(t => t._roteiroRefId === el.refId);
                if (found) {
                    found.data = diaData;
                    found.categoria = ctg;
                    found._dbId = dbId;
                    found.descricao = desc;
                    found.preco = preco;
                    found.precoInfantil = precoInfantil;
                    if (el.comercial) { found.taxaAtiva = _taxaAtiva; found.taxaTipo = _taxaTipo; found.taxaValor = _taxaValor; }
                    found.compradoHeian = el.compradoHeian !== false;
                } else {
                    const ad = el.adultos !== undefined ? el.adultos : fallbackAd;
                    const cr = el.criancas !== undefined ? el.criancas : fallbackCr;
                    state.orcamento.transportes.push({
                        id: Date.now() + Math.floor(Math.random() * 10000),
                        _roteiroRefId: el.refId,
                        categoria: ctg, _dbId: dbId, data: diaData, descricao: desc,
                        preco: preco, precoInfantil: precoInfantil, adultos: ad, criancas: cr,
                        taxaAtiva: _taxaAtiva, taxaTipo: _taxaTipo, taxaValor: _taxaValor,
                        observacao: (el.horario ? 'Embarque às ' + el.horario : ''), compradoHeian: el.compradoHeian !== false
                    });
                }
            }
            
            if (el.tipo === 'experiencia') {
                let dbId = ''; let preco = 0; let nomeExp = el.nomeExp;
                if (state.experienciasDB) {
                    let edb = null;
                    if (el.expId) edb = state.experienciasDB.find(db => String(db.id) === String(el.expId));
                    if (!edb && el.nomeExp) edb = state.experienciasDB.find(db => db.nome?.toLowerCase() === el.nomeExp.toLowerCase());
                    if (edb) { dbId = edb.id; preco = edb.preco_jpy || edb.precoAdulto || 0; nomeExp = edb.nome; }
                }
                
                let _expPessoas, _expPrecoTipo, _expTaxaAtiva, _expTaxaTipo, _expTaxaValor;
                if (el.comercial) {
                    if (el.comercial.preco !== undefined) preco = el.comercial.preco;
                    _expPessoas = el.comercial.pessoas;
                    _expPrecoTipo = el.comercial.precoTipo;
                    _expTaxaAtiva = el.comercial.taxaAtiva;
                    _expTaxaTipo = el.comercial.taxaTipo;
                    _expTaxaValor = el.comercial.taxaValor;
                }
                let found = state.orcamento.experiencias.find(ex => ex._roteiroRefId === el.refId);
                if (found) {
                    found.data = diaData;
                    found._dbId = dbId;
                    found.nome = nomeExp;
                    found.descricao = nomeExp;
                    found.preco = preco;
                    if (el.comercial) {
                        if (_expPessoas !== undefined) found.pessoas = _expPessoas;
                        if (_expPrecoTipo !== undefined) found.precoTipo = _expPrecoTipo;
                        if (_expTaxaAtiva !== undefined) found.taxaAtiva = _expTaxaAtiva;
                        if (_expTaxaTipo !== undefined) found.taxaTipo = _expTaxaTipo;
                        if (_expTaxaValor !== undefined) found.taxaValor = _expTaxaValor;
                    }
                    found.compradoHeian = el.compradoHeian !== false;
                } else {
                    const ad = el.adultos !== undefined ? el.adultos : fallbackAd;
                    const cr = el.criancas !== undefined ? el.criancas : fallbackCr;
                    state.orcamento.experiencias.push({
                        id: Date.now() + Math.floor(Math.random() * 10000),
                        _roteiroRefId: el.refId,
                        data: diaData, _dbId: dbId, nome: nomeExp, descricao: nomeExp, preco: preco,
                        pessoas: (_expPessoas !== undefined ? _expPessoas : ad + cr),
                        precoTipo: (_expPrecoTipo !== undefined ? _expPrecoTipo : undefined),
                        taxaAtiva: (_expTaxaAtiva !== undefined ? _expTaxaAtiva : false),
                        taxaTipo: (_expTaxaTipo !== undefined ? _expTaxaTipo : 'grupo'),
                        taxaValor: (_expTaxaValor !== undefined ? _expTaxaValor : 3000),
                        observacao: (el.horaPartida ? 'Horário: ' + el.horaPartida : ''), compradoHeian: el.compradoHeian !== false
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

    // FASE 2: chamada silenciosa (auto-população ao ABRIR a cotação) NÃO salva, NÃO alerta e
    // NÃO navega — abrir uma cotação não deve gravá-la nem interromper. Isso também alivia o
    // "travamento ao abrir" (ex.: Haddad), que vinha do save+sync a cada abertura. O save real
    // acontece pelo autosave normal quando o usuário edita de fato.
    if (!opts || !opts.silent) {
        if (typeof triggerRoteiroAutoSave === 'function') triggerRoteiroAutoSave();
        if (typeof salvarOrcamentoAtual === 'function') salvarOrcamentoAtual();
        alert('Cotação importada com sucesso do Roteiro!');
        if (typeof navToPage === 'function') navToPage('orcamento');
        if (state.orcamento && state.orcamento.notionClienteId && typeof syncClienteAtivo === 'function') {
            syncClienteAtivo(state.orcamento.notionClienteId);
        }
    }
};

// FASE 2 — REMOVIDA: `cotacaoParaRoteiro` fazia resync reverso DESTRUTIVO (apagava do roteiro
// os itens que não estivessem na cotação) — foi ela que apagou o roteiro do Yamada. Com a
// unificação, o ROTEIRO é a fonte de verdade e a cotação deriva dele; exportar cotação->roteiro
// não faz mais sentido. Mantida como no-op defensivo caso algum botão em cache ainda a chame.
window.cotacaoParaRoteiro = function() {
    console.warn('cotacaoParaRoteiro foi descontinuada (Fase 2): o roteiro é a fonte de verdade.');
    if (typeof alert === 'function') alert('Função descontinuada: o roteiro já é a fonte de verdade — edite o roteiro diretamente.');
};
