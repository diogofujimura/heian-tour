const http = require('http');
const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    let filePath = path.join(__dirname, '..', 'public', urlPath === '/' ? 'index.html' : urlPath);
    if (fs.existsSync(filePath)) {
        res.writeHead(200);
        res.end(fs.readFileSync(filePath));
    } else if (req.url === '/api/config') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({}));
    } else if (req.url === '/api/roteiros') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({'Roteiro Teste': {}}));
    } else if (req.url.startsWith('/api/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('[]');
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(3002, () => {
    JSDOM.fromURL('http://localhost:3002/', {
        runScripts: 'dangerously',
        resources: 'usable'
    }).then(dom => {
        dom.window.fetch = async (url) => {
            const path = url.split('?')[0];
            if (path.endsWith('/api/config') || path.endsWith('/api/cambio') || path.endsWith('/api/roteiros')) {
                return { json: async () => ({}) };
            }
            return { json: async () => [] };
        };
        dom.window.console.log = function() {};
        dom.window.console.error = function(...args) {
            fs.appendFileSync('scratch/browser_errors.log', args.join(' ') + '\n');
            console.log('BROWSER ERROR:', args.join(' '));
        };
        dom.window.addEventListener('error', event => {
            fs.appendFileSync('scratch/browser_errors.log', 'Global error: ' + event.message + '\n');
            console.log('GLOBAL ERROR:', event.message, event.error);
        });

        setTimeout(() => {
            console.log('Simulating hover and click...');
            
            // Mock state
            const win = dom.window;
            // Mutation instead of reassignment to preserve scope references
            win.state.orcamentosDB.push({
                id: 1,
                nome: "Orcamento Teste",
                cliente: { nome: "Gisela", adultos: 2, criancas: 0, dataOrcamento: "2026-06-05" },
                tours: [],
                transportes: [],
                experiencias: [],
                itensAdicionais: []
            });
            win.dbRotas["Roteiro Teste"] = {
                cliente: { nome: "Gisela" },
                dias: []
            };
            win.notionClients.push({
                id: "cli_1",
                nome: "Gisela",
                status: "Aprovado",
                adultos: 2,
                criancas: 0
            });
            
            // Render lists
            win.renderListaOrcamentos();
            win.renderListaRoteiros();
            win.renderClientesTabela();
            
            const clientCard = win.document.querySelector('#tabelaClientesList .list-card');
            if (clientCard) {
                console.log('Testing client hover...');
                clientCard.dispatchEvent(new win.MouseEvent('mouseenter'));
                
                console.log('Testing client click to open preview...');
                clientCard.click();
                
                const btnCot = win.document.getElementById('btnAcessoCotacaoPreview');
                const btnRot = win.document.getElementById('btnAcessoRoteiroPreview');
                if (btnCot) {
                    console.log('Testing click on "Abrir Cotação" link in client preview...');
                    btnCot.click();
                }
                
                if (typeof win.navToPage === 'function') win.navToPage('clientes');
                clientCard.click();
                if (btnRot) {
                    console.log('Testing click on "Abrir Roteiro" link in client preview...');
                    btnRot.click();
                }
                
                console.log('Testing client edit button click...');
                const editBtn = clientCard.querySelector('.btn-card-edit-minimalist');
                if (editBtn) editBtn.click();
            } else {
                console.log('No client card found!');
            }
            
            // Test hover on Roteiros card
            const roteiroCard = win.document.querySelector('#roteirosLista .list-card');
            if (roteiroCard) {
                console.log('Testing roteiro hover...');
                roteiroCard.dispatchEvent(new win.MouseEvent('mouseenter'));
                
                console.log('Testing roteiro edit button click...');
                const editBtn = roteiroCard.querySelector('.btn-card-edit-minimalist');
                if (editBtn) editBtn.click();
            } else {
                console.log('No roteiro card found!');
            }
            
            // Test hover on Orcamento card
            const orcCard = win.document.querySelector('#orcamentosLista .list-card');
            if (orcCard) {
                console.log('Testing orcamento hover...');
                orcCard.dispatchEvent(new win.MouseEvent('mouseenter'));
                
                console.log('Testing orcamento edit button click...');
                const editBtn = orcCard.querySelector('.btn-card-edit-minimalist');
                if (editBtn) editBtn.click();
            } else {
                console.log('No orcamento card found!');
            }

            console.log('Finished simulation');
            server.close();
            process.exit(0);
        }, 1500);
    });
});
