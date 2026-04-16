# Deterministic Twemoji Build Design

**Date:** 2026-04-15

## Goal

Keep the current FontForge-based font pipeline, but make repeated builds with identical inputs produce identical `.ttf` and `.woff2` bytes. Reduce accidental complexity around setup and maintenance without risking intentional visual changes to the generated font.

## Constraints

- Preserve the current font-generation engine and output semantics.
- Avoid replacing FontForge or `grunt-webfonts` in this pass.
- Accept a one-time output hash reset if the deterministic rewrite requires it.
- After that reset, require stable hashes across repeated local and CI builds.
- Remove redundant `// @ts-check` comments from JavaScript files that are already covered by `tsconfig.node.json`.

## Current Problems

1. The build is already nondeterministic.
   Two back-to-back `pnpm run build` executions with no source changes produced different hashes and different `.woff2` byte sizes.

2. Ordering is implicit instead of controlled.
   `scripts/layerize.js` mixes synchronous filesystem reads with asynchronous zip-entry processing and pushes into shared arrays that later drive `COLR`, `CPAL`, `GSUB`, and `codepoints.js`.

3. The supported pipeline is split across old and new entrypoints.
   The repo now uses Node scripts for the supported flow, but the legacy Makefile and older setup guidance still obscure what is canonical.

4. Python setup is real but under-described.
   The build depends on Python packages from `fonttools`, plus FontForge's bundled Python runtime. There is no repo-native Python dependency declaration to install the Python-side tools cleanly.

## Chosen Approach

### 1. Stabilize the existing generator instead of replacing it

Keep:

- `scripts/layerize.js`
- `scripts/run-webfont.js`
- FontForge
- `fonttools`

Change the pipeline so every collection that affects emitted bytes is built in a deterministic order:

- source SVG processing order
- extras order
- overrides order
- component glyph registration order
- color palette order
- ligature ordering
- `codepoints.js` ordering
- any emitted JSON ordering that feeds later steps

### 2. Treat Node scripts as the single supported interface

The supported developer flow should be:

- `pnpm run build:font`
- `pnpm run build:package`
- `pnpm run verify`

The Makefile can remain temporarily if the underlying tool still needs it for reference, but docs should no longer present it as the primary path.

### 3. Add explicit Python environment metadata

Add `pyproject.toml` so contributors can install the Python-side tooling without guessing package names.

Scope:

- declare `fonttools[woff]`
- document that `ffpython` still comes from the FontForge installation, not from `pip`

This reduces setup ambiguity without pretending the entire build can run from pure Python packages.

### 4. Remove redundant per-file JS typecheck pragmas

For `.js` files already covered by `tsconfig.node.json`, remove `// @ts-check`.

Exception:

- if a file must remain excluded from the TS config and still needs local checking semantics, keep the pragma there

## Non-Goals

- Replacing FontForge
- Replacing `grunt-webfonts`
- Rewriting the font build in pure JavaScript
- Eliminating Python entirely
- Removing `twe-svg.zip` or `twe-svg.zip.version.txt` in this pass

Those changes carry real output-drift risk and are separate work.

## Expected Drift

### Allowed

- A one-time binary change after the deterministic ordering rewrite
- Documentation and setup changes
- Python dependency declaration via `pyproject.toml`

### Not Allowed

- Intentional glyph rendering changes
- Ligature regressions
- Palette/layer corruption
- Ongoing build-to-build hash drift for identical inputs

## Verification Strategy

Add a repeatability check that:

1. runs the build once
2. records hashes for the generated `.ttf` and packaged `.woff2`
3. runs the build again without changing inputs
4. asserts that both hashes are identical

Keep `pnpm run verify` as the main local and CI gate.

## Implementation Areas

- `scripts/layerize.js`
  Make input traversal and all emitted structures deterministic.

- `scripts/build-font.js`
  Keep the existing toolchain, but ensure invocation depends only on explicit file paths and stable inputs.

- `package.json`
  Expose any new determinism-check script and keep the Node entrypoints canonical.

- `tsconfig.node.json`
  Keep the JS typechecking boundary explicit while removing redundant `// @ts-check` comments from covered files.

- `pyproject.toml`
  Declare Python build dependencies for `fonttools`.

- `README.md` and `CONTRIBUTE.md`
  Document the canonical deterministic setup and build flow.

- `tests/`
  Add a repeatability test or verification script that catches nondeterministic output.

## Recommendation

Ship this as a focused determinism pass first. It reduces dependency confusion and stabilizes outputs while avoiding the high-risk engine swap that would likely cause real font drift.
