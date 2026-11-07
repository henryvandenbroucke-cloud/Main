// usage: node scripts/plates.mjs id,id,... [outDir]  (one bundle, one still per plate, PNG)
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [ids, outDir = "public/plates"] = process.argv.slice(2);
const browserExecutable = "/opt/pw-browsers/chromium";
const chromiumOptions = { gl: "swangle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const onBrowserLog = (l) => { if (l.type === "error") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
for (const id of ids.split(",")) {
  const t0 = Date.now(), inputProps = { plate: id };
  const composition = await selectComposition({ serveUrl, id: "Plate", inputProps, browserExecutable, chromiumOptions, timeoutInMilliseconds: 600000 });
  await renderStill({ composition, serveUrl, inputProps, frame: 0, output: path.resolve(outDir, `${id}.png`), imageFormat: "png",
    browserExecutable, chromiumOptions, timeoutInMilliseconds: 600000, onBrowserLog });
  console.log("plate", id, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
