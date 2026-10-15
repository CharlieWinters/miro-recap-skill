"""Fit a generated 125 BPM cue to the making-of's bar grid and drop, and report what it did.

1. Beat phase: find the cue's beat phase (onset autocorrelation on a 0.48 s grid) and delay it so its beats land on
   the video's grid (beats at 0.21 + 0.48 k; bars at 3.09 + 1.92 n).
2. Drop: ElevenLabs often fades the planned climax. If the last section (after the 66.45 s drop bar) is quieter than
   the big groove, splice the cue's own big-groove bars (from 47.25 s, bar-aligned) in at 66.45 s.
3. Trim to 75.36 s with a 0.4 s tail, limit peaks, 48 kHz stereo wav.

usage: python3 tools/fit_music.py <in.mp3> <out.wav> [drop_s groove_from_s end_s]
   (defaults are the Tokyo recap: drop on bar 33 = 66.45 s, big groove from bar 23 = 47.25 s, end 75.36 s)
"""
import subprocess
import sys

import numpy as np

SR = 48000
BEAT = 0.48
GRID_PHASE = 0.21
src, dst = sys.argv[1], sys.argv[2]
DROP, GROOVE_FROM, END = (float(a) for a in sys.argv[3:6]) if len(sys.argv) >= 6 else (66.45, 47.25, 75.36)


def decode(path, sr=SR, ch=2):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", str(ch), "-ar", str(sr), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()


def rms_db(x, a, b):
    seg = x[int(a * SR) : int(b * SR)]
    return 20 * np.log10(np.sqrt((seg**2).mean()) + 1e-9) if len(seg) else -120.0


audio = decode(src)
mono = audio.mean(1)

# beat phase from onsets on a 10 ms envelope, 4-46 s
hop = SR // 100
n = len(mono) // hop
env = np.sqrt((mono[: n * hop].reshape(n, hop) ** 2).mean(1))
on = np.maximum(0, np.diff(np.log(env + 1e-6)))
region = range(400, min(4600, len(on)))
phases = np.arange(0, BEAT, 0.005)
score = [sum(on[int((4 + q + k * BEAT) * 100)] for k in range(int(42 / BEAT)) if int((4 + q + k * BEAT) * 100) < region.stop) for q in phases]
phase = (4 + phases[int(np.argmax(score))]) % BEAT
shift = (GRID_PHASE - phase) % BEAT
audio = np.vstack([np.zeros((int(shift * SR), 2), np.float32), audio])

groove = rms_db(audio, GROOVE_FROM, DROP - 4)
tail = rms_db(audio, DROP + 1, END - 1)
import os
spliced = tail < groove - 3 and not os.environ.get("NO_SPLICE")  # NO_SPLICE=1 when the post-drop quiet is intended
if spliced:
    seg = audio[int(GROOVE_FROM * SR) : int((GROOVE_FROM + END - DROP + 0.1) * SR)]
    cut = int(DROP * SR)
    xf = int(0.02 * SR)
    ramp = np.linspace(0, 1, xf, dtype=np.float32)[:, None]
    head = audio[: cut + xf].copy()
    head[cut:] = head[cut:] * (1 - ramp) + seg[:xf] * ramp
    audio = np.vstack([head, seg[xf:]])

audio = audio[: int(END * SR)]
if len(audio) < int(END * SR):
    audio = np.vstack([audio, np.zeros((int(END * SR) - len(audio), 2), np.float32)])
fade = int(0.4 * SR)
audio[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)[:, None]
peak = np.abs(audio).max() or 1
audio *= min(1.0, 0.89 / peak)

subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", dst], input=audio.astype(np.float32).tobytes(), check=True)
print(f"{src}: phase {phase:.3f}s -> shift +{shift:.3f}s; groove {groove:.1f} dB, tail {tail:.1f} dB -> {'spliced drop' if spliced else 'kept its own drop'}")
print("  levels:", " ".join(f"{t:.0f}s {rms_db(audio, t, t + 1):.0f}" for t in np.linspace(0, END - 1, 14)))
