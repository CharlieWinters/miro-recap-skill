# Capturing the real Miro Packs editing tools

`template/capture/capture.mjs` records the actual previz shot, clip editor and framing embeds in use, without Miro. `retime.mjs` then condenses each recording onto the film's bars.

## How it works

- **Build:** builds the app with Vite from the miro-packs **previz worktree** (`.../miro-packs/.claude/worktrees/previz/app`, the only place the previz embed lives) into `capture/dist`. It passes `VITE_TOOLS_SERVER` and the related env vars, as `e2e/previz.mjs` does. It only reads from that repo. Never build into `app/dist`, which is the deploy, and never touch uncommitted work in the worktree.
- **Servers:** `startServers` from `e2e/servers.mjs` provides the app, a fake Worker and a fake board. `capture/board.html` is a capture variant of the e2e board: one embed full-frame, the bridge off-screen, and a drawn cursor with click rings.
- **Fake SDK:** `e2e/fakeMiro.js` is served in place of `miro.js`. The board lives in localStorage on the app origin.

## Seeding records

Write each embed's record straight into the fake board item's `meta`:

| Record | Key | Contents |
| --- | --- | --- |
| Previz shot | `mp-previz-shot` | `{ v, name, spec: { url, sha, bytes }, edits }`. The fake Worker serves the spec at `/s/<nid>/<sha>.json`; the sha must match its bytes. |
| Clip | `mp-clip` | `{ v, src, duration, in, out, speed }` |
| Framing | `mp-framing` | `{ v, src, aspect, imageAspect, start, end, move }`, with rects as fractions |

## Gotchas

- **`https` only:** media must be `https`; the tools reject anything else. Fulfill a fake host (`media.capture.test`) from local files through `context.route`, and transcode video to WebM (VP9).
- **Network allow-list:** allow `*.fal.media` for GLBs in the spec and abort everything else.
- **Sharp capture:** screencast frames come at CSS size, so for sharp output the iframe is CSS-scaled `S = 1.5×`. Playwright `boundingBox` inside a transformed iframe is unscaled, so multiply by `S` (`ui.at` does).
- **Fixed-position panels:** the previz edit panel is fixed-position. Test visibility with `getBoundingClientRect().width`, not `offsetParent`.
- **Orbit sensitivity:** previz orbit drags are very sensitive; about 45 px sideways in frame coordinates re-angles cleanly. Under software WebGL each drag takes about 20 s of wall clock and Render about 60 s. That's fine, because `retime.mjs` compresses those segments.
- **Clip autoplay:** the clip editor autoplays, so a final "Play" click actually pauses it. End the segment before that click.
- **Mocked backend:** Render and Approve go to the fake Worker. They show the real UI states, but nothing reaches a real board, so say so in the report.

## Retiming

`PLANS` in `retime.mjs` maps `[fromMarker, toMarker, outSeconds]` per segment, with the markers recorded after each scripted action. Give each action a readable 0.6–1.4 s and fly through the waits. Sum the segments to whole bars (e.g. 9.6 s = 5 bars).
