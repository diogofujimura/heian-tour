const http = require('http');
const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, '..', 'public', req.url === '/' ? 'index.html' : req.url);
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
            if(url.startsWith('/api/')) {
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
            console.log('Finished waiting');
            server.close();
            process.exit(0);
        }, 3000);
    });
});
