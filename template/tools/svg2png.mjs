// Rasterise the Miro board SVG export to a PNG for the making-of video's board shots.
import { launch } from './browser.mjs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const [W, H] = [12029, 5098]; // the export's own width/height
const scale = 0.25;

const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
await page.goto(`file://${root}/assets/board.svg`, { waitUntil: 'load', timeout: 180000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${root}/assets/img/board.png` });
console.log('board.png', Math.round(W * scale), Math.round(H * scale));
await browser.close();
