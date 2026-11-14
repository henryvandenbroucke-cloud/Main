// usage: node scripts/stills.mjs <outPrefix> <frame,frame,...> [scale] [inputPropsJson]
// Bundles once and renders stills with the pre-installed Chromium (software GL in the cloud container).
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const [prefix, frames, scale = "0.5", props = "{}"] = process.argv.slice(2);
const browserExecutable = process.env.CHROME || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const chromiumOptions = { gl: process.env.GL || "vulkan" };
const inputProps = JSON.parse(props);
fs.mkdirSync(path.dirname(prefix), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.tsx") });
const composition = await selectComposition({ serveUrl, id: "PointingShort", browserExecutable, chromiumOptions, inputProps });
const onBrowserLog = (l) => { if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 400)); };
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 90, scale: Number(scale),
    browserExecutable, chromiumOptions, inputProps, timeoutInMilliseconds: 600000, onBrowserLog });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
