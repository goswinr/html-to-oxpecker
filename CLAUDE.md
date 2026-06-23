# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A browser-based tool that converts HTML into SolidJS-compatible JSX (live at `solidjs-community.github.io/html-to-solidjsx`). Unlike React-oriented HTML→JSX converters, it keeps attributes close to HTML standards (`class`/`for` are not renamed) and offers Solid-specific options. Note: the repo folder is `html-to-oxpecker` but the package/app is still `html-to-solidjsx`.

## Commands

Uses **pnpm** (required; see `engines`) and SolidStart (the legacy Vite-based `solid-start` 0.3.x, not the new `@solidjs/start`).

- `pnpm dev` — dev server (`solid-start dev`)
- `pnpm build` — static build to `dist/public` (adapter `solid-start-static`)
- `pnpm start` — preview the production build

There is no test suite, linter, or typecheck script. Prettier config lives in `.prettierrc` (100 col, 2-space, semicolons, double quotes, trailing commas). CI (`.github/workflows/main.yaml`) only runs `pnpm build` and deploys `dist/public` to the `gh-pages` branch on push to `main`.

Path alias: `~/*` → `src/*` (see `tsconfig.json`).

## Architecture

### Central store (`src/store.ts`)
A single Solid `createStore` (`store` / `setStore`) is the source of truth shared across all components: `config` (the converter options + `prefixSVGIds`), `htmlText`, `jsxText`, `layout`, `lineWrap`. Components read/write this store directly rather than passing props. `config` is persisted to `localStorage.config`; the initial HTML/JSX demo content is hardcoded here.

### Conversion engine (`src/lib/html-to-jsx.ts`)
The core converter is the `HTMLtoJSX` class — a heavily modified fork of react-magic's `htmltojsx`, adapted for Solid JSX. Key facts:
- **Browser-only**: it parses input by setting `innerHTML` on a real `document.createElement("div")` and walking the DOM nodes (`#visit`/`#traverse`). It is guarded against SSR (`isServer`) and effectively a no-op on the server — conversion happens client-side only.
- `HTMLtoJSXConfig` (exported) defines every option; defaults are applied in the constructor. `StyleParser` (same file) handles inline `style` attributes (css-object vs css-string).
- Special handling lives here: void/self-closing detection, `<style>`/`<textarea>`/`<pre>` quirks, SVG tag-name camelCasing (`ELEMENT_TAG_NAME_MAPPING`), attribute mapping/camelCasing (`ATTRIBUTE_MAPPING`), comment conversion, and component/wrapper-node scaffolding.

### Wiring (`src/components/Editors/JSXEditor.tsx`)
This component owns the conversion lifecycle. It holds a `HTMLtoJSX` instance and re-runs `convert()` via `createEffect` whenever `store.htmlText` or `store.config` changes. Two post-processing steps run **after** `convert()` and are NOT part of the converter class:
- `namespaceSVGId()` — implements the store-only `prefixSVGIds` option (prefixes SVG `id`/`url(#…)`/`xlink:href` references). `prefixSVGIds` is intentionally outside `HTMLtoJSXConfig`.
- `insertHiddenFragments()` — wraps output in a `<>…</>` that is hidden via CSS so CodeMirror's JSX highlighter stays valid when there's no real wrapper node.

### Editors & UI
Both editors are CodeMirror 6 instances via `solid-codemirror`. `HTMLEditor` is editable (writes `htmlText`); `JSXEditor` is read-only (displays `jsxText`). Editor theming is in `src/editor/` (`theme/dark.ts`, `theme/light.ts`, `editorBaseTheme.ts`, `plugins/`). The `ConfigPanel` renders the options form from a `configMap` derived from the store and writes changes back through `setStore`.

Layout shell: `src/root.tsx` (document head, theme bootstrap script) → `src/routes/index.tsx` (the only route). Dark mode is a `dark` class on `<html>`, set by an inline script in `root.tsx` from `localStorage.theme` / `prefers-color-scheme`.

### Styling (`unocss.config.ts`)
UnoCSS with `preset-wind` (Tailwind-like). Custom arbitrary-value rules `bg-image-[…]`, `mask-image-[…]`, `transition-prop-[…]` use `_` as a space placeholder. The `md` breakpoint is overridden to **850px**. Brand colors and the Gordita font family are defined here.
