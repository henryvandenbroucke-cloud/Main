// usage: node scripts/render.mjs <out.mp4> [scale] [concurrency]
// Full frame-by-frame render with the pre-installed Chromium (software GL in the cloud container).
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const [out, scale = "1", conc = "2", range = ""] = process.argv.slice(2);
const frameRange = range ? range.split("-").map(Number) : null;
const browserExecutable = process.env.CHROME || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
// "vulkan" = Mesa lavapipe (software Vulkan), about 2.5x faster than SwiftShader ("swangle") in the cloud container;
// on a PC with a graphics card use GL=angle
const chromiumOptions = { gl: process.env.GL || "vulkan" };
fs.mkdirSync(path.dirname(out), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.tsx") });
const inputProps = JSON.parse(process.env.PROPS || "{}");
const composition = await selectComposition({ serveUrl, id: process.env.COMP || "WaterShort", browserExecutable, chromiumOptions, inputProps });
const t0 = Date.now();
await renderMedia({ composition, serveUrl, codec: "h264", crf: 16, outputLocation: out, scale: Number(scale), concurrency: Number(conc),
  browserExecutable, chromiumOptions, inputProps, timeoutInMilliseconds: 900000, imageFormat: "jpeg", jpegQuality: 95, muted: true, frameRange,
  onProgress: ({ renderedFrames }) => { if (renderedFrames % (frameRange ? 1 : 5) === 0) console.log("frames", renderedFrames, ((Date.now() - t0) / 1000).toFixed(0) + "s"); } });
console.log("done", out, ((Date.now() - t0) / 1000).toFixed(0) + "s");
