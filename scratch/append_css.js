const fs = require('fs');
const css = `
/* ── ROTEIROS PREMIUM ────────────────────────────────────────────────── */
.select-roteiro { padding: 8px 12px; border: 1px solid var(--border-dk); border-radius: 4px; font-family: var(--ff-body); font-size: 13px; color: var(--ink); background: var(--warm-white); outline: none; min-width: 250px; }
.roteiro-container { display: flex; gap: 24px; align-items: flex-start; }
.roteiro-timeline { flex: 1; display: flex; flex-direction: column; gap: 20px; position: relative; padding-left: 20px; border-left: 2px solid rgba(201,160,90,0.3); }
.dia-card { background: var(--warm-white); border: 1px solid var(--border); border-radius: 8px; padding: 20px; box-shadow: var(--shadow); position: relative; }
.dia-card::before { content: ''; position: absolute; left: -27px; top: 24px; width: 12px; height: 12px; border-radius: 50%; background: var(--gold); border: 2px solid var(--cream); }
.dia-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; }
.dia-numero { font-family: var(--ff-display); font-size: 22px; color: var(--crimson); font-weight: 500; }
.dia-cidade { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gold-dk); font-weight: 500; background: rgba(201,160,90,0.1); padding: 2px 8px; border-radius: 4px; }
.dia-titulo { font-size: 16px; color: var(--ink); font-weight: 400; }
.dia-atracoes { display: flex; flex-wrap: wrap; gap: 8px; }
.chip-atracao { background: rgba(201,160,90,0.08); border: 1px solid rgba(201,160,90,0.3); padding: 6px 12px; border-radius: 16px; font-size: 12px; color: var(--ink-mid); cursor: pointer; transition: all 0.2s; position: relative; }
.chip-atracao:hover { background: var(--gold); color: white; transform: translateY(-1px); box-shadow: 0 4px 8px rgba(201,160,90,0.2); }
.chip-atracao.missing { border-style: dashed; opacity: 0.7; }
/* Popover/Modal de Atração */
.atracao-popover { position: fixed; z-index: 1000; background: var(--warm-white); border: 1px solid var(--border-dk); border-radius: 8px; width: 320px; padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); display: none; opacity: 0; transition: opacity 0.2s; pointer-events: none; }
.atracao-popover.visible { display: block; opacity: 1; }
.popover-bairro { font-size: 10px; text-transform: uppercase; color: var(--gold-dk); letter-spacing: 0.05em; margin-bottom: 4px; }
.popover-titulo { font-family: var(--ff-display); font-size: 18px; color: var(--crimson); margin-bottom: 8px; }
.popover-desc { font-size: 12px; color: var(--ink-mid); line-height: 1.5; margin-bottom: 12px; }
.popover-preco { font-size: 13px; font-weight: 500; color: var(--ink); border-top: 1px solid var(--border); padding-top: 8px; display: flex; justify-content: space-between; }
.preco-brt { color: var(--gold-dk); }
`;
fs.appendFileSync('public/css/style.css', css);
