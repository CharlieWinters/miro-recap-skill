# miro-recap

A [Claude Code](https://claude.com/claude-code) skill that makes short "how it was made" recap films of work done on a Miro board with Claude.

The film is told through the user's own prompts. Each prompt types out in a Claude Code-style terminal at the bottom of the frame, and the board's real outputs build on a Miro-style canvas above it. Previz (greybox) and AI output play side by side, and the film ends on the finished piece and an end card. There's no voiceover and no headline text: the prompts carry the story.

It's code-built, not edited in a timeline:

- **HTML + GSAP:** the whole film is one paused GSAP timeline, and `window.renderAt(t)` draws any moment exactly.
- **Playwright:** captures the page frame by frame. Footage uses image sequences rather than `<video>` so every frame is exact.
- **ffmpeg:** muxes the frames, a synthesized key-click track and the music.
- **ElevenLabs music (via fal):** a hype track composed to the beat plan, then shifted onto the bar grid by `fit_music.py`.

## Install

Clone into your Claude Code skills folder:

```bash
git clone https://github.com/CharlieWinters/miro-recap-skill ~/.claude/skills/miro-recap
```

Claude then picks the skill up when you ask for a recap, making-of, behind-the-scenes or process video of a board. You can also invoke it directly with `/miro-recap <board id> 60s`.

## Requirements

- Node 18+ (the template pins `playwright` 1.56, `gsap` and `three`; run `npx playwright install chromium` once)
- ffmpeg
- Python 3 with `numpy` (for `fit_music.py` and `clicks.py`)
- For the full flow: the Miro MCP server and fal MCP tools (board reading, asset lookup, music, upload and placing the video back on the board)
- Optional: the [miro-packs](https://github.com/CharlieWinters/miro-packs) repo, for capturing the real editing tools (see `reference/tool-capture.md`)

## How it works

1. **Gather the story:** the prompts from the conversation, and the outputs from the board (images, GLBs, previz shots, videos), downloaded into `assets/`.
2. **Plan the beats on a bar grid:** pick the tempo first (125 BPM works well) and put every scene change on a bar.
3. **Build from the template:** copy `template/`, run `npm install`, and edit the beat list in `index.html`. Render preview stills and check them before the full render.
4. **Score it:** compose a track to the beat plan, then fit it onto the grid.
5. **Deliver:** upload the mp4 and place it on the board as a video viewer.

`SKILL.md` has the full instructions Claude follows, including the pre-flight questions and the rules learned along the way.

## Quick reference

```bash
cp -R ~/.claude/skills/miro-recap/template my-recap && cd my-recap && npm install

node tools/turntable.mjs                      # 72-frame turntable of assets/car.glb -> assets/frames/turn/
node tools/render.mjs --stills 4,12,30        # preview stills -> out/still_<t>.jpg
node tools/render.mjs                         # full frame render -> out/frames/
python3 tools/fit_music.py in.mp3 assets/music.wav <drop_s> <groove_from_s> <end_s>
DURATION=60 MUSIC=assets/music.wav bash tools/build.sh   # -> out/recap.mp4
```

Set `NO_SPLICE=1` on `fit_music.py` when the outro is meant to be quiet (for example, the finished clip's own dialogue under the finale).

## Layout

| Path | What it is |
| --- | --- |
| `SKILL.md` | The skill: pre-flight, beat plan, build, music, delivery, rules |
| `reference/music.md` | Composition plans, fitting and mixing |
| `reference/tool-capture.md` | Recording the real Miro Packs editing tools against a fake SDK |
| `template/index.html` | The film: prompts, layers, side-by-sides, tool beats, timeline |
| `template/tools/` | Render, turntable, music fit, key clicks and the ffmpeg build |
| `template/capture/` | Tool-capture driver and retimer |
| `template/assets/fetch.example.sh` | Example asset download and frame extraction (from the Tokyo recap) |

The template is the engine from the Tokyo Hypercar Promo recap, the worked example the skill refers to. Its asset URLs point at that project's media.
