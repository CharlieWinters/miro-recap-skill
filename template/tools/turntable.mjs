// Render MODEL_Hypercar as a transparent 72-frame turntable (3 s at 24 fps) into assets/frames/turn/.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './browser.mjs';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FRAMES = 72;
const outDir = `${root}/assets/frames/turn`;
fs.mkdirSync(outDir, { recursive: true });

const server = await serve();
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/tools/turntable.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 180000 });

const canvas = page.locator('canvas');
for (let i = 0; i < FRAMES; i++) {
  await page.evaluate((f) => window.renderTurn(f), i / FRAMES);
  await canvas.screenshot({ path: `${outDir}/${String(i + 1).padStart(4, '0')}.png`, omitBackground: true });
}
console.log(`turntable: ${FRAMES} frames`);
await browser.close();
server.close();
