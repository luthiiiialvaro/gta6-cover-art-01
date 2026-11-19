# Vice Cover Lab

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/luthiiiialvaro/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/luthiiiialvaro/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline web app that turns your photo and a caption into cover art in
the style of GTA 6's posters — diagonal multi-panel layouts, bold condensed
lettering and a Vice City sunset or neon grade — and exports it as a PNG to
share. Your photos never leave your machine: everything runs from static
files in `app/`, with no network request.

## How it works

1. **Drop a photo** (up to 3) or try a sample photo.
2. **Pick a layout** — Hero, Diagonal Duo, Triple Strip or Quad Grid — and a
   **grade** — Vice Sunset, Neon Nights, Ocean Drive or Palm Noir.
3. **Crop and position** each panel: drag the preview to pan, scroll to
   zoom, or use the sliders. Choose one photo across all panels, or a
   different photo per panel. Edit the caption live.
4. **Export PNG** in Square 1080 x 1080, Portrait 1080 x 1350 or Landscape
   1920 x 1080. "Surprise me" rolls a random layout, grade and caption.

Panels without a photo are filled with a code-drawn Vice City scene — sky,
sun, skyline and palms — so every cover looks finished even with a plain
photo. The caption is set in Anton (SIL OFL, shipped under `app/fonts/`)
with an outline and a drop shadow.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/`
to the output directory and writes `dossier.json` with the vendored
make.fun library.

## Files

- `app/index.html` — the editor page
- `app/style.css` — the dark editor theme
- `app/src/main.js` — photo loading, controls, preview, export
- `app/src/cover.js` — the cover renderer (panels, scenes, grades, caption)
- `app/src/shots.js` — fixed `?shot=` scenes for screenshots
- `app/fonts/anton.woff2` — Anton, SIL Open Font License (`OFL.txt`)
- `app/samples/` — sample photos, free to use
- `screenshots/` — the 4 screenshots (see `shots.json`)
- `main.ts`, `serve.ts`, `vendor/makefun-app.ts` — hand-in plumbing

## License

MIT. Anton is licensed under the SIL Open Font License 1.1
(`app/fonts/OFL.txt`). No Rockstar Games logo, artwork or font is used.
