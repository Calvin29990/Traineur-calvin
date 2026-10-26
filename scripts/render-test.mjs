// SSR render verification across all components in both IB 1 and AM 1 roles
import WebSocket from 'ws';
import { createServer } from 'vite';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ws = new WebSocket(process.env.WS || 'ws://127.0.0.1:8788/ws');
let state = null;
await new Promise((res) => ws.on('open', res));
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.type === 'state') state = m.data;
});
ws.send(JSON.stringify({ type: 'join', nickname: 'SSR' }));
await wait(250);
ws.send(JSON.stringify({ type: 'start', mode: 'challenge', rounds: 2, roundSeconds: 120, nickname: 'calvin' }));
ws.send(JSON.stringify({ type: 'speed', value: 4 }));
for (let i = 0; i < 30 && !(state?.clientRequests?.length > 0); i++) await wait(200);
ws.close();

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
const S = state;
const S_AM = { ...state, role: 'AM', roleBadge: 'AM 1' };

const cases = [
  ['TopBar (IB)', React.createElement(mods.TopBar, { state: S, send: noop, drawer: null, onDrawer: noop, connected: true })],
  ['TopBar (AM)', React.createElement(mods.TopBar, { state: S_AM, send: noop, drawer: null, onDrawer: noop, connected: true })],
  ['EquitiesPanel', React.createElement(mods.Panels.EquitiesPanel, { state: S, send: noop })],
  ['NewsPanel', React.createElement(mods.Panels.NewsPanel, { state: S, send: noop })],
  ['PositionsPanel', React.createElement(mods.Panels.PositionsPanel, { state: S, send: noop })],
  ['ChatPanel', React.createElement(mods.Panels.ChatPanel, { state: S, send: noop, activeRoom: 'hf1test1' })],
  ['RfqPanel (IB)', React.createElement(mods.RfqPanel, { state: S, send: noop, activeRoom: 'hf1test1', selectedTicker: 'BP' })],
  ['RfqPanel (AM)', React.createElement(mods.RfqPanel, { state: S_AM, send: noop, activeRoom: 'ib1test1', selectedTicker: 'BP' })],
  ['ExchangePanel', React.createElement(mods.ChartPanel.ExchangePanel, { state: S, send: noop, selectedTicker: 'BP' })],
  ['ChartPanel', React.createElement(mods.ChartPanel.default, { state: S, send: noop })],
  ['Leaderboard', React.createElement(mods.Drawers.LeaderboardDrawer, { state: S, onClose: noop })],
  ['Coach', React.createElement(mods.Drawers.CoachDrawer, { state: S, send: noop, onClose: noop })],
  ['Help', React.createElement(mods.Drawers.HelpDrawer, { state: S, onClose: noop, onRestart: noop })],
  ['Briefing', React.createElement(mods.Modals.Briefing, { state: { ...S, phase: 'briefing' }, send: noop, connected: true })],
  ['Debrief', React.createElement(mods.Modals.Debrief, { state: { ...S, phase: 'break', debrief: { open: true, round: 1, role: 'IB', nextRole: 'AM', stats: { pnl: 141570, commission: 34750, fills: 8, exchangeTrades: 12, quotes: 10, fatFingers: 0, staleSniped: 0 }, scoreObj: { total: 88, breakdown: [{ label: 'P&L', score: 90, weight: '40%' }] }, tips: [{ tone: 'good', text: 'ok' }] } }, send: noop, onClose: noop })],
  ['Final', React.createElement(mods.Modals.Final, { state: { ...S, phase: 'done', round: 2, final: { pnl: 980000, score: 89, rank: 8, total: 260, topPct: 97, fatFingers: 0, quotes: 14, trades: 26, rounds: [], tips: [{ tone: 'good', text: 'Top 10%' }] } }, send: noop, onRestart: noop, onLeaderboard: noop })],
];

let bad = 0;
for (const [name, el] of cases) {
  try {
    const html = renderToString(el);
    console.log(`✓ ${name.padEnd(18)} ${String(html.length).padStart(6)} chars`);
  } catch (e) {
    bad++;
    console.error(`✗ ${name}: ${e.message}\n${(e.stack || '').split('\n').slice(0, 6).join('\n')}`);
  }
}
await vite.close();
process.exit(bad ? 1 : 0);
