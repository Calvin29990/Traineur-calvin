// Rendu SSR de tous les composants avec un état réel du moteur : détecte les
// erreurs d'exécution et vérifie la structure HTML produite.
import WebSocket from 'ws';
import fs from 'fs';
import { createServer } from 'vite';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// --- 1. récupère un état complet depuis le serveur
const ws = new WebSocket(process.env.WS || 'ws://127.0.0.1:8788/ws');
let state = null;
await new Promise((res) => ws.on('open', res));
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.type === 'state') state = m.data;
});
ws.send(JSON.stringify({ type: 'join', nickname: 'SSR' }));
await wait(300);
ws.send(JSON.stringify({ type: 'start', rounds: 3, nickname: 'Calvin' }));
await wait(600);
ws.send(JSON.stringify({ type: 'speed', value: 4 }));
// attend une demande client + quelques exécutions
for (let i = 0; i < 120 && !(state?.rfq && state.blotter.length > 1); i++) await wait(250);
ws.close();
fs.writeFileSync('/tmp/state.json', JSON.stringify(state, null, 2));
console.log('état capturé :', state?.phase, '| rfq', state?.rfq?.ticker, '| blotter', state?.blotter?.length, '| news', state?.news?.length);

// --- 2. rend les composants
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.window = { addEventListener: () => {}, removeEventListener: () => {}, devicePixelRatio: 1 };
globalThis.document = { documentElement: {}, addEventListener: () => {}, removeEventListener: () => {} };

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const React = (await import('react')).default;
const { renderToString } = await import('react-dom/server');

const mods = {
  TopBar: (await vite.ssrLoadModule('/src/components/TopBar.jsx')).default,
  Panels: await vite.ssrLoadModule('/src/components/Panels.jsx'),
  RfqPanel: (await vite.ssrLoadModule('/src/components/RfqPanel.jsx')).default,
  ChartPanel: await vite.ssrLoadModule('/src/components/ChartPanel.jsx'),
  Drawers: await vite.ssrLoadModule('/src/components/Drawers.jsx'),
  Modals: await vite.ssrLoadModule('/src/components/Modals.jsx'),
};

const noop = () => {};
const cases = [];
const S = state;
cases.push(['TopBar', React.createElement(mods.TopBar, { state: S, send: noop, drawer: null, onDrawer: noop, connected: true })]);
cases.push(['EquitiesPanel', React.createElement(mods.Panels.EquitiesPanel, { state: S, send: noop })]);
cases.push(['NewsPanel', React.createElement(mods.Panels.NewsPanel, { state: S })]);
cases.push(['PositionsPanel', React.createElement(mods.Panels.PositionsPanel, { state: S, send: noop })]);
cases.push(['ChatPanel', React.createElement(mods.Panels.ChatPanel, { state: S, send: noop })]);
cases.push(['RfqPanel', React.createElement(mods.RfqPanel, { state: S, send: noop })]);
cases.push(['ChartPanel', React.createElement(mods.ChartPanel.default, { state: S })]);
cases.push(['ExchangePanel', React.createElement(mods.ChartPanel.ExchangePanel, { state: S, send: noop })]);
cases.push(['Leaderboard', React.createElement(mods.Drawers.LeaderboardDrawer, { state: S, onClose: noop })]);
cases.push(['Coach', React.createElement(mods.Drawers.CoachDrawer, { state: S, onClose: noop })]);
cases.push(['Help', React.createElement(mods.Drawers.HelpDrawer, { state: S, onClose: noop, onRestart: noop })]);
cases.push(['Briefing', React.createElement(mods.Modals.Briefing, { state: { ...S, phase: 'briefing' }, send: noop, connected: true })]);
cases.push(['Debrief', React.createElement(mods.Modals.Debrief, { state: { ...S, phase: 'break', debrief: { open: true, round: 1, stats: { pnl: 1234, total: 4321, fills: 5, exchangeTrades: 3, capture: 2000, adverse: -500, quotes: 8 }, clients: [], tips: [{ tone: 'info', text: 'test' }] } }, send: noop, onClose: noop })]);
cases.push(['Final', React.createElement(mods.Modals.Final, { state: { ...S, phase: 'done', round: 3, final: { pnl: 92000, rank: 12, total: 261, topPct: 95, capture: 120000, adverse: -20000, fees: 8000, quotes: 40, hitRate: 0.55, trades: 22, tips: [{ tone: 'good', text: 'gagné' }] } }, send: noop, onRestart: noop, onLeaderboard: noop })]);

let bad = 0;
for (const [name, el] of cases) {
  try {
    const html = renderToString(el);
    const keys = ['EQUITIES', 'Demande client', 'POSITIONS', 'Chat', 'Classement', 'Coach'].filter((k) => html.includes(k));
    console.log(`✓ ${name.padEnd(16)} ${String(html.length).padStart(6)} car. ${keys.length ? '[' + keys.join(',') + ']' : ''}`);
  } catch (e) {
    bad++;
    console.log(`✗ ${name}: ${e.message}\n${(e.stack || '').split('\n').slice(0, 6).join('\n')}`);
  }
}
await vite.close();
process.exit(bad ? 1 : 0);
