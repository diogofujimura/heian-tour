const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');
const path = require('path');

// Ler o HTML original
const htmlContent = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

// Criar o DOM simulado permitindo execução de scripts
const dom = new JSDOM(htmlContent, {
  runScripts: "outside-only",
  resources: "usable",
  url: "http://localhost/"
});

const { window } = dom;
global.window = window;
global.document = window.document;
global.navigator = window.navigator;

// Inicializar state e notionClients globais para evitar ReferenceError
window.state = {
  config: {},
  transportesDB: [],
  experienciasDB: [],
  atracoesDB: [],
  rotasDB: {},
  orcamentosDB: [],
  orcamento: { valoresTour: {}, itensAdicionais: [] }
};
global.state = window.state;

window.notionClients = [];
global.notionClients = window.notionClients;

// Mock de localStorage
const localStorageMock = {
  getItem: () => null,
  setItem: () => null,
  removeItem: () => null
};
global.localStorage = localStorageMock;
window.localStorage = localStorageMock;

// Mock de fetch no escopo do window
const fetchMock = () => Promise.resolve({
  ok: true,
  json: () => Promise.resolve([])
});
global.fetch = fetchMock;
window.fetch = fetchMock;

// Mock Chart.js
window.Chart = class {
  constructor() {}
};

// Capturar erros do console
window.addEventListener('error', (event) => {
  console.log('DOM WINDOW ERROR:', event.message, 'at', event.filename, ':', event.lineno);
});

console.log('--- Carregando arquivos JS ---');
try {
  // Ler e avaliar os scripts na ordem correta
  const scripts = [
    'public/js/roteiros.js',
    'public/js/app.js',
    'public/js/sync_roteiro_cotacao.js',
    'public/js/sync_clientes.js',
    'public/js/dashboard.js'
  ];

  scripts.forEach(file => {
    let code = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    // Para contornar re-declaração de 'const state' e outras variáveis
    code = code.replace(/^const state =/m, 'window.state =');
    code = code.replace(/^let notionClients =/m, 'window.notionClients =');
    
    window.eval(code);
    console.log(`Carregado: ${file}`);
  });

  // Simular DOMContentLoaded
  const event = window.document.createEvent('Event');
  event.initEvent('DOMContentLoaded', true, true);
  window.document.dispatchEvent(event);
  console.log('DOMContentLoaded disparado.');

  // Testar clique no botão Novo Roteiro
  const btnNovoR = window.document.getElementById('btnNovoRoteiroList');
  if (btnNovoR) {
    console.log('Clicking btnNovoRoteiroList...');
    btnNovoR.click();
    console.log('Clicked btnNovoRoteiroList.');
  } else {
    console.log('btnNovoRoteiroList não encontrado.');
  }

  // Testar clique no botão Novo Cliente
  const btnNovoC = window.document.getElementById('btnNovoCliente');
  if (btnNovoC) {
    console.log('Clicking btnNovoCliente...');
    btnNovoC.click();
    console.log('Clicked btnNovoCliente.');
  } else {
    console.log('btnNovoCliente não encontrado.');
  }

  // Testar clique no botão Novo Orçamento
  const btnNovoO = window.document.getElementById('btnNovoOrcList');
  if (btnNovoO) {
    console.log('Clicking btnNovoOrcList...');
    btnNovoO.click();
    console.log('Clicked btnNovoOrcList.');
  } else {
    console.log('btnNovoOrcList não encontrado.');
  }

} catch (err) {
  console.error('FATAL DIAGNOSTIC ERROR:', err);
}
