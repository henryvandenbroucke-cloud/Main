import json, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

MODEL_DIR = sys.argv[1]
OUT_DIR = sys.argv[2]
VOICE = sys.argv[3] if len(sys.argv) > 3 else "am_michael"
SPEED = float(sys.argv[4]) if len(sys.argv) > 4 else 1.12

lines = [
    ("It took Rockstar over twelve years... but GTA 6 is finally here.", 0.45),
    ("Its very first trailer pulled more than sixty million views in just twelve hours.", 0.15),
    ("The biggest video launch in YouTube history at the time.", 0.35),
    ("This time we're in Leonida, Rockstar's version of Florida, with a fully reimagined Vice City.", 0.15),
    ("Neon nights, packed beaches, swamps, highways and small towns, all in one map.", 0.35),
    ("And for the first time, there are two leads. Jason and Lucia.", 0.15),
    ("A criminal couple pulled into the Leonida underworld after a heist goes wrong.", 0.15),
    ("Bonnie and Clyde energy.", 0.35),
    ("The detail is insane.", 0.12),
    ("Crowds that react to everything, social media chaos filmed in-game, and a world that feels alive every second.", 0.35),
    ("So... are you playing Jason or Lucia first?", 0.12),
    ("Tell me in the comments.", 0.4),
]

k = Kokoro(f"{MODEL_DIR}/kokoro-v1.0.onnx", f"{MODEL_DIR}/voices-v1.0.bin")
chunks, timing, t, sr = [], [], 0.0, 24000
for text, pause in lines:
    audio, sr = k.create(text, voice=VOICE, speed=SPEED, lang="en-us")
    dur = len(audio) / sr
    timing.append({"start": round(t, 3), "end": round(t + dur, 3), "text": text})
    chunks += [audio, np.zeros(int(pause * sr), dtype=audio.dtype)]
    t += dur + pause

sf.write(f"{OUT_DIR}/GTA6_voiceover.wav", np.concatenate(chunks), sr)
json.dump(timing, open(f"{OUT_DIR}/GTA6_voiceover_timing.json", "w"), indent=1)
print(f"total {t:.2f}s")
