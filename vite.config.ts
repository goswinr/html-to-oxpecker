import solid from "solid-start/vite";
import { copyFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import UnoCss from "unocss/vite";
import staticAdapter from "./scripts/solid-start-static-adapter";

function legacySolidStartManifests(): Plugin {
  let outDir = "";

  return {
    name: "legacy-solid-start-manifests",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const viteManifest = join(outDir, ".vite", "manifest.json");
      const viteSsrManifest = join(outDir, ".vite", "ssr-manifest.json");

      if (existsSync(viteManifest)) {
        copyFileSync(viteManifest, join(outDir, "manifest.json"));
      }

      if (existsSync(viteSsrManifest)) {
        copyFileSync(viteSsrManifest, join(outDir, "ssr-manifest.json"));
      }
    },
  };
}

export default defineConfig({
  base: "/html-to-oxpecker/",
  build: {
    manifest: "manifest.json",
    ssrManifest: "ssr-manifest.json",
  },
  optimizeDeps: {
    // Add both @codemirror/state and @codemirror/view to included deps to optimize
    include: ["@codemirror/state", "@codemirror/view"],
  },
  plugins: [
    solid({
      adapter: staticAdapter(),
    }),
    legacySolidStartManifests(),
    UnoCss(),
  ],
});
