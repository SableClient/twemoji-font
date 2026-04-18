# @sableclient/twemoji-font

Sable-maintained Twemoji COLR font package for web apps.

## Install

```bash
pnpm add @sableclient/twemoji-font
```

## Use the CSS entrypoint

```js
import '@sableclient/twemoji-font';
```

## Use the raw asset

```js
import fontUrl from '@sableclient/twemoji-font/font';
```

## Release flow

1. Add a change file with `knope document-change`, or let the upstream update workflow create one for Twemoji refresh PRs.
2. Merge the change into `master`.
3. CI opens a release PR from `release` with the version bump and changelog updates.
4. Merging that release PR tags the commit, creates the GitHub release, and publishes the package to npm with the repository secret `NPM_TOKEN`.

## Maintainer setup

This repo keeps the upstream font-generation pipeline and packages the generated assets for npm distribution.
Repo-owned build helpers live under `scripts/`.
Use `vp` as the command front-end; repo commands are defined in `package.json`.

Canonical local setup:

1. `vp env install`
2. `vp install`
3. `python -m pip install -e .`
4. Install [FontForge](https://fontforge.github.io/) so `fontforge` and `ffpython` are on `PATH`, or set `FONTFORGE` and `FFPYTHON`.
5. Optional: install native `ttfautohint` or set `TTFAUTOHINT` if you do not want to use the Python wheel fallback.

`python -m pip install -e .` installs `fonttools[woff]` and `ttfautohint-py`. The owned runner still requires native FontForge for raw TTF generation, then uses either `ttfautohint` on `PATH` or `python -m ttfautohint` for hinting.

Build the source font with:

```bash
vp run build:font
```

Run the fast static checks with:

```bash
vp run check
```

Run the linter only with:

```bash
vp run lint
```

Run the formatter only with:

```bash
vp run fmt
```

Run the test suite with:

```bash
vp run test
```

Run the full local verification path with:

```bash
vp run verify
```

Check for new upstream releases with:

```bash
vp run check:upstream
```

Refresh the pinned upstream source cache from the exact current `gh-pages` commit for a release version with:

```bash
vp run prepare:upstream -- 17.0.2
```

That command updates `package.json` `twemoji` metadata and warms `.cache/twemoji/<commit>/svg`.

Repin and update workflow actions with:

```bash
pinact run -u .github/workflows/check-upstream.yml .github/workflows/prepare-release.yml .github/workflows/release.yml
```

Audit workflow security with:

```bash
zizmor .github/workflows/check-upstream.yml .github/workflows/prepare-release.yml .github/workflows/release.yml
```
