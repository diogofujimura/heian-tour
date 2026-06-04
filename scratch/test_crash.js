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
const roteirosCode = fs.readFileSync('public/js/roteiros.js', 'utf-8');
const syncCode = fs.readFileSync('public/js/sync_roteiro_cotacao.js', 'utf-8');

try {
  const s1 = document.createElement('script'); s1.textContent = appCode; document.head.appendChild(s1);
  const s2 = document.createElement('script'); s2.textContent = roteirosCode; document.head.appendChild(s2);
  const s3 = document.createElement('script'); s3.textContent = syncCode; document.head.appendChild(s3);
  
  // Try calling renderListaRoteiros or other functions
  if (typeof window.renderListaRoteiros === 'function') {
      window.state = { roteirosDB: [] };
      window.renderListaRoteiros();
      console.log('renderListaRoteiros OK');
  }
} catch(e) {
  console.log('Error:', e.message, e.stack);
}
