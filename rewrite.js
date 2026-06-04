const fs = require('fs');
let js = fs.readFileSync('public/js/sync_roteiro_cotacao.js', 'utf8');

const start = js.indexOf('window.cotacaoParaRoteiro = function(orcamento) {');
const end = js.indexOf('};\n\n', start) + 2;

const newCode = `window.cotacaoParaRoteiro = function(orcamento) {
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
            
            alert('Roteiro atualizado cirurgicamente a partir da Cotação com sucesso!');
        }
    }
    
    if (roteiroEmEdicao && roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.notionClienteId && typeof syncClienteAtivo === 'function') {
        syncClienteAtivo(roteiroEmEdicao.cliente.notionClienteId);
    }
};\n\n`;

js = js.substring(0, start) + newCode + js.substring(end);
fs.writeFileSync('public/js/sync_roteiro_cotacao.js', js, 'utf8');
console.log('Replaced cotacaoParaRoteiro');


// Now roteiros.js
let roteirosJs = fs.readFileSync('public/js/roteiros.js', 'utf8');

roteirosJs = roteirosJs.replace(/roteiroEmEdicao\.dias\[idx\]\.elementos\.push\(\{ tipo: 'sequencia',/g, 
"roteiroEmEdicao.dias[idx].elementos.push({ refId: Date.now() + Math.random().toString(36).substr(2, 5), tipo: 'sequencia',");

roteirosJs = roteirosJs.replace(/roteiroEmEdicao\.dias\[idx\]\.elementos\.push\(\{ tipo: 'texto',/g, 
"roteiroEmEdicao.dias[idx].elementos.push({ refId: Date.now() + Math.random().toString(36).substr(2, 5), tipo: 'texto',");

roteirosJs = roteirosJs.replace(/roteiroEmEdicao\.dias\[idx\]\.elementos\.push\(\{ tipo: 'info',/g, 
"roteiroEmEdicao.dias[idx].elementos.push({ refId: Date.now() + Math.random().toString(36).substr(2, 5), tipo: 'info',");

roteirosJs = roteirosJs.replace(/roteiroEmEdicao\.dias\[idx\]\.elementos\.push\(\{ \n        tipo: 'transporte',/g, 
"roteiroEmEdicao.dias[idx].elementos.push({ refId: Date.now() + Math.random().toString(36).substr(2, 5), \n        tipo: 'transporte',");

roteirosJs = roteirosJs.replace(/roteiroEmEdicao\.dias\[idx\]\.elementos\.push\(\{ \n        tipo: 'experiencia',/g, 
"roteiroEmEdicao.dias[idx].elementos.push({ refId: Date.now() + Math.random().toString(36).substr(2, 5), \n        tipo: 'experiencia',");

fs.writeFileSync('public/js/roteiros.js', roteirosJs, 'utf8');
console.log('Added refId to adicionarElemento in roteiros.js');
