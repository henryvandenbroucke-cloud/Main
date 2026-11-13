import sys, json
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[3] if len(sys.argv) > 3 else "small.en", device="cpu", compute_type="int8")
import numpy as np
audio = np.fromfile(sys.argv[1], np.float32)
segs, _ = m.transcribe(audio, word_timestamps=True, language="en", beam_size=5)
out = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in s.words]
json.dump(out, open(sys.argv[2], "w"), indent=0)
print(len(out), "words"); print(" ".join(f'{o["w"]}@{o["s"]}' for o in out))
