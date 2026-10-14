// Turn each screencast capture (irregular frames with timestamps) into a 24 fps image sequence for index.html,
// condensing it with a per-segment time map so every action plays at a readable pace and the waits (slow software
// WebGL drags, the 60 s in-browser render) fly by. Segments are [fromMarker or seconds, toMarker or seconds, outSeconds].
//   node capture/retime.mjs → assets/frames/cap_<tool>/%04d.jpg
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ASSETS = path.join(HERE, '..', 'assets', 'frames');
const FPS = 24;

const PLANS = {
  // 9.6 s = 5 bars (a typed prompt runs over the first second)
  shot: [[0.9, 'edit', 0.9], ['edit', 'start', 0.75], ['start', 'orbit', 1.35], ['orbit', 'lens', 1.0], ['lens', 'end', 1.4],
    ['end', 'saved', 0.65], ['saved', 'render', 1.1], ['render', 'rendered', 0.5], ['rendered', 'approved', 1.25], ['approved', 'last', 0.7]],
  // 3.84 s = 2 bars (framing is out of the current cut, kept for reuse)
  framing: [[0.8, 'push', 0.6], ['push', 'dragB', 1.2], ['dragB', 'preview', 0.6], ['preview', 'last', 1.44]],
  // 5.76 s = 3 bars
  clip: [[0.4, 'in', 1.35], ['in', 'out', 1.6], ['out', 'speed', 1.0], ['speed', 7.8, 1.81]],
};

for (const [tool, plan] of Object.entries(PLANS)) {
  const dir = path.join(HERE, 'out', tool);
  const frames = JSON.parse(fs.readFileSync(path.join(dir, 'frames.json'), 'utf8'));
  const t0 = frames[0].t;
  const marks = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(dir, 'markers.json'), 'utf8')).map((m) => [m.name, m.t - t0]));
  marks.last = frames.at(-1).t - t0;
  const at = (x) => (typeof x === 'number' ? x : marks[x]);
  const outDir = path.join(ASSETS, `cap_${tool}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  let k = 0;
  for (const [a, b, dur] of plan) {
    const s0 = at(a), s1 = at(b);
    const n = Math.round(dur * FPS);
    for (let i = 0; i < n; i++) {
      const s = s0 + ((i + 0.5) / n) * (s1 - s0);
      let pick = frames[0];
      for (const f of frames) {
        if (f.t - t0 <= s) pick = f;
        else break;
      }
      fs.copyFileSync(path.join(dir, 'frames', pick.f), path.join(outDir, `${String(++k).padStart(4, '0')}.jpg`));
    }
  }
  console.log(`${tool}: ${k} frames (${(k / FPS).toFixed(2)} s)`);
}
