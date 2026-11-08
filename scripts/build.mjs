import { copyFile, mkdir } from "node:fs/promises";
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const STATIC_FILES = [
  "src/manifest.json",
  "src/popup/popup.html",
  "src/popup/popup.css",
  "src/options/options.html",
  "src/options/options.css",
];

const copyStatic = {
  name: "copy-static",
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length > 0) return;
      await mkdir("dist", { recursive: true });
      await Promise.all(STATIC_FILES.map((f) => copyFile(f, `dist/${f.split("/").pop()}`)));
      console.log(`[build] ${new Date().toLocaleTimeString()} done`);
    });
  },
};

const ctx = await esbuild.context({
  entryPoints: ["src/background.ts", "src/content.ts", "src/popup/popup.ts", "src/options/options.ts"],
  bundle: true,
  format: "iife",
  target: "chrome120",
  outdir: "dist",
  entryNames: "[name]",
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  logLevel: "info",
  plugins: [copyStatic],
});

if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
