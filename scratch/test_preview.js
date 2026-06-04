const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const html = fs.readFileSync('public/index.html', 'utf-8');
const dom = new JSDOM(html, { runScripts: 'dangerously' });
const window = dom.window;
const document = window.document;
global.window = window;
global.document = document;
global.localStorage = { getItem:()=>null, setItem:()=>{}, removeItem:()=>{} };

const appCode = fs.readFileSync('public/js/app.js', 'utf-8');
// Mock things
window.today = () => '2023-01-01';
window.fmtDataBR = () => '01/01/2023';

const script = document.createElement('script');
script.textContent = appCode;
document.head.appendChild(script);

// Call emptyOrc and initialize state
window.state = { 
  orcamento: window.emptyOrc(),
  config: {}
};
window.getUSD = () => 0.007;

// Set data like sync_roteiro_cotacao
window.state.orcamento.transportes.push({
    id: 123,
    categoria: 'Comum',
    trechoId: '123',
    data: '2023-10-10',
    pAdulto: 5000,
    pCrianca: 2500,
    pessoas: 2,
    observacao: 'Trem',
    compradoHeian: true
});
window.state.orcamento.experiencias.push({
    id: 456,
    data: '2023-10-10',
    expId: '123',
    pAdulto: 1000,
    pCrianca: 500,
    pessoas: 2,
    observacao: 'Exp',
    compradoHeian: true
});

try {
  window.renderPreview();
  console.log('No error');
} catch(e) {
  console.log('Error:', e.message, e.stack);
}
