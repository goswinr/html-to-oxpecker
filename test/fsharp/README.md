# F# Oxpecker compile test

This is a permanent regression test that proves the HTML → F# Oxpecker.Solid
converter ([`src/lib/html-to-oxpecker.ts`](../../src/lib/html-to-oxpecker.ts))
emits code that actually **compiles against the real
[Oxpecker.Solid](https://www.nuget.org/packages/Oxpecker.Solid) package**.

Run it from the repo root:

```sh
pnpm test:fsharp     # or: pnpm test
```

## What it does

[`run.mjs`](run.mjs):

1. Installs a [linkedom](https://github.com/WebReflection/linkedom) DOM as
   globals (the converter is browser-only) and bundles the converter with
   esbuild.
2. Runs the converter over every `fixtures/*.html` file and writes the results
   as `[<SolidComponent>]` functions into `Generated.fs` (git-ignored).
3. Compiles `Generated.fs` with **Fable** against `Oxpecker.Solid`
   ([`OxpeckerCompileTest.fsproj`](OxpeckerCompileTest.fsproj)). Oxpecker.Solid is
   a Fable library whose DSL is rewritten by a Fable compiler plugin, so `dotnet
   build` alone is not enough — Fable is the real check. A clean Fable run means
   the generated DSL type-checks.

## Requirements

- Node + pnpm (the repo's dev dependencies, incl. `linkedom` and `esbuild`).
- The [.NET SDK](https://dotnet.microsoft.com/) on `PATH` (the project targets
  `net10.0`, matching Oxpecker.Solid 1.0.0). The Fable CLI is pinned in
  [`.config/dotnet-tools.json`](.config/dotnet-tools.json) and restored
  automatically by the runner.

## Adding cases

Drop a new `.html` file in [`fixtures/`](fixtures/); it is picked up
automatically (the filename becomes the component name). Prefer inputs that
exercise tricky attribute typing — `int`/`bool` attributes, SVG, reserved-word
tags/attributes (`use`, `class`, `for`), and attributes Oxpecker doesn't model.

## Notes

- Oxpecker types attributes (e.g. `tabindex` is `int`), so the converter routes
  typed / undefined / hyphenated attributes through the generic `.attr()` /
  `.bool()` extensions while keeping defined string attributes as idiomatic named
  arguments. The allowlist of string attributes lives in
  [`src/lib/oxpecker-string-attrs.ts`](../../src/lib/oxpecker-string-attrs.ts),
  generated from the Oxpecker.Solid bindings.
- Generated SVG markup requires `open Oxpecker.Solid.Svg` (that module is not
  `[<AutoOpen>]`), which the runner adds to `Generated.fs`.
