const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

// Replace fetch API with state.orcamentosDB check
const oldCode = `  // Buscar orcamento
  fetch('/api/orcamentos').then(r=>r.json()).then(orcs => {
    const orc = orcs.find(o => o.notionClienteId === currentEditingClienteId);`;

const newCode = `  // Buscar orcamento
  const orc = state.orcamentosDB.find(o => o.notionClienteId === currentEditingClienteId);
  { // Keep scope block`;

app = app.replace(oldCode, newCode);

// The closing brace for the fetch promise
const oldEndCode = `        navToPage('roteiros');
      };
    }
  });`;

const newEndCode = `        navToPage('roteiros');
      };
    }
  } // End scope block`;

app = app.replace(oldEndCode, newEndCode);

fs.writeFileSync('public/js/app.js', app);
console.log('Fixed cotação check to use state.orcamentosDB');
