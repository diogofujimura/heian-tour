const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

JSDOM.fromURL('http://localhost:3000/', {
    runScripts: 'dangerously',
    resources: 'usable',
    beforeParse(window) {
        const nativeFetch = globalThis.fetch;
        window.fetch = async (url, options) => {
            let absoluteUrl = url;
            if (typeof url === 'string' && url.startsWith('/')) {
                absoluteUrl = 'http://localhost:3000' + url;
            }
            return nativeFetch(absoluteUrl, options);
        };
    }
}).then(dom => {
    dom.window.console.log = function(...args) {
        console.log('BROWSER LOG:', args.join(' '));
    };
    dom.window.console.error = function(...args) {
        fs.appendFileSync('scratch/browser_errors.log', 'Console Error: ' + args.join(' ') + '\n');
        console.log('BROWSER ERROR:', args.join(' '));
    };
    dom.window.addEventListener('error', event => {
        fs.appendFileSync('scratch/browser_errors.log', 'Global Error: ' + event.message + '\n');
        console.log('GLOBAL ERROR:', event.message, event.error);
    });

    setTimeout(() => {
        console.log('Finished waiting. Checking if state loaded...');
        const win = dom.window;
        console.log('state.orcamentosDB length:', win.state ? win.state.orcamentosDB.length : 'undefined');
        console.log('dbRotas keys:', win.dbRotas ? Object.keys(win.dbRotas) : 'undefined');
        console.log('notionClients length:', win.notionClients ? win.notionClients.length : 'undefined');
        
        process.exit(0);
    }, 5000);
}).catch(err => {
    console.error('Failed to load page from localhost:3000:', err);
    process.exit(1);
});
