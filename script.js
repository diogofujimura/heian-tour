const fs = require("fs");
let js = fs.readFileSync("public/js/roteiros.js", "utf8");
js = js.replaceAll("${el.compradoHeian ? '<span", "${el.compradoHeian !== false ? '<span");
js = js.replaceAll("${el.compradoHeian ? 'var(--gold)' : '#ccc'}", "${el.compradoHeian !== false ? 'var(--gold)' : '#ccc'}");
js = js.replaceAll("${el.compradoHeian ? 'var(--gold)' : '#fff'}", "${el.compradoHeian !== false ? 'var(--gold)' : '#fff'}");
js = js.replaceAll("${el.compradoHeian ? 'white' : 'var(--text-sec)'}", "${el.compradoHeian !== false ? 'white' : 'var(--text-sec)'}");
js = js.replaceAll("${el.compradoHeian ? 'checked' : ''}", "${el.compradoHeian !== false ? 'checked' : ''}");

js = js.replaceAll("criancas: parseInt(roteiroEmEdicao.cliente?.criancas || document.getElementById('rotClienteCriancas')?.value || 0)\r\n    });", "criancas: parseInt(roteiroEmEdicao.cliente?.criancas || document.getElementById('rotClienteCriancas')?.value || 0),\r\n        compradoHeian: true\r\n    });");

js = js.replaceAll("criancas: parseInt(roteiroEmEdicao.cliente?.criancas || document.getElementById('rotClienteCriancas')?.value || 0)\n    });", "criancas: parseInt(roteiroEmEdicao.cliente?.criancas || document.getElementById('rotClienteCriancas')?.value || 0),\n        compradoHeian: true\n    });");

fs.writeFileSync("public/js/roteiros.js", js, "utf8");
console.log("Script done");
