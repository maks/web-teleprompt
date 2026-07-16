# Web Teleprompter

Write scripts in markdown and play them back as a scrolling teleprompter. A no-build, vanilla-JS PWA — works offline once loaded.

## Features

- Markdown scripts (headings, bold, italic, bullets) with autosave to localStorage
- Fullscreen auto-scrolling prompter with speed control, pause, and manual scroll
- Optional screen wake lock while scrolling
- Installable PWA, offline-capable via service worker

## Development

No build step and no dependencies. Serve the folder with any static server (ES modules don't load from `file://`):

```sh
python3 -m http.server
# or: npx serve
```

### Tests

```sh
node --test
```

### Type checking

The JS is type-checked with TypeScript via JSDoc annotations — no build, no compile step. Checking is opt-in per file with `// @ts-check`; `jsconfig.json` holds the compiler settings (`checkJs` is off so unchecked files stay quiet).

```sh
npx --yes -p typescript tsc -p jsconfig.json
```

## Deployment

Pushing to `main` runs type checking and tests, then deploys to GitHub Pages (`.github/workflows/deploy.yml`).

When changing any file listed in `ASSETS` in `sw.js`, bump the `CACHE` version in the same commit so deployed clients pick up the new files.
