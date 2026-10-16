// A small load test of the test copy: many players at once making players, reading Ranks, playing
// Baba Ayo and pairing up in Quick match, all playing real games to the end. It reports how fast the
// server answered and anything that failed. Kept small on purpose so it uses a sliver of the free
// plan's daily limits (each player costs about 30 requests).
//
// Run in the VS Code terminal:   node scripts/loadtest.mjs            (30 players, the test copy)
//                                node scripts/loadtest.mjs 50         (up to 50 players)
//                                node scripts/loadtest.mjs 20 http://localhost:5173
// It never runs against the real game unless you add --real, and you shouldn't.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = Math.min(50, Math.max(4, Number(args[0] ?? 30) || 30));
const BASE = (args[1] ?? 'https://daraxando-staging.yves-workers.workers.dev').replace(/\/$/, '');
if (/daraxando\.yveskwameh\.com/.test(BASE) && !process.argv.includes('--real')) {
  console.error('This is the real game. The load test only runs on the test copy.');
  process.exit(1);
}
const WS = BASE.replace(/^http/, 'ws');
const TERMS = /TERMS_VERSION = '([^']+)'/.exec(readFileSync(new URL('../shared/legal.ts', import.meta.url), 'utf8'))?.[1];
const LIMIT_MS = 4 * 60_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- what we measure ---------- */
const times = {};
const problems = [];
let requests = 0;
const note = (what, ms) => (times[what] ??= []).push(ms);
const problem = (what) => { problems.push(what); };

async function call(path, { token, method = 'GET', body, device } = {}) {
  const t = performance.now();
  requests++;
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(device ? { 'x-device': device } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    note(`${method} ${path.replace(/\?.*/, '')}`, performance.now() - t);
    if (!res.ok) problem(`${method} ${path} answered ${res.status}: ${text.slice(0, 100)}`);
    try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
  } catch (err) {
    problem(`${method} ${path} failed: ${err.message}`);
    return { status: 0, data: null };
  }
}

/** Plays one match to the end on its socket: random free squares, Next game between games. */
function play(token, matchId, label) {
  return new Promise((resolve) => {
    requests++;
    const opened = performance.now();
    const ws = new WebSocket(`${WS}/api/match/${matchId}?token=${encodeURIComponent(token)}`);
    let view = null;
    let sentAt = 0;
    let sentLen = -1;
    let nexted = 0;
    let done = false;
    const finish = (ok, why) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (!ok) problem(`${label}: ${why}`);
      try { ws.close(); } catch {}
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false, 'the match did not finish in time'), LIMIT_MS);
    ws.onopen = () => note('match socket opens', performance.now() - opened);
    ws.onerror = () => finish(false, 'match socket error');
    ws.onclose = (e) => { if (!done) finish(false, `match socket closed (${e.code})`); };
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      const m = JSON.parse(e.data);
      if (m.t === 'error') problem(`${label}: ${m.code} ${m.message}`);
      if (m.t === 'reward') return finish(true);
      if (m.t !== 'state') return;
      view = m.s;
      const filled = view.board.filter(Boolean).length;
      if (sentAt && filled !== sentLen) { note('a move, answered', performance.now() - sentAt); sentAt = 0; }
      if (view.phase === 'between' && nexted < view.game) { nexted = view.game; ws.send(JSON.stringify({ t: 'next' })); requests++; return; }
      const me = view.you === null ? null : view.seats[view.you];
      if (view.phase !== 'playing' || !me || view.turn !== me.mark || sentAt) return;
      const free = view.board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
      if (!free.length) return;
      sentLen = filled;
      sentAt = performance.now();
      ws.send(JSON.stringify({ t: 'move', i: free[Math.floor(Math.random() * free.length)] }));
      requests++;
    };
  });
}

/** Quick match: waits in the lobby until paired, then plays. */
function quick(p) {
  return new Promise((resolve) => {
    requests++;
    const start = performance.now();
    const ws = new WebSocket(`${WS}/api/lobby?token=${encodeURIComponent(p.token)}&mode=pro&stake=0`);
    const tick = setInterval(() => { try { ws.send(JSON.stringify({ t: 'tick' })); requests++; } catch {} }, 4000);
    const stop = (id) => { clearInterval(tick); clearTimeout(t); try { ws.close(); } catch {} resolve(id); };
    const t = setTimeout(() => { problem(`${p.name}: no Quick match partner in 60 s`); stop(null); }, 60_000);
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      const m = JSON.parse(e.data);
      if (m.t === 'matched') { note('Quick match: paired', performance.now() - start); stop(m.matchId); }
      if (m.t === 'error') { problem(`${p.name}: lobby ${m.code}`); stop(null); }
    };
    ws.onerror = () => { problem(`${p.name}: lobby socket error`); stop(null); };
  });
}

/* ---------- the run ---------- */
const pct = (list, q) => { const s = [...list].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
console.log(`Load test: ${N} players against ${BASE}`);
if (!TERMS) { console.error('Could not read TERMS_VERSION from shared/legal.ts'); process.exit(1); }

const started = performance.now();
// Make the players, 5 every 6 seconds: the server allows 60 new players a minute from one network.
const players = [];
for (let i = 0; i < N; i += 5) {
  if (i) await sleep(6000);
  const batch = await Promise.all(Array.from({ length: Math.min(5, N - i) }, async (_, k) => {
    const n = i + k;
    const name = `Load ${String(n + 1).padStart(2, '0')}`;
    const r = await call('/api/session', { method: 'POST', device: randomUUID(), body: { name, avatar: 'hen', state: n % 2 ? 'LA' : 'RI', age: true, terms: TERMS } });
    return r.data?.token ? { name, token: r.data.token, id: r.data.profile.id } : null;
  }));
  players.push(...batch.filter(Boolean));
}
console.log(`  ${players.length} players made`);

// Everyone reads a few things, the way Home and Ranks do.
await Promise.all(players.map(async (p) => {
  await call('/api/me', { token: p.token });
  await call('/api/leaderboard', { token: p.token });
  await call('/api/where');
}));

// A third play Baba Ayo on the biggest board (his hardest thinking); the rest pair up in Quick match.
const botters = players.filter((_, i) => i % 3 === 0);
const quickers = players.filter((_, i) => i % 3 !== 0);
// Quick match needs pairs: an odd one out plays Baba Ayo instead.
if (quickers.length % 2) botters.push(quickers.pop());
let botDone = 0;
let quickDone = 0;
await Promise.all([
  ...botters.map(async (p) => {
    const r = await call('/api/bot', { method: 'POST', token: p.token, body: { mode: 'pro', level: 'agba' } });
    if (r.data?.matchId && (await play(p.token, r.data.matchId, `${p.name} vs Baba Ayo`))) botDone++;
  }),
  ...quickers.map(async (p) => {
    const id = await quick(p);
    if (id && (await play(p.token, id, `${p.name} Quick match`))) quickDone++;
  }),
]);

// Ranks again, as players check it after a match.
await Promise.all(players.slice(0, 10).map((p) => call('/api/leaderboard', { token: p.token })));

const secs = ((performance.now() - started) / 1000).toFixed(0);
console.log(`\nDone in ${secs} s, about ${requests} requests and socket messages.`);
console.log(`  Baba Ayo games finished: ${botDone} of ${botters.length}`);
console.log(`  Quick match players who finished a match: ${quickDone} of ${quickers.length}`);
console.log('\nHow fast the server answered (milliseconds):');
console.log('  what                        count   typical   slow (95%)   slowest');
for (const [what, list] of Object.entries(times)) {
  console.log(`  ${what.padEnd(28)}${String(list.length).padStart(5)}${String(Math.round(pct(list, 0.5))).padStart(10)}${String(Math.round(pct(list, 0.95))).padStart(13)}${String(Math.round(Math.max(...list))).padStart(10)}`);
}
if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  const counts = new Map();
  for (const p of problems) counts.set(p.replace(/Load \d+/, 'Load NN'), (counts.get(p.replace(/Load \d+/, 'Load NN')) ?? 0) + 1);
  for (const [p, n] of counts) console.log(`  ${n} × ${p}`);
} else console.log('\nNo problems.');
console.log('\nSend this whole output to Claude.');
process.exit(problems.length ? 1 : 0);
