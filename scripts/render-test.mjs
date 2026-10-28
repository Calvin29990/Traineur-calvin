// Headless render verification: every panel + drawer + modal is server-rendered
// with a real engine snapshot for both roles (IB-55 and AM-55).
// Usage: node scripts/render-test.mjs   (requires the app server on :8788)
import WebSocket from 'ws';
import { createServer } from 'vite';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const WS_URL = process.env.WS || 'ws://127.0.0.1:8788/ws';

async function grabState(startRole) {
  const ws = new WebSocket(WS_URL);
  let state = null;
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.type === 'state') state = m.data;
  });
  ws.send(JSON.stringify({ type: 'join', nickname: startRole === 'AM' ? 'AM Render' : 'IB Render' }));
  await wait(250);
  ws.send(JSON.stringify({ type: 'start', mode: 'replay', startRole, pace: 'standard', nickname: 'Calvin MINANG' }));
  for (let i = 0; i < 40 && !state?.equities?.length; i++) await wait(100);
  await wait(1200);
  ws.close();
  return state;
}

const ibState = await grabState('IB');
const amState = await grabState('AM');
if (!ibState || !amState) {
  console.error('✗ could not obtain engine state — is the server running on :8788 ?');
  process.exit(1);
}

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.window = {
  addEventListener: () => {}, removeEventListener: () => {},
  devicePixelRatio: 1, open: () => {}, confirm: () => true,
};
globalThis.document = { documentElement: {}, addEventListener: () => {}, removeEventListener: () => {} };

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const React = (await import('react')).default;
const { renderToString } = await import('react-dom/server');

const load = async (path) => vite.ssrLoadModule(path);
const mods = {
  TopBar: (await load('/src/components/TopBar.jsx')).default,
  Panels: await load('/src/components/Panels.jsx'),
  Chat: (await load('/src/components/ChatPanel.jsx')).default,
  Ticket: (await load('/src/components/QuoteTicket.jsx')).default,
  Exchange: (await load('/src/components/ExchangePanel.jsx')).default,
  Chart: (await load('/src/components/ChartPanel.jsx')).default,
  Drawers: await load('/src/components/Drawers.jsx'),
  Modals: await load('/src/components/Modals.jsx'),
  Gauge: await load('/src/components/Gauge.jsx'),
};

const noop = () => {};
const h = React.createElement;
const ibClient = ibState.contacts?.[0]?.id ?? null;
const amDealer = amState.contacts?.[0]?.id ?? null;
const debriefState = {
  ...ibState, phase: 'break',
  debrief: {
    open: true, round: 1, role: 'IB', nextRole: 'AM',
    stats: { pnl: 141570, commission: 34750, fills: 8, exchangeTrades: 12, quotes: 10, fatFingers: 0, staleSniped: 0 },
    scoreObj: { total: 88, gauges: [{ code: 'PnL', label: 'P&L', score: 90, weight: 25, detail: 'ok' }] },
    tips: [{ tone: 'good', text: 'ok' }],
  },
};
const finalState = {
  ...amState, phase: 'done',
  final: {
    pnl: 980000, score: 92, rank: 4, total: 260, topPct: 98.5, fatFingers: 0,
    rounds: [{ round: 1, role: 'IB', pnl: 400000, commission: 32000, clientFills: 12, maxWeight: 0, fatFingers: 0, scoreObj: { total: 93, gauges: [{ code: 'PnL', label: 'P&L', score: 93, weight: 25, detail: '' }] }, portfolioValue: 0 },
      { round: 2, role: 'AM', pnl: 580000, commission: 0, clientFills: 0, maxWeight: 18, fatFingers: 0, scoreObj: { total: 91, gauges: [{ code: 'ROI', label: 'ROI', score: 91, weight: 30, detail: '' }] }, portfolioValue: 20580000 }],
    tips: [{ tone: 'good', text: 'Top 1 %' }],
  },
};

const cases = [
  ['TopBar (IB)', h(mods.TopBar, { state: ibState, connected: true, audioMuted: false, audioVolume: 0.35, onDrawer: noop, onToggleMute: noop, onVolume: noop, onGuide: noop })],
  ['TopBar (AM)', h(mods.TopBar, { state: amState, connected: true, audioMuted: true, audioVolume: 0.2, onDrawer: noop, onToggleMute: noop, onVolume: noop, onGuide: noop })],
  ['EquitiesPanel', h(mods.Panels.EquitiesPanel, { state: ibState, send: noop, onSelectTicker: noop })],
  ['NewsPanel', h(mods.Panels.NewsPanel, { state: ibState, send: noop, onSelectTicker: noop })],
  ['PositionsPanel (IB)', h(mods.Panels.PositionsPanel, { state: ibState, send: noop, onSelectTicker: noop })],
  ['PositionsPanel (AM)', h(mods.Panels.PositionsPanel, { state: amState, send: noop, onSelectTicker: noop })],
  ['ChatPanel (IB)', h(mods.Chat, { state: ibState, send: noop, activeRoom: ibClient, onSelectRoom: noop, onPrefillQuote: noop, onReadRoom: noop, selectedTicker: 'BP' })],
  ['ChatPanel (AM)', h(mods.Chat, { state: amState, send: noop, activeRoom: amDealer, onSelectRoom: noop, onPrefillQuote: noop, onReadRoom: noop, selectedTicker: 'MSFT' })],
  ['QuoteTicket (IB)', h(mods.Ticket, { state: ibState, send: noop, clientId: ibClient, prefill: null, selectedTicker: 'BP', onSelectTicker: noop })],
  ['ExchangePanel (IB)', h(mods.Exchange, { state: ibState, send: noop, selectedTicker: 'BP', onSelectTicker: noop })],
  ['ExchangePanel (AM)', h(mods.Exchange, { state: amState, send: noop, selectedTicker: 'MSFT', onSelectTicker: noop })],
  ['ChartPanel', h(mods.Chart, { state: ibState, send: noop, onSelectTicker: noop })],
  ['GaugeGrid (IB)', h(mods.Gauge.GaugeGrid, { gauges: ibState.roleScore.gauges })],
  ['GaugeGrid (AM)', h(mods.Gauge.GaugeGrid, { gauges: amState.roleScore.gauges })],
  ['ScoreRing', h(mods.Gauge.ScoreRing, { score: 92, sub: 'Top 1 %' })],
  ['Leaderboard', h(mods.Drawers.LeaderboardDrawer, { state: ibState, onClose: noop })],
  ['Coach', h(mods.Drawers.CoachDrawer, { state: amState, onClose: noop, onGuide: noop })],
  ['Help', h(mods.Drawers.HelpDrawer, { state: ibState, onClose: noop, onGuide: noop, onRestart: noop })],
  ['Briefing', h(mods.Modals.Briefing, { state: { ...ibState, phase: 'briefing' }, onStart: noop, onGuide: noop })],
  ['Debrief', h(mods.Modals.Debrief, { state: debriefState, send: noop, onClose: noop, onGuide: noop })],
  ['Final', h(mods.Modals.Final, { state: finalState, onRestart: noop, onGuide: noop, onLeaderboard: noop })],
];

let bad = 0;
for (const [name, el] of cases) {
  try {
    const html = renderToString(el);
    if (!html || html.length < 60) throw new Error(`suspiciously small output (${html?.length})`);
    if (/undefined|NaN/.test(html)) {
      const snippet = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.warn(`⚠ ${name.padEnd(20)} ${String(html.length).padStart(6)} chars — contains undefined/NaN`);
      console.warn(`   ${snippet.slice(0, 220)}`);
    } else {
      console.log(`✓ ${name.padEnd(20)} ${String(html.length).padStart(6)} chars`);
    }
  } catch (e) {
    bad += 1;
    console.error(`✗ ${name}: ${e.message}`);
    console.error((e.stack || '').split('\n').slice(1, 5).join('\n'));
  }
}
await vite.close();
console.log(bad ? `\n✗ ${bad} render failure(s)` : '\n✓ all components rendered');
process.exit(bad ? 1 : 0);
