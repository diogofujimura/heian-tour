const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const html = fs.readFileSync('public/index.html', 'utf-8');

const dom = new JSDOM(html, { 
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost/'
});

dom.window.console.log = function() {};
dom.window.console.error = function(...args) {
    fs.appendFileSync('scratch/browser_errors.log', args.join(' ') + '\n');
};
dom.window.addEventListener('error', event => {
    fs.appendFileSync('scratch/browser_errors.log', 'Global error: ' + event.message + '\n');
});

setTimeout(() => {
    console.log('Done waiting');
    process.exit(0);
}, 2000);
