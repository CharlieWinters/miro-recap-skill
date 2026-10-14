# Recap music: compose to the bars, then fit

## The composition plan

Use `elevenlabs/music/v2.5` on the fal connector, about $0.60 per minute (check `get_pricing`). Write one chunk per section, each at least 3000 ms, with durations that add up exactly to the film. At 125 BPM a bar is 1.92 s. The Tokyo 75.36 s cut:

| Chunk | ms | Covers |
| --- | --- | --- |
| Cold open | 3090 | Impact and riser. Ask for it to "keep playing straight into the beat", or the title card goes quiet. |
| Main groove | 28800 | Prompts, board build, scene 1 (bars 0–15) |
| Hands-on groove | 15360 | Lighter but still bouncy, under the tool captures (8 bars) |
| Big groove | 15360 | Scenes 2–3 (8 bars) |
| Build | 3840 | Snare roll and riser (2 bars) |
| Drop | 8910 | The pull-back wall, finale and end card |

In every chunk:
- `positive_styles`: "tempo exactly 125 BPM" and "instrumental".
- `negative_styles`: "vocals", "singing", "rap", "fade out", "decrescendo", "drum and bass".
- Volume words: "mezzo-forte", "loud, forte", "loudest, fortissimo".
- **No named works or artists.** "Tokyo drift phonk" came back as a 422 `content_policy_violation`.

Styles that worked as alternatives: hype electronic (the original and best), synthwave or outrun, phonk with cowbell and 808, and electro house with supersaw.

## Fitting (`tools/fit_music.py`)

- **Tempo:** across 5 of 5 cues the tempo was exact (half-time detection reads 62.5). The beat phase was about 0.2 s early against the grid, so the script delays the track by that much.
- **Drop:** if the tail after the drop bar is more than 3 dB quieter than the big groove, it splices the groove's own bars (from a bar line) in at the drop bar. 3 of 5 cues needed this.
- **Late grooves:** some cues build quietly and only hit their groove at about 7.4 s. Moving a cue by whole bars breaks its build and drop timing, so offer it as-is or regenerate.
- **Gain:** use a fixed `volume` plus `alimiter`. Single-pass `loudnorm` resamples to 192 kHz and flattens the build. Target about −13.5 LUFS for the final mix, with key clicks at about −14 dBFS peak.

## Options for the user

Remux the finished video once per fitted cue with `-c:v copy` (seconds each), name them `SOUNDTRACK_<X>`, and place them in a row on the board next to the current cut. Always include the previous or original track as one option.
