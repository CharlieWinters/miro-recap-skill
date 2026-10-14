// Screen-capture the real Miro Packs editing tools (previz shot, clip editor, framing) for the making-of video.
//
// Uses the miro-packs e2e approach without touching that repo: the app is built from the previz worktree into
// capture/dist, served next to a fake Worker (spec + media + uploads) and a capture board page (capture/board.html)
// with the e2e fake Miro SDK. Each tool is driven by a scripted cursor and recorded with CDP screencast.
//
//   node capture/capture.mjs [--skip-build] [shot|clip|framing ...]
// Output: capture/out/<tool>/frames/*.jpg + frames.json (timestamps) + markers.json (action times).
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { launch } from '../tools/browser.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PACKS_APP = path.join(process.env.HOME, 'platform-architect2026/miro-packs/.claude/worktrees/previz/app');
const { startServers } = await import(path.join(PACKS_APP, 'e2e/servers.mjs'));
const FAKE_SDK = fs.readFileSync(path.join(PACKS_APP, 'e2e/fakeMiro.js'), 'utf8');

const PORTS = { boardPort: 5293, appPort: 5294, workerPort: 5295 };
const APP_ORIGIN = `http://localhost:${PORTS.appPort}`;
const WORKER_ORIGIN = `http://127.0.0.1:${PORTS.workerPort}`;
const DIST = path.join(HERE, 'dist');
const OUT = path.join(HERE, 'out');
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('--'));
const want = (t) => only.length === 0 || only.includes(t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The embed keeps its real layout size and is magnified S× on the capture page, so the UI renders sharp at S× pixels.
const S = 1.5;

function run(cmd, argv, opts) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('close', (code) => (code === 0 ? ok(out) : fail(new Error(`${cmd} exited ${code}\n${out.slice(-3000)}`))));
  });
}

// --- build (into capture/dist, never the repo's app/dist) ---------------------------------------------------------
if (!args.includes('--skip-build') || !fs.existsSync(path.join(DIST, 'index.html'))) {
  const t = Date.now();
  await run(process.execPath, [path.join(PACKS_APP, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', DIST, '--emptyOutDir', '--logLevel', 'warn'], {
    cwd: PACKS_APP,
    env: {
      ...process.env,
      VITE_BASE: '/',
      VITE_TOOLS_SERVER: WORKER_ORIGIN,
      VITE_NODE_PAGE_URL: `${APP_ORIGIN}/packs/fal/tools/generate/embed/index.html`,
      VITE_NODE_PAGE_ORIGIN: APP_ORIGIN,
      VITE_APP_ORIGINS: APP_ORIGIN,
    },
  });
  console.log(`built in ${((Date.now() - t) / 1000).toFixed(1)} s`);
}

// --- fake Worker: the real S1 spec, local media, uploads ------------------------------------------------------------
const spec = JSON.parse(fs.readFileSync(path.join(HERE, 'media/s1_spec.json'), 'utf8'));
spec.duration = 6; // the user's approved edit on S1_HERO
const specJson = JSON.stringify(spec);
const sha = createHash('sha256').update(specJson).digest('hex');
const shotNid = randomUUID();
const uploads = new Map();
let seq = 0;
const MEDIA_TYPES = { '.webm': 'video/webm', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png' };
const workerRoutes = (req, res, cors) => {
  const p = req.url.split('?')[0];
  if (req.method === 'GET' && p === `/s/${shotNid}/${sha}.json`) {
    res.writeHead(200, { ...cors, 'content-type': 'application/json' }).end(specJson);
    return true;
  }
  if (req.method === 'GET' && p.startsWith('/media/')) {
    const file = path.join(HERE, 'media', path.basename(p));
    if (!fs.existsSync(file)) return false;
    const body = fs.readFileSync(file);
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
    const type = MEDIA_TYPES[path.extname(file)] || 'application/octet-stream';
    if (range) {
      const a = +range[1], b = range[2] ? +range[2] : body.length - 1;
      res.writeHead(206, { ...cors, 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${a}-${b}/${body.length}`, 'content-length': b - a + 1 }).end(body.subarray(a, b + 1));
    } else {
      res.writeHead(200, { ...cors, 'content-type': type, 'accept-ranges': 'bytes', 'content-length': body.length }).end(body);
    }
    return true;
  }
  if (req.method === 'POST' && p === '/media-upload') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const up = `/m/capture/${++seq}`;
      uploads.set(up, { type: String(req.headers['content-type'] || ''), body: Buffer.concat(chunks) });
      res.writeHead(200, { ...cors, 'content-type': 'application/json' }).end(JSON.stringify({ url: `${WORKER_ORIGIN}${up}` }));
    });
    return true;
  }
  if (req.method === 'GET' && uploads.has(p)) {
    const m = uploads.get(p);
    res.writeHead(200, { ...cors, 'content-type': m.type }).end(m.body);
    return true;
  }
  return false;
};

const servers = await startServers({ dist: DIST, boardHtml: path.join(HERE, 'board.html'), ...PORTS, workerRoutes });
const browser = await launch();

// --- one tool, one board page, one recording -------------------------------------------------------------------------
async function session(tool, { width, height, item, page: embedPath }, script) {
  const dir = path.join(OUT, tool);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'frames'), { recursive: true });

  const context = await browser.newContext({ viewport: { width: Math.round(width * S), height: Math.round(height * S) }, deviceScaleFactor: 1 });
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('https://miro.com/app/static/sdk/v2/miro.js')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_SDK });
    const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
    // The tools only accept https media: serve capture/media/* under a fake https host.
    if (host === 'media.capture.test') {
      const file = path.join(HERE, 'media', path.basename(new URL(url).pathname));
      return route.fulfill({ status: 200, path: file, headers: { 'access-control-allow-origin': '*', 'content-type': MEDIA_TYPES[path.extname(file)] || 'application/octet-stream' } });
    }
    // Local servers, plus fal storage for the car GLB in the spec. Nothing else leaves the machine.
    if (['localhost', '127.0.0.1', '[::1]'].includes(host) || host.endsWith('fal.media') || !/^https?:/.test(url)) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  const log = [];
  page.on('console', (m) => log.push(`[${m.type()}] ${m.text()}`.slice(0, 400)));
  page.on('pageerror', (e) => log.push(`[pageerror] ${e.message}`));
  await page.goto(`http://127.0.0.1:${PORTS.boardPort}/?app=${encodeURIComponent(APP_ORIGIN)}`);
  await page.evaluate(() => window.e2e.addStore());
  const label = await page.evaluate(() => window.e2e.addBridge());
  for (let i = 0; i < 100 && !(await page.frame({ name: `bridge-${label}` })?.evaluate(() => window.mpDebug?.bridgeId).catch(() => null)); i++) await sleep(100);

  const nid = item.nid || randomUUID();
  const url = new URL(APP_ORIGIN + embedPath);
  url.searchParams.set('nid', nid);
  url.searchParams.set('cb', 'capture');
  await page.frame({ name: 'store' }).evaluate((it) => {
    const b = { items: [it], next: 1000 };
    localStorage.setItem('e2e:board', JSON.stringify(b));
  }, { id: '3458764000077770001', type: 'embed', url: url.toString(), x: 0, y: 0, width, height, meta: item.meta });
  await page.evaluate((u) => window.e2e.addEmbed('tool', u), url.toString());
  await page.evaluate(({ w, h, s }) => {
    const f = document.querySelector('iframe[name="embed-tool"]');
    Object.assign(f.style, { width: `${w}px`, height: `${h}px`, transform: `scale(${s})`, transformOrigin: '0 0' });
  }, { w: width, h: height, s: S });
  const frame = () => page.frame({ name: 'embed-tool' });
  for (let i = 0; i < 100 && !frame(); i++) await sleep(100);

  // CDP screencast: every painted frame, with its timestamp.
  const cdp = await context.newCDPSession(page);
  const frames = [];
  let recording = false;
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    if (recording) {
      const f = `${String(frames.length + 1).padStart(5, '0')}.jpg`;
      fs.writeFileSync(path.join(dir, 'frames', f), Buffer.from(data, 'base64'));
      frames.push({ f, t: metadata.timestamp });
    }
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });

  // Scripted cursor: moves in real time, shown by the board page's overlay; clicks pulse a ring.
  let pos = { x: width * S * 0.6, y: height * S * 0.75 };
  const markers = [];
  const mark = (name) => markers.push({ name, t: Date.now() / 1000 });
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
  const ui = {
    page, frame, mark, log,
    async move(x, y, ms = 450, held = false) {
      const from = { ...pos };
      const steps = Math.max(2, Math.round(ms / 16));
      for (let i = 1; i <= steps; i++) {
        const k = ease(i / steps);
        const p = { x: from.x + (x - from.x) * k, y: from.y + (y - from.y) * k };
        await page.mouse.move(p.x, p.y);
        await page.evaluate(({ x, y }) => window.cursor.at(x, y), p);
        await sleep(ms / steps);
      }
      pos = { x, y };
      if (!held) await sleep(60);
    },
    async click(x, y, ms) {
      await ui.move(x, y, ms);
      await page.evaluate(({ x, y }) => window.cursor.pulse(x, y), { x, y });
      await page.mouse.down();
      await sleep(70);
      await page.mouse.up();
      await sleep(180);
    },
    async drag(x0, y0, x1, y1, ms = 800) {
      await ui.move(x0, y0);
      await page.evaluate(({ x, y }) => window.cursor.pulse(x, y), { x: x0, y: y0 });
      await page.mouse.down();
      await sleep(90);
      await ui.move(x1, y1, ms, true);
      await sleep(90);
      await page.mouse.up();
      await sleep(200);
    },
    /** Centre of an element inside the embed (the embed fills the viewport, so frame coords = page coords). */
    async at(selector) {
      const raw = await frame().locator(selector).first().boundingBox();
      if (!raw) throw new Error(`no box for ${selector}`);
      // Playwright reports boxes inside the iframe without its CSS scale; the iframe sits at 0,0, so scale by S.
      const b = { x: raw.x * S, y: raw.y * S, width: raw.width * S, height: raw.height * S };
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
    },
    async waitFor(fn, timeoutMs = 60000, what = 'condition') {
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) {
        if (await frame().evaluate(fn).catch(() => false)) return;
        await sleep(150);
      }
      throw new Error(`timed out: ${what}`);
    },
  };
  await page.evaluate(({ x, y }) => window.cursor.at(x, y), pos);

  try {
    await script(ui, async () => {
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
      recording = true;
      mark('rec');
    });
  } catch (e) {
    console.error(`${tool}: FAILED: ${e.message}`);
    await page.screenshot({ path: path.join(dir, 'failed.png') });
    process.exitCode = 1;
  } finally {
    recording = false;
    await cdp.send('Page.stopScreencast').catch(() => {});
    fs.writeFileSync(path.join(dir, 'frames.json'), JSON.stringify(frames));
    fs.writeFileSync(path.join(dir, 'markers.json'), JSON.stringify(markers));
    fs.writeFileSync(path.join(dir, 'page.log'), log.join('\n'));
    console.log(`${tool}: ${frames.length} frames, markers ${markers.map((m) => m.name).join(' ')}`);
    await context.close();
  }
}

// --- 1. previz shot: Edit → pilot the start camera, widen the lens → End → Save → Play → Render → Approve -------------
if (want('shot')) {
  const record = { v: 1, name: spec.name, spec: { url: `${WORKER_ORIGIN}/s/${shotNid}/${sha}.json`, sha, bytes: Buffer.byteLength(specJson) }, edits: null, updatedAt: new Date().toISOString() };
  await session('shot', { width: 1024, height: 640, page: '/packs/previz/tools/shot/embed/index.html', item: { nid: shotNid, meta: { 'mp-previz-shot': record } } }, async (ui, start) => {
    await ui.waitFor(() => !document.getElementById('ui').hidden && !document.getElementById('status').textContent, 120000, 'stage');
    await sleep(1500); // let the GLB and first frame settle
    await start();
    await sleep(600);
    const e = await ui.at('#edit');
    await ui.click(e.x, e.y, 700);
    ui.mark('edit');
    await ui.waitFor(() => (document.getElementById('editor')?.getBoundingClientRect().width || 0) > 0, 10000, 'editor');
    await sleep(350);
    const s = await ui.at('#editor [data-mode="start"]');
    await ui.click(s.x, s.y);
    ui.mark('start');
    // Orbit the start camera: drag across the stage.
    const v = await ui.at('#view');
    await ui.drag(v.x - 40 * S, v.y + 60 * S, v.x - 85 * S, v.y + 60 * S, 900);
    ui.mark('orbit');
    // Widen the lens slider from 28 toward 35 mm.
    const lens = await ui.at('#ed-lens');
    const vAt = (mm) => lens.b.x + ((mm - 12) / (85 - 12)) * lens.b.width;
    await ui.drag(vAt(28), lens.y, vAt(36), lens.y, 700);
    ui.mark('lens');
    const en = await ui.at('#editor [data-mode="end"]');
    await ui.click(en.x, en.y);
    await ui.drag(v.x + 40 * S, v.y + 60 * S, v.x + 75 * S, v.y + 60 * S, 800);
    ui.mark('end');
    const sv = await ui.at('#ed-save');
    await ui.click(sv.x, sv.y);
    await ui.waitFor(() => /saved on the board/.test(document.getElementById('ed-msg').textContent), 15000, 'save');
    ui.mark('saved');
    await sleep(500);
    const pl = await ui.at('#play');
    await ui.click(pl.x, pl.y);
    ui.mark('play');
    await sleep(3200);
    const r = await ui.at('#render');
    await ui.click(r.x, r.y);
    ui.mark('render');
    await ui.waitFor(() => /^Rendered/.test(document.getElementById('ed-msg').textContent), 300000, 'render');
    ui.mark('rendered');
    await sleep(500);
    const a = await ui.at('#approve');
    await ui.click(a.x, a.y);
    await ui.waitFor(() => document.getElementById('state').textContent === 'Approved', 15000, 'approve');
    ui.mark('approved');
    await sleep(1400);
  });
}

// --- 2. clip editor: drag In and Out, set 1.5x, play ------------------------------------------------------------------
if (want('clip')) {
  const rec = { v: 1, src: "https://media.capture.test/s1v.webm", duration: 6.592, in: 0, out: 6.592, speed: 1, updatedAt: new Date().toISOString() };
  await session('clip', { width: 900, height: 620, page: '/packs/movie/tools/clip/embed/index.html', item: { meta: { 'mp-clip': rec } } }, async (ui, start) => {
    await ui.waitFor(() => !!document.querySelector('.handle') && document.querySelector('video')?.readyState >= 2, 60000, 'clip ui');
    await sleep(800);
    await start();
    await sleep(500);
    const hIn = await ui.at('.handle >> nth=0');
    await ui.drag(hIn.x, hIn.y, hIn.x + 150 * S, hIn.y, 900);
    ui.mark('in');
    const hOut = await ui.at('.handle >> nth=1');
    await ui.drag(hOut.x, hOut.y, hOut.x - 120 * S, hOut.y, 800);
    ui.mark('out');
    const sp = await ui.at('button[data-speed="1.5"]');
    await ui.click(sp.x, sp.y, 600);
    ui.mark('speed');
    const pl = await ui.at('button.primary');
    await ui.click(pl.x, pl.y, 600);
    ui.mark('play');
    await sleep(2600);
  });
}

// --- 3. framing: Push in preset, nudge B, preview ----------------------------------------------------------------------
if (want('framing')) {
  const full = { x: 0, y: 0, w: 1, h: 1 };
  const rec = { v: 1, src: "https://media.capture.test/key_a.jpg", aspect: '16:9', imageAspect: 16 / 9, start: full, end: full, move: '', updatedAt: new Date().toISOString() };
  await session('framing', { width: 1000, height: 760, page: '/packs/movie/tools/framing/embed/index.html', item: { meta: { 'mp-framing': rec } } }, async (ui, start) => {
    await ui.waitFor(() => document.querySelector('img.src')?.complete && document.querySelector('img.src').naturalWidth > 0, 60000, 'framing ui');
    await sleep(800);
    await start();
    await sleep(500);
    const push = await ui.at('button:has-text("Push in")');
    await ui.click(push.x, push.y, 800);
    ui.mark('push');
    await sleep(500);
    const b = await ui.at('.rect.b');
    await ui.drag(b.x, b.y, b.x + 70 * S, b.y + 25 * S, 900);
    ui.mark('dragB');
    const prev = await ui.at('button:has-text("Preview")');
    await ui.click(prev.x, prev.y, 700);
    ui.mark('preview');
    await sleep(3000);
  });
}

await browser.close();
await servers.close();
