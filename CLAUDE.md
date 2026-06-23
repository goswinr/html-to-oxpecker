# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A browser-based tool (`html-to-oxpecker`, deployed at `GoswinR.github.io/html-to-oxpecker`) that converts HTML into both F# [Oxpecker.Solid](https://lanayx.github.io/Oxpecker/src/Oxpecker.Solid/) markup and SolidJS-compatible JSX, shown in side-by-side editor panes. Unlike React-oriented HTML→JSX converters, the JSX output keeps attributes close to HTML standards (`class`/`for` are not renamed) and offers Solid-specific options. History: this was forked from `solidjs-community/html-to-solidjsx` (the JSX converter) and the F# Oxpecker output was added; some banner/asset references still point at the original solidjs assets.

## Commands

Uses **pnpm** (required; see `engines`) and SolidStart (the legacy Vite-based `solid-start` 0.3.x, not the new `@solidjs/start`).

- `pnpm dev` — dev server (`solid-start dev`)
- `pnpm build` — static build to `dist/public` (adapter `solid-start-static`)
- `pnpm start` — preview the production build

- `pnpm test` / `pnpm test:fsharp` — compile-test the Oxpecker converter output (see below; needs the .NET SDK)

There is no linter or typecheck script. Prettier config lives in `.prettierrc` (100 col, 2-space, semicolons, double quotes, trailing commas). CI: `.github/workflows/main.yaml` runs `pnpm build` and deploys `dist/public` to `gh-pages` on push to `main`; `.github/workflows/test.yaml` runs the F# compile test on push/PR.

### Testing (`test/fsharp/`)
The one test is a Fable-based compile check that proves the Oxpecker output actually type-checks against the real `Oxpecker.Solid` NuGet package. `test/fsharp/run.mjs` runs the converter (via a linkedom DOM) over `test/fsharp/fixtures/*.html`, writes them as `[<SolidComponent>]` functions into `Generated.fs` (git-ignored), and compiles with Fable. Add a fixture `.html` to extend coverage; prefer inputs exercising tricky attribute typing. If you change attribute handling in the converter, run this — it's the only thing that catches Oxpecker type errors. See `test/fsharp/README.md`.

Path alias: `~/*` → `src/*` (see `tsconfig.json`).

## Architecture

### Central store (`src/store.ts`)
A single Solid `createStore` (`store` / `setStore`) is the source of truth shared across all components: `config` (the converter options + `prefixSVGIds`), `htmlText`, `jsxText`, `oxpeckerText`, `layout`, `lineWrap`. Components read/write this store directly rather than passing props. `config` is persisted to `localStorage.config`; the initial HTML/JSX/Oxpecker demo content is hardcoded here (keep the three in sync if you change them).

### Conversion engine (`src/lib/html-to-jsx.ts`)
The core converter is the `HTMLtoJSX` class — a heavily modified fork of react-magic's `htmltojsx`, adapted for Solid JSX. Key facts:
- **Browser-only**: it parses input by setting `innerHTML` on a real `document.createElement("div")` and walking the DOM nodes (`#visit`/`#traverse`). It is guarded against SSR (`isServer`) and effectively a no-op on the server — conversion happens client-side only.
- `HTMLtoJSXConfig` (exported) defines every option; defaults are applied in the constructor. `StyleParser` (same file) handles inline `style` attributes (css-object vs css-string).
- Special handling lives here: void/self-closing detection, `<style>`/`<textarea>`/`<pre>` quirks, SVG tag-name camelCasing (`ELEMENT_TAG_NAME_MAPPING`), attribute mapping/camelCasing (`ATTRIBUTE_MAPPING`), comment conversion, and component/wrapper-node scaffolding.

### Second converter: F# Oxpecker (`src/lib/html-to-oxpecker.ts`)
`HTMLtoOxpecker` is an independent, self-contained converter (same browser-only DOM-walking approach as `HTMLtoJSX`, but a cleaner recursive line-emitter) that outputs F# [Oxpecker.Solid](https://lanayx.github.io/Oxpecker/src/Oxpecker.Solid/) DSL. Attribute handling mirrors Oxpecker's typed property setters so output is both idiomatic and type-checks:
- **String** attrs → named args (`class'="x"`), but only when the name is in the `OXPECKER_STRING_ATTRS` allowlist (`src/lib/oxpecker-string-attrs.ts`); otherwise the property-initializer wouldn't compile (e.g. `blockquote` has no `cite`) and it falls back to `.attr(...)`. Known hyphenated SVG attrs use backtick-quoting (`` ``stop-color``="..." ``).
- **int** attrs (`tabindex`, `colspan`, `rows`, ...) → named int (`tabindex=2`) when integral, else `.attr`.
- **bool** attrs (`disabled`, `required`, ...) → named bool (`disabled=true`); bare non-bool attrs use `.bool(name, true)`.
- **`width`/`height`** are `int` on HTML elements but `string` on SVG ones, so the converter tracks an `#inSvg` flag: `width="50"` inside `<svg>`, `width=640` on `<img>`.
- **char** (`accesskey`) and anything unmodeled (`data-*`, hyphenated `aria-*`, `xlink:href`) → the generic, always-string-safe `.attr(...)`.

The `INT_ATTRS`/`BOOL_ATTRS`/`CHAR_ATTRS` sets and the string allowlist are all extracted from the Oxpecker.Solid bindings. Reserved-word **tag** names get an apostrophe too (the SVG `<use>` element is `use'`). SVG tags are camelCased; inline `style` is a string; `<style>` content is a triple-quoted string. Consumes only the `store.config` subset that maps cleanly (indent, wrapperNode, component, componentName, stripStyleTag, stripComment) via `mapConfig()` in `OxpeckerEditor.tsx`. **Note:** generated SVG markup requires `open Oxpecker.Solid.Svg` (that module is not `[<AutoOpen>]`, unlike `Tags`). Output verified to compile against Oxpecker.Solid 1.0.0 by `test/fsharp` (Fable).

### Wiring (`src/components/Editors/JSXEditor.tsx`, `OxpeckerEditor.tsx`)
Each output editor owns its own conversion lifecycle: it holds a converter instance and re-runs `convert()` via `createEffect` whenever `store.htmlText` or `store.config` changes, writing to `store.jsxText` / `store.oxpeckerText`. `JSXEditor` has two post-processing steps that run **after** `convert()` and are NOT part of the converter class:
- `namespaceSVGId()` — implements the store-only `prefixSVGIds` option (prefixes SVG `id`/`url(#…)`/`xlink:href` references). `prefixSVGIds` is intentionally outside `HTMLtoJSXConfig`. (Not yet applied to Oxpecker output.)
- `insertHiddenFragments()` — wraps output in a `<>…</>` that is hidden via CSS so CodeMirror's JSX highlighter stays valid when there's no real wrapper node.

`SplitEditor.tsx` lays the editors out with flexbox driven by the store: `orientation` (`columns`/`rows`) sets flex-direction, `panes` (`{html,jsx,oxpecker}` booleans, **JSX hidden by default**) controls which are mounted, and `paneSizes` are flex-grow weights adjusted by draggable resizers between adjacent panes (pointer-drag re-splits the two panes' combined weight; persisted to `localStorage.view`). Because hidden panes are unmounted, `JSXEditor`/`OxpeckerEditor` run an initial `convert()` on mount so a toggled-on pane reflects the current HTML. Visibility/orientation are controlled from `SettingsPanel` (desktop) and the `ActionsPanel` dropdown (mobile). F# highlighting uses `@codemirror/legacy-modes/mode/mllike` (`fSharp`) via `StreamLanguage`.

### Editors & UI
All three editors are CodeMirror 6 instances via `solid-codemirror`. `HTMLEditor` is editable (writes `htmlText`); `JSXEditor` and `OxpeckerEditor` are read-only (display `jsxText` / `oxpeckerText`). `CopyButton` is the shared copy control (`CopyJSXButton` is the older JSX-only variant still used in the mobile actions bar). Editor theming is in `src/editor/` (`theme/dark.ts`, `theme/light.ts`, `editorBaseTheme.ts`, `plugins/`). The `ConfigPanel` renders the options form from a `configMap` derived from the store and writes changes back through `setStore`.

Layout shell: `src/root.tsx` (document head, theme bootstrap script) → `src/routes/index.tsx` (the only route). Dark mode is a `dark` class on `<html>`, set by an inline script in `root.tsx` from `localStorage.theme` / `prefers-color-scheme`.

### Styling (`unocss.config.ts`)
UnoCSS with `preset-wind` (Tailwind-like). Custom arbitrary-value rules `bg-image-[…]`, `mask-image-[…]`, `transition-prop-[…]` use `_` as a space placeholder. The `md` breakpoint is overridden to **850px**. Brand colors and the Gordita font family are defined here.
