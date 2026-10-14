#!/usr/bin/env bash
# Mux the rendered frames with the music and key clicks into out/recap.mp4.
# Needs: out/frames/*.jpg + out/type_events.json (node tools/render.mjs) and a fitted music wav.
#   DURATION=75.36 MUSIC=assets/music.wav PY=<python with numpy> bash tools/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PY:-python3}"
: "${DURATION:?set DURATION to window.DURATION from index.html, in seconds}"
MUSIC="${MUSIC:-assets/music.wav}"
OUT="${OUT:-out/recap.mp4}"

"$PY" -I tools/clicks.py out/type_events.json out/clicks.wav "$DURATION"

ffmpeg -v error -y \
  -framerate 24 -i out/frames/%05d.jpg \
  -i "$MUSIC" -i out/clicks.wav \
  -filter_complex "[1:a]volume=-2dB[m];[2:a]volume=0dB[c];[m][c]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89:level=false,aresample=48000[a]" \
  -map 0:v -map "[a]" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 24 \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -t "$DURATION" "$OUT"

ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact "$OUT"
ffmpeg -hide_banner -i "$OUT" -vn -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tail -2
