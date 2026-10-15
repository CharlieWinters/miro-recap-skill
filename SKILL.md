---
name: miro-recap
description: Make a short "how it was made" recap film of work done on a Miro board with Claude. The user's own prompts type out in a Claude Code-style terminal while the board's real outputs build on a Miro-style canvas above. Previz (greybox) and AI output play side by side, the real Miro Packs editing tools are shown in use, and it ends on the finished piece and an end card. Code-built (HTML + GSAP, captured frame by frame with Playwright, ffmpeg), scored with a fitted ElevenLabs hype track, and placed on the board. Use when someone asks for a recap, making-of, behind-the-scenes, "how this was created" or process video of a board or project, or wants soundtrack options for one.
allowed-tools: [Bash, Read, Write, Edit]
argument-hint: [board id or URL, plus target length, e.g. "uXjVEa9VQXs= 60s"]
---

# Miro recap film

A 45–90 s film of how a board was made, **told through the user's own prompts**. Each beat:

1. A prompt types out in the bottom terminal, in the user's words.
2. What landed on the board appears above it, recreated with the real assets.

There are no Claude replies and no headline or kicker text; the prompts carry the story.

The worked example is the Tokyo Hypercar Promo recap (board `uXjVEa9VQXs=`, project `~/platform-architect2026/tokyo-promo-makingof/`). `template/` is that project's engine. Copy it and edit `index.html`'s beat list; don't rebuild from scratch.

## 0. Pre-flight (ask in plain text, never a picker)

- **Length:** default about 60 s; 75–90 s if there are editing-tool captures.
- **Aspect:** 16:9 by default; a 9:16 cut is a later pass.
- **Music:** a hype track (default) or no music. No voiceover unless asked.
- **Board:** the board id, and whether to place the result there.

## 1. Gather the story

- **Prompts:** take them from the conversation. Use the user's actual words, lightly trimmed. Merge two follow-ups into one bubble only when they belong together. Count them honestly for the end card.
- **Outputs:**
  - `list_references { kinds: ["image", "3d"] }` for titled images and GLBs.
  - `get_shot` for previz stills and clips (`render.stillUrl` / `clipUrl`).
  - The fal URLs of the videos and audio.
  - Download everything into `assets/` (see `template/assets/fetch.example.sh`), and turn each video into a 24 fps JPG sequence under `assets/frames/<name>/`.
- **Board embeds export blank:** the board's SVG export shows every embed as an empty card, so don't use it as footage. Recreate the board as dotted-canvas cards with the real assets. A "wall" of every output makes the best pull-back.

## 2. Plan the beats on a bar grid

- **Timing:** pick the music tempo first (125 BPM works) and put every scene change on a bar: `bar(n) = 3.09 + 1.92 n` at 125 BPM.
- **Typical order** (the Tokyo cut):

| Bars / seconds | Beat |
| --- | --- |
| 0–3 s | Cold open on the finished piece |
| 3–5 s | Title card |
| 5 s on | Prompt 1, and the new board appears |
| next | Concept, views, 3D model, greybox, each landing on a beat |
| next | Previz vs AI side-by-sides, one per scene |
| optional | Hands-on beat: real editing tools, each with a first-person prompt such as "I'm just going to make some quick adjustments to the previz" |
| next | The "cut it together" prompt |
| the drop | Pull back across a wall of every output |
| last bars | The finished piece, then the end card (prompts, scenes, time, spend) |

- **Terminal:** it stays up for the whole run. Each prompt types at 55–105 characters per second and stays readable while its results play.
- **Side-by-sides:** label the pills "PREVIZ · grey clay · free" and "AI OUTPUT". Both play from the same start; add cut flashes or a speed gauge when the scene has them.

## 3. Build it (template)

```bash
cp -R ~/.claude/skills/miro-recap/template <project> && cd <project> && npm install
```

- **`index.html`:** `PROMPTS`, the layers, the `SBS` scenes, `TOOL_BEATS` and `DURATION` are the parts to edit. Everything is a paused GSAP timeline, and `window.renderAt(t)` draws any moment exactly.
- **Image sequences, not `<video>`:** that gives exact frames.
- **3D turntable:** `node tools/turntable.mjs`, from a GLB.
- **Preview stills:** `node tools/render.mjs --stills 4,12,30` gives `out/still_<t>.jpg`. Make a contact sheet and look at it before the full render. Check for:
  - centred camera stops,
  - nothing under the board chip,
  - cards clear of the terminal,
  - hard-coded `data-start` times after you've shifted beats (they don't follow `bar()`).
- **Full render:** `node tools/render.mjs`, then `DURATION=… MUSIC=assets/music.wav bash tools/build.sh`.

## 4. Music (see `reference/music.md`)

- **Compose to the beat plan:** ElevenLabs `elevenlabs/music/v2.5` on fal, with a composition plan whose chunks match the bars, including a drop chunk on the pull-back bar. Price it first (about $0.60 per minute).
- **Fit it:** `python3 tools/fit_music.py in.mp3 out.wav <drop_s> <groove_from_s> <end_s>`. This shifts the beats onto the grid and splices the drop when the cue faded it, which happens about half the time.
- **A quiet outro on purpose** (for example, the finished clip's own dialogue under the finale): run the fit with `NO_SPLICE=1`, or it will splice groove over the quiet tail. Mix the finale's own audio in after `build.sh` with `adelay` plus `amix`, and check it with a transcript.
- **Soundtrack options:** to offer choices, remux the finished video with each fitted track (`-c:v copy`, no re-render). Place them side by side on the board, with the original track as one of them.

## 5. Real editing tools (optional, see `reference/tool-capture.md`)

`template/capture/` drives the real Miro Packs embeds (previz shot, framing, clip editor) outside Miro, using the miro-packs e2e fake SDK, and records them with a visible cursor. `retime.mjs` condenses each recording onto the bars. It only reads from the miro-packs repo and builds into `capture/dist`; never touch `app/dist` or the user's worktree.

## 6. Deliver

- Upload with `upload_file` (`prepare_upload`, then a curl PUT), then `place_viewer { kind: "video", title: "RECAP" }` on the board.
- Keep earlier cuts (`…_v1.mp4`).
- Report:
  - the board item,
  - the local path,
  - every spend (music),
  - any liberties taken (trimmed or merged prompts, removed beats, mocked backends).

## Rules learned

- **The prompts tell the story.** Keep on-screen text to UI labels; no headlines or kickers.
- **Ship it on the board.** The recap is a board deliverable, as well as a local file.
- **Check spec timing in the picture, not the JSON.** Render stills, look at them, then render.
- **Be honest about mocks.** Tool captures run against a fake backend, so say so.
