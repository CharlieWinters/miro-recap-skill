// Capture index.html frame by frame.
//   node tools/render.mjs --stills 2,12,30      → out/still_<t>.jpg previews
//   node tools/render.mjs                       → out/frames/%05d.jpg (all 1440 frames) + out/type_events.json
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './browser.mjs';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FPS = 24;
const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;

const server = await serve();
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('page error:', e.message));
page.on('response', (r) => r.status() >= 400 && console.error('missing:', r.url()));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);

fs.mkdirSync(`${root}/out/frames`, { recursive: true });
const shot = async (t, file) => {
  await page.evaluate((tt) => window.renderAt(tt), t);
  await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
};

if (stillsArg) {
  for (const t of stillsArg.split(',').map(Number)) await shot(t, `${root}/out/still_${t}.jpg`);
  console.log('stills:', stillsArg);
} else {
  const duration = await page.evaluate(() => window.DURATION);
  const total = Math.round(duration * FPS);
  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    await shot(f / FPS, `${root}/out/frames/${String(f + 1).padStart(5, '0')}.jpg`);
    if (f % 120 === 0) console.log(`frame ${f}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  fs.writeFileSync(`${root}/out/type_events.json`, JSON.stringify(await page.evaluate(() => window.typeEvents)));
  console.log(`done: ${total} frames`);
}
await browser.close();
server.close();
