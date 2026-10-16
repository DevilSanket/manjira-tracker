# Manjira Tracker

A local Manjira practice app for Murda (open) and Tardi (closed) strikes, with microphone or USB serial input, pakhawaj accompaniment, guided lessons, calibration, and saved practice history.

## Run it

Use Node.js **22.12 or newer** and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000 in Chrome or Edge. Microphone input requires localhost or HTTPS. Web Serial is supported in Chromium browsers; the app explains unavailable input and permission failures.

For the production web app:

```sh
npm run build
npm start
```

The server binds to `127.0.0.1` by default. Configure `HOST` and `PORT` when hosting elsewhere; use HTTPS for remote microphone access.

## Desktop

```sh
npm run build
npm run app
```

`launch-app.bat` starts the previously built app. For live development with hot reload, use `npm run app:dev`.

Create the Windows portable release with `npm run electron:pack`, or the installer with `npm run electron:dist`. Build Windows releases on Windows and verify them on a clean Windows machine before distributing.

The desktop app serves bundled files from a local loopback address and needs no internet connection. Settings are stored in Electron's user-data directory, so calibration and history survive changes to the loopback port. Web settings use local storage for that browser and origin. Clearing browser data removes web progress; export history from the Progress tab to keep a copy. Up to 100 sessions are kept.

## Practice workflow

1. Select an audio input in Live studio. Click **Start listening** and allow microphone access.
2. Calibrate your instrument in a quiet room: seven seconds of room noise and five strikes of each type. Measurement starts only after access succeeds. Keep accompaniment and ambience off while calibrating.
3. Use headphones with accompaniment to reduce playback triggering the microphone.
4. Choose a taal and tempo in Live studio, or try a lesson and rhythm pattern.
5. Finished lessons and rhythm sessions are saved automatically. Use **Save & reset** for studio practice.

Timing feedback uses the detected onset and the scheduled accompaniment start on a common performance clock. Adjust input-delay compensation only when device delay makes accurate strikes appear late. Basic lessons score strike type at your own pace. Rhythm practice scores each expected note once and counts unplayed notes as misses; rest beats need no strike. Free play is not assigned a timing accuracy.

## USB serial input

See [the serial protocol](docs/serial-protocol.md). Connect USB first, then start listening. Microphone capture stays off in serial mode. Serial readings received while listening is stopped do not change practice scores.

## Check the app

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` runs TypeScript, unit/regression tests, and a production build. Browser tests use fake microphone devices, generated audio, and simulated serial input. CI runs these checks on pushes and pull requests.

See [the release and hardware checklist](docs/validation.md) for physical-device and Windows validation that automated tests cannot replace.

## Interface

The interface uses a quiet brass-and-ink palette, responsive beat layouts, visible keyboard focus, native modal dialogs with restored focus, reduced-motion support, and locally available system fonts. The implementation was informed by [Anthropic's frontend-design skill](https://github.com/anthropics/skills/tree/main/skills/frontend-design), [Material 3 foundations](https://m3.material.io/foundations/), and [WCAG 2.2](https://www.w3.org/TR/WCAG22/). This is not a formal accessibility certification.

TensorFlow is loaded only when calibration samples are available. Strike classification is experimental DSP with optional locally trained ML; displayed results need validation against real instruments and recording setups. The application does not use a remote AI service.
