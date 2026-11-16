// usage: node scripts/render_parallel.mjs <outDir> <totalFrames> [chunkFrames=60] [workers=4]
// Renders the short in chunks with several SEPARATE browsers, one tab each. In the cloud container (software
// Vulkan) several tabs in one browser leak graphics memory until the GPU process is killed and every painted
// texture comes back black; one tab per browser stays flat. Finished chunks are skipped, so it can be resumed.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const [outDir, total, chunk = "60", workers = "4"] = process.argv.slice(2);
const browserExecutable = process.env.CHROME || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const chromiumOptions = { gl: process.env.GL || "vulkan" };
const id = process.env.COMP || "WaterShort";
fs.mkdirSync(outDir, { recursive: true });
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.tsx") });
const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions });
const jobs = [];
const START = Number(process.env.START || 0);
for (let a = START, i = 0; a < Number(total); a += Number(chunk), i++) jobs.push({ i, a, b: Math.min(Number(total), a + Number(chunk)) - 1 });
const name = (j) => path.join(outDir, `chunk_${String(j.i).padStart(3, "0")}.mp4`);
const todo = jobs.filter((j) => !fs.existsSync(name(j)));
log(`${jobs.length} chunks, ${todo.length} to render, ${workers} workers`);
let done = jobs.length - todo.length;
const work = async (w) => {
  for (;;) {
    const j = todo.shift();
    if (!j) return;
    const tmp = name(j) + ".part.mp4", t0 = Date.now();
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await renderMedia({ composition, serveUrl, codec: "h264", crf: 16, outputLocation: tmp, concurrency: 1, frameRange: [j.a, j.b],
          browserExecutable, chromiumOptions, timeoutInMilliseconds: 900000, imageFormat: "jpeg", jpegQuality: 95, muted: true });
        fs.renameSync(tmp, name(j));
        done++;
        log(`worker ${w} chunk ${j.i} frames ${j.a}-${j.b} done in ${((Date.now() - t0) / 1000).toFixed(0)}s (${done}/${jobs.length})`);
        break;
      } catch (e) { log(`worker ${w} chunk ${j.i} attempt ${attempt} failed: ${String(e).slice(0, 200)}`); }
    }
  }
};
await Promise.all(Array.from({ length: Number(workers) }, (_, w) => work(w)));
log("ALL CHUNKS DONE");
process.exit(0);
