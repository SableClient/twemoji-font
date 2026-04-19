Thank you for your interest in contributing.

Release maintenance is scripted now. Use the commands in [README.md](./README.md) instead of editing browser test fixtures by hand.
Repo-owned build helpers live under `scripts/`.

Toolchain setup:

1. Run `vp env install`.
2. Run `vp install`.
3. Run `python -m pip install -e .` to install `fonttools[woff]` and `ttfautohint-py`.
4. Install FontForge so `fontforge` is available.
5. Optional: install native `ttfautohint` if you do not want to use the Python wheel fallback.

Typical flow:

1. Run `knope document-change` to create a release note file in `.changeset/` for any user-facing change.
2. Run `vp run check:upstream` to see whether Twemoji has a newer release.
3. Run `vp run prepare:upstream -- <version>` after you decide to refresh the pinned upstream source.
4. That command updates `package.json` `twemoji` metadata and warms `.cache/twemoji/<commit>/svg` from the exact current `gh-pages` commit.
5. Run `vp run check`.
6. Run `vp run lint` and `vp run fmt` if you want the individual Vite+ passes.
7. Run `vp run test`.
8. Run `vp run verify` to rebuild the font, run Vite+ tests, run typechecks, and smoke-test the package output.

Release automation:

1. Merge changes with a `.changeset` entry into `master`.
2. `.github/workflows/prepare-release.yml` opens or updates the release PR.
3. Merging the release PR runs `.github/workflows/release.yml`, which tags the release, creates the GitHub release, uploads a release zip with the `ttf` and `woff2` files, and publishes to npm.

The built font lands in `build/Twemoji Mozilla.ttf`. The publishable package files land in `dist/`. The GitHub release asset archive lands in `build/twemoji-font-<version>.zip`.
