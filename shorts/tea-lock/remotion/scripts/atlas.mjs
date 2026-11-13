// usage: node scripts/atlas.mjs <compId> <out.png>
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [id, out] = process.argv.slice(2);
const browserExecutable = "/opt/pw-browsers/chromium";
const chromiumOptions = { gl: process.env.GL || "swangle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions, timeoutInMilliseconds: 300000 });
const t0 = Date.now();
await renderStill({ composition, serveUrl, frame: 0, output: out, imageFormat: "png", browserExecutable, chromiumOptions, timeoutInMilliseconds: 600000,
  onBrowserLog: (l) => { if (l.type === "error") console.log("[err]", l.text.slice(0, 300)); } });
console.log("atlas", ((Date.now() - t0) / 1000).toFixed(1) + "s");
