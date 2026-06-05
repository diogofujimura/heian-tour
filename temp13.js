const fs = require('fs');

let css = fs.readFileSync('public/css/style.css', 'utf8');

// Modificar Variáveis :root e Background
css = css.replace(
  `html, body { height: 100%; font-family: var(--ff-body); background: var(--cream); color: var(--ink); font-size: 14px; line-height: 1.6; }`,
  `html, body { 
  height: 100%; 
  font-family: var(--ff-body); 
  background: linear-gradient(135deg, #F8F5F0 0%, #EAE2D6 100%); 
  color: var(--ink); 
  font-size: 14px; 
  line-height: 1.6; 
  overflow: hidden; /* For 3-pane layout */
}`
);

// Modificar Sidebar
css = css.replace(
  `.sidebar { position: fixed; top: 0; left: 0; width: var(--sidebar-w); height: 100vh; background: var(--crimson); display: flex; flex-direction: column; padding: 0 0 24px; z-index: 100; }`,
  `.sidebar { position: fixed; top: 0; left: 0; width: var(--sidebar-w); height: 100vh; background: linear-gradient(180deg, #5C1D24 0%, #3D0F16 100%); display: flex; flex-direction: column; padding: 0 0 24px; z-index: 100; box-shadow: 4px 0 20px rgba(0,0,0,0.15); }`
);

// Modificar .main
css = css.replace(
  `.main { margin-left: var(--sidebar-w); min-height: 100vh; padding: 0 40px 80px; max-width: 1100px; }`,
  `.main { margin-left: var(--sidebar-w); height: 100vh; display: flex; flex-direction: column; } /* Old .main now acts as flex container for non-3pane pages */`
);

// Modificar .page
css = css.replace(
  `.page { display: none; }
.page.active { display: block; }`,
  `.page { display: none; height: 100%; flex-direction: column; }
.page.active { display: flex; }`
);

// Adicionar as novas classes de Layout 3-Pane ao final do arquivo
const newLayoutCSS = `

/* ── 3-PANE LAYOUT (MODERN) ────────────────────────────────────────────── */
.pane-layout {
  display: flex;
  flex: 1;
  height: 100vh;
  overflow: hidden;
  background: transparent;
}

.pane-list {
  width: 380px;
  min-width: 380px;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-right: 1px solid rgba(255, 255, 255, 0.5);
  display: flex;
  flex-direction: column;
  height: 100%;
  box-shadow: 2px 0 15px rgba(107, 31, 42, 0.03);
  z-index: 10;
}

.pane-list-header {
  padding: 24px 20px 16px;
  border-bottom: 1px solid rgba(200, 180, 160, 0.2);
}

.pane-list-header h2 {
  font-family: var(--ff-display);
  font-size: 24px;
  color: var(--crimson);
  margin-bottom: 12px;
}

.pane-list-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pane-list-content::-webkit-scrollbar {
  width: 6px;
}
.pane-list-content::-webkit-scrollbar-thumb {
  background: rgba(107,31,42,0.15);
  border-radius: 10px;
}

.pane-content {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  padding: 30px;
  background: transparent;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.pane-content-inner {
  width: 100%;
  max-width: 1000px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 20px;
  box-shadow: 0 12px 40px rgba(107, 31, 42, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.8);
  padding: 40px;
  min-height: 90vh;
  margin-bottom: 40px;
}

/* ── MODERN LIST CARDS ─────────────────────────────────────────────────── */
.list-card {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 14px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  position: relative;
  overflow: hidden;
}

.list-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; width: 4px; height: 100%;
  background: var(--gold-lt);
  opacity: 0;
  transition: opacity 0.2s;
}

.list-card:hover {
  background: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(107, 31, 42, 0.08);
}

.list-card.selected {
  background: linear-gradient(135deg, #ffffff 0%, #FFFDF8 100%);
  border-color: var(--gold-lt);
  box-shadow: 0 8px 24px rgba(196, 163, 90, 0.15);
}

.list-card.selected::before {
  opacity: 1;
}

.list-card-title {
  font-family: var(--ff-body);
  font-size: 15px;
  font-weight: 600;
  color: var(--crimson);
  margin-bottom: 4px;
}

.list-card-subtitle {
  font-size: 12px;
  color: var(--ink-lt);
  display: flex;
  align-items: center;
  gap: 6px;
}

.list-card-meta {
  font-size: 11px;
  color: var(--gold-dk);
  font-weight: 500;
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
}

.search-input-modern {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(107,31,42,0.15);
  background: rgba(255,255,255,0.8);
  font-family: var(--ff-body);
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
}
.search-input-modern:focus {
  background: #fff;
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(196,163,90,0.1);
}

/* Esconder .page-header padrao dentro das abas 3-pane se usarem .pane-layout */
.pane-layout .page-header { display: none; }
`;

if (!css.includes('.pane-layout')) {
  css += newLayoutCSS;
}

fs.writeFileSync('public/css/style.css', css);
console.log("CSS refatorado com sucesso.");
