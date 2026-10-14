"""Synthesize a key-click track (48 kHz stereo wav) from out/type_events.json.

Each typed character gets a short band-limited noise tick with a little random pitch and level,
so the typing reads as a real keyboard under the music.
usage: python3 tools/clicks.py <type_events.json> <out.wav> [duration_s]
"""
import json
import sys
import wave

import numpy as np

SR = 48000
events = json.load(open(sys.argv[1]))
out_path = sys.argv[2]
duration = float(sys.argv[3]) if len(sys.argv) > 3 else 60.0

rng = np.random.default_rng(7)
track = np.zeros((int(SR * duration), 2), np.float32)


def click(pitch, level):
    n = int(SR * 0.022)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n).astype(np.float32)
    # crude band-pass: difference of two one-pole low-passes around the "pitch"
    def lp(x, fc):
        a = np.exp(-2 * np.pi * fc / SR)
        y = np.zeros_like(x)
        acc = 0.0
        for i, v in enumerate(x):
            acc = (1 - a) * v + a * acc
            y[i] = acc
        return y
    body = lp(noise, pitch * 1.6) - lp(noise, pitch * 0.6)
    thock = np.sin(2 * np.pi * 180 * t) * np.exp(-t * 260)
    env = np.exp(-t * 340)
    return (body * env * 2.2 + thock * 0.35) * level


bank = [click(p, 1.0) for p in (2600, 3000, 3400, 3800)]
for ev in events:
    c = bank[rng.integers(len(bank))] * rng.uniform(0.55, 1.0)
    i = int(ev["t"] * SR)
    if i >= len(track):
        continue
    seg = c[: len(track) - i]
    pan = rng.uniform(-0.15, 0.15)
    track[i : i + len(seg), 0] += seg * (1 - pan)
    track[i : i + len(seg), 1] += seg * (1 + pan)

peak = np.abs(track).max() or 1.0
track *= 0.2 / peak  # about -14 dBFS peaks; the music sits on top
pcm = (np.clip(track, -1, 1) * 32767).astype(np.int16)
with wave.open(out_path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"{len(events)} clicks -> {out_path}")
