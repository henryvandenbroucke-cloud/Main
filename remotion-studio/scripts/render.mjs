// usage: node scripts/render.mjs <out.mp4> [scale] [concurrency]
// Full frame-by-frame render with the pre-installed Chromium (software GL in the cloud container).
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const [out, scale = "1", conc = "2"] = process.argv.slice(2);
const browserExecutable = process.env.CHROME || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const chromiumOptions = { gl: process.env.GL || "swangle" };
fs.mkdirSync(path.dirname(out), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.tsx") });
const composition = await selectComposition({ serveUrl, id: "PointingShort", browserExecutable, chromiumOptions });
const t0 = Date.now();
await renderMedia({ composition, serveUrl, codec: "h264", crf: 16, outputLocation: out, scale: Number(scale), concurrency: Number(conc),
  browserExecutable, chromiumOptions, timeoutInMilliseconds: 900000, imageFormat: "jpeg", jpegQuality: 95, muted: true,
  onProgress: ({ renderedFrames }) => { if (renderedFrames % 5 === 0) console.log("frames", renderedFrames, ((Date.now() - t0) / 1000).toFixed(0) + "s"); } });
console.log("done", out, ((Date.now() - t0) / 1000).toFixed(0) + "s");
