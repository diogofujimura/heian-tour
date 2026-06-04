window.roteiroParaCotacao = function(roteiro, nomeRoteiro, isNew = true) {
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
                foundT.pontos = locais.join('\n');
                foundT.duracao = duracao;
                foundT.valor = state.orcamento.valoresTour ? (state.orcamento.valoresTour[duracao] || 0) : 0;
            } else {
                state.orcamento.tours.push({
                    id: Date.now() + Math.floor(Math.random() * 10000),
                    _roteiroRefId: dia.refId,
                    data: diaData,
                    descricao: 'Tour Dia ' + (i+1),
                    pontos: locais.join('\n'),
                    duracao: duracao,
                    valor: state.orcamento.valoresTour ? (state.orcamento.valoresTour[duracao] || 0) : 0,
                    desconto: 0, descontoAtivo: false, observacao: ''
                });
            }
        }
        
        // TRANSPORTES E EXP
        dia.elementos.forEach(el => {
            if (el.tipo === 'transporte' && el.compradoHeian !== false) {
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
};

window.cotacaoParaRoteiro = function(orcamento) {
    if (!orcamento || !orcamento.tours) {
        alert('Cotação inválida.');
        return;
    }
    
    const nome = orcamento.orcRoteiroVinculado || orcamento.nome || 'Roteiro Importado da Cotação';
    
    if (typeof roteiroEmEdicao !== 'undefined') {
        roteiroOriginalNome = nome;
        roteiroEmEdicao.cliente = {
            nome: orcamento.cliente?.nome || '',
            adultos: orcamento.cliente?.adultos || '2',
            criancas: orcamento.cliente?.criancas || '0',
            dataOrcamento: orcamento.cliente?.dataOrcamento || '',
            notionClienteId: orcamento.notionClienteId || ''
        };
        
        roteiroEmEdicao.estadias = orcamento.estadias ? JSON.parse(JSON.stringify(orcamento.estadias)) : [];
        if (!roteiroEmEdicao.dias) roteiroEmEdicao.dias = [];
        
        // Maps to quickly find existing items in Cotacao
        const cotacaoToursIds = (orcamento.tours || []).map(t => t._roteiroRefId).filter(id => id);
        const cotacaoTransportesIds = (orcamento.transportes || []).map(t => t._roteiroRefId).filter(id => id);
        const cotacaoExpIds = (orcamento.experiencias || []).map(e => e._roteiroRefId).filter(id => id);
        
        // 1. DELETE items in Roteiro that are missing from Cotacao
        // A. Tours (marked on the day)
        roteiroEmEdicao.dias.forEach((dia) => {
            if (dia.tourGuiado && dia.refId && !cotacaoToursIds.includes(dia.refId)) {
                dia.tourGuiado = false;
            }
        });
        
        // B. Transportes and Experiencias
        roteiroEmEdicao.dias.forEach((dia) => {
            if (dia.elementos) {
                dia.elementos = dia.elementos.filter(el => {
                    if (el.tipo === 'transporte') {
                        // Se tem refId e nao esta na cotacao, foi excluido
                        if (el.refId && !cotacaoTransportesIds.includes(el.refId)) return false;
                    } else if (el.tipo === 'experiencia') {
                        if (el.refId && !cotacaoExpIds.includes(el.refId)) return false;
                    }
                    return true;
                });
            }
        });

        // Helper function to find or create day
        const getOrCreateDia = (dateStr) => {
            let dia = roteiroEmEdicao.dias.find(d => d.data === dateStr);
            if (!dia) {
                dia = { data: dateStr, tourGuiado: false, elementos: [], refId: Date.now() + Math.random().toString(36).substr(2, 5) };
                roteiroEmEdicao.dias.push(dia);
                roteiroEmEdicao.dias.sort((a, b) => (a.data || '').localeCompare(b.data || ''));
            }
            if (!dia.elementos) dia.elementos = [];
            return dia;
        };

        // Helper function to find element in Roteiro
        const findElement = (refId) => {
            if (!refId) return null;
            for (let dia of roteiroEmEdicao.dias) {
                if (dia.elementos) {
                    let el = dia.elementos.find(e => e.refId === refId);
                    if (el) return { dia, el };
                }
            }
            return null;
        };

        // 2. UPSERT Tours
        (orcamento.tours || []).forEach(t => {
            let dia = roteiroEmEdicao.dias.find(d => d.refId === t._roteiroRefId);
            if (!dia && t.data) dia = getOrCreateDia(t.data);
            if (dia) {
                dia.tourGuiado = true;
                // find info block to update duration
                let infoEl = dia.elementos.find(e => e.tipo === 'info');
                if (infoEl) infoEl.duracaoTour = t.duracao || '8h';
            }
        });

        // 3. UPSERT Transportes
        (orcamento.transportes || []).forEach(t => {
            let found = findElement(t._roteiroRefId);
            const tdb = state.transportesDB ? state.transportesDB.find(db => db.id == t._dbId) : null;
            if (found) {
                found.el.adultos = t.adultos;
                found.el.criancas = t.criancas;
                found.el.categoria = t.categoria || 'Comum';
                if (tdb) {
                    found.el.cidadeOrigem = tdb.trecho.split('➔')[0]?.trim() || '';
                    found.el.cidadeDestino = tdb.trecho.split('➔')[1]?.trim() || '';
                    found.el.trechoId = tdb.id;
                    found.el.tipoTransporte = tdb.tipo;
                }
            } else {
                let dia = getOrCreateDia(t.data || '');
                dia.elementos.push({
                    tipo: 'transporte',
                    cidadeOrigem: tdb ? tdb.trecho.split('➔')[0]?.trim() || '' : '',
                    cidadeDestino: tdb ? tdb.trecho.split('➔')[1]?.trim() || '' : '',
                    trechoId: tdb ? tdb.id : null,
                    tipoTransporte: tdb ? tdb.tipo : 'Trem',
                    categoria: t.categoria || 'Comum',
                    compradoHeian: true,
                    adultos: t.adultos || 2,
                    criancas: t.criancas || 0,
                    refId: t._roteiroRefId || Date.now() + Math.random().toString(36).substr(2, 5)
                });
            }
        });

        // 4. UPSERT Experiencias
        (orcamento.experiencias || []).forEach(ex => {
            let found = findElement(ex._roteiroRefId);
            const edb = state.experienciasDB ? state.experienciasDB.find(db => db.id == ex._dbId) : null;
            if (found) {
                found.el.adultos = ex.adultos;
                found.el.criancas = ex.criancas;
                if (edb) {
                    found.el.expId = edb.id;
                    found.el.nomeExp = edb.nome;
                }
            } else {
                let dia = getOrCreateDia(ex.data || '');
                dia.elementos.push({
                    tipo: 'experiencia',
                    expId: edb ? edb.id : null,
                    nomeExp: edb ? edb.nome : (ex.descricao || ex.nome || 'Experiência'),
                    compradoHeian: true,
                    adultos: ex.adultos || 2,
                    criancas: ex.criancas || 0,
                    refId: ex._roteiroRefId || Date.now() + Math.random().toString(36).substr(2, 5)
                });
            }
        });

        if (state.orcamentosDB && orcamento.id) {
            let dbIdx = state.orcamentosDB.findIndex(o => o.id === orcamento.id);
            if (dbIdx > -1) {
                state.orcamentosDB[dbIdx].orcRoteiroVinculado = nome;
                salvarOrcamentosDB();
            }
        }
        
        if (typeof abrirEditorRoteiro === 'function') {
            abrirEditorRoteiro(nome);
            if(typeof renderEditDias === 'function') renderEditDias();
            navToPage('roteiros');
            
            setTimeout(() => {
                const btnSave = document.getElementById('btnEditarRoteiro');
                if (btnSave && btnSave.textContent.includes('Salvar')) {
                    btnSave.click();
                } else {
                    document.getElementById('editRoteiroNome').value = nome;
                    triggerRoteiroAutoSave();
                }
            }, 300);
            
            alert('Roteiro atuali➔ado cirurgicamente a partir da Cotação com sucesso!');
        }
    }
    
    if (roteiroEmEdicao && roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.notionClienteId && typeof syncClienteAtivo === 'function') {
        syncClienteAtivo(roteiroEmEdicao.cliente.notionClienteId);
    }
};