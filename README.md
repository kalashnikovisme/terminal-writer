# terminal-writer
Terminal-writer will help courses writers to render video with a practice easy

## Install

```
make install
```

## How to use

Open index.html in your browser

## Render a scenario to mp4

```
npm install
npm run render -- --scenario scenarios/tramway/2-1-1/2-1-1.1.tss --output tramway-2.1.1.mp4
```

Notes:
- The renderer uses Playwright to drive the browser and `ffmpeg` to convert the recording to mp4.
- Use `--headful` to watch the browser while it renders.
