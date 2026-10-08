# AGENTS.md

Working instructions for this repository — Benson Fung's personal site.

## Overview

- Static site built with Eleventy 3 (ESM config in `eleventy.config.js`).
- `src/` is the source; `docs/` is the generated output that GitHub Pages serves.
- One shared layout: `src/_includes/base.njk`. Global site data (name, canonical URL): `src/_data/site.json`.
- Root passthrough files: `robots.txt`, `.nojekyll` (Pages serves the site as plain static files, not Jekyll).

## Development & operations

- Install: `npm install`
- Local preview: `npm run dev` (Eleventy dev server with hot reload)
- Build: `npm run build` — writes to `docs/`
- **Always commit the generated `docs/` output alongside source changes.** Pages deploys from `docs/` on `master`; a source-only commit leaves the live site stale.
- **Never hand-edit files in `docs/`.** Change `src/` and rebuild.
- After editing, run `npm run build` and sanity-check the changed `docs/*.html` before committing.
- Push to `master`; Pages redeploys automatically from `docs/`.

## Site style and design

- CSS architecture: cascade layers — `reset`, `base`, `theme`, `components`, `utilities` — in `src/assets/css/style.css`. Keep new styles in the correct layer; component styles belong in `components`.
- Theming: color comes from CSS custom properties in the `theme` layer. Light and dark modes switch via the `data-theme` attribute on `<html>`; `src/assets/js/main.js` defaults to the OS `prefers-color-scheme` and persists an explicit user choice in localStorage. New UI must work in both themes.
- Color: OKLCH palette — deep indigo accents in light mode, teal-blue accents in dark mode.
- Typography: Outfit for headings, Inter for body, each with system-ui fallbacks. No icon fonts; use inline SVG where icons are needed.
- Layout: fluid, responsive, mobile-first. The resume page has a dedicated print stylesheet — keep print output clean.
- Accessibility: semantic HTML, skip-to-content link, real `alt` text on images, keyboard-reachable controls.
- SEO basics live in the shared layout: canonical URL, Open Graph + Twitter cards, JSON-LD Person schema, `sitemap.xml`, `robots.txt`. Keep metadata current when URLs or page purposes change.

## Conventions

- Pages are Nunjucks templates (`.njk`) with front matter (`title`, `description`) consumed by the layout.
- Assets live under `src/assets/` and are passthrough-copied to `docs/assets/`.
- Reference global data from `src/_data/site.json` rather than hardcoding the site URL in templates.
