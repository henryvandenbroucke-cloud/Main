// usage: node scripts/render.mjs <compId> <out.mp4> <from-to> [scale] [concurrency]
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [id, out, range, scale = "0.5", conc = "1"] = process.argv.slice(2);
const browserExecutable = "/opt/pw-browsers/chromium";
const chromiumOptions = { gl: process.env.GL || "swangle" };
const inputProps = process.env.PROPS ? JSON.parse(process.env.PROPS) : {};
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable, chromiumOptions, timeoutInMilliseconds: 300000 });
const frameRange = range === "all" ? null : range.split("-").map(Number);
const t0 = Date.now(); let last = 0;
await renderMedia({ composition, inputProps, serveUrl, codec: "h264", crf: 16, x264Preset: process.env.PRESET || undefined, imageFormat: "jpeg", jpegQuality: 92, outputLocation: out, scale: Number(scale), frameRange, concurrency: Number(conc),
  browserExecutable, chromiumOptions, timeoutInMilliseconds: 600000, muted: true,
  onProgress: ({ renderedFrames }) => { if (renderedFrames - last >= Number(process.env.EVERY || 30)) { last = renderedFrames; console.log("frames", renderedFrames, ((Date.now() - t0) / 1000).toFixed(0) + "s"); } } });
console.log("done", ((Date.now() - t0) / 1000).toFixed(0) + "s");
