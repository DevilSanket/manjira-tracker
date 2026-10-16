# Validation and release checks

## Automated coverage

- TypeScript check and production build (`npm run check`).
- Timing boundaries, early hits, tempo conversion, full-session accuracy, duplicate notes, missed notes, rests, serial validation, store snapshots and input switching.
- Worklet captures at 44.1, 48 and 96 kHz using generated decaying waveforms.
- Offline static server asset types, missing assets, malformed paths and path traversal.
- Chromium desktop/mobile navigation, permission denial/retry, start/stop/restart, cancelled startup, modal Escape/focus, persistence/export, simulated serial lifecycle, complete calibration with generated open/closed audio, and rhythm scoring.

Generated signals check the processing pipeline. They do not establish accuracy on physical Manjira strikes. Real labeled recordings are still needed for a confusion matrix, recall, false triggers, and latency measurements.

## Physical audio validation

- Built-in microphone, a USB microphone/interface, and the contact-transducer input you intend to support.
- Permission denied, no device, busy device, unplug/reconnect, and device selection during listening.
- Calibrate both strike types at soft, medium, and strong levels. Verify calibration survives a restart.
- Test a quiet room and a noisy room, plus room speech, cable handling, and table taps. Record false triggers per minute.
- Compare at least 50 labeled open and 50 labeled closed strikes per input/device. Keep a separate held-out set after calibration; report actual classification accuracy rather than treating model confidence as accuracy.
- Test accompaniment through headphones and speakers. Playback may create microphone false triggers.
- Measure wired input/output delay against a reference pulse at slow and fast tempos. Check timing after accompaniment is started before recording, after BPM changes, and after restarting.
- Practice for 30 minutes, switching screens and inputs. Verify no active microphone remains after stopping and that memory does not grow continually.

## TI / USB serial validation

- Match firmware baud rate, ADC bit depth and sample rate to the documented protocol.
- Verify tagged strikes and raw ADC separately; check idle readings do not look like constant hits.
- Exercise malformed lines, missing newlines, disconnect mid-read, reconnect, and cancellation of the port picker.
- Verify desktop port selection on each intended Windows version. Browser mocks cannot validate drivers or Electron's native picker.

## Native desktop smoke test

After building, run `npm run test:desktop`. It launches Electron using an isolated temporary settings directory, verifies the settings bridge, and checks calibration restoration across repeated launches and changing loopback ports. On a headless Linux host, use `xvfb-run -a npm run test:desktop`. `MANJIRA_ELECTRON_EXECUTABLE` can point to a native Electron executable when the checkout's installed runtime belongs to another operating system. Install dependencies on the target OS with `npm ci`; do not share a Windows `node_modules` folder with Linux.

The implementation was smoke-tested with Electron 44.4.1 on Linux. Windows installer, microphone drivers, and native USB port selection still need validation on Windows hardware.

## Windows release

1. On Windows, run `npm ci`, `npm run check`, and `npm run test:e2e`.
2. Build with `npm run electron:pack` or `npm run electron:dist`.
3. Launch on a clean Windows machine without Node.js installed.
4. Disconnect internet; verify images, strike playback, accompaniment, and lessons.
5. Check system microphone permissions and USB serial selection.
6. Complete calibration and a session, quit, and relaunch. Verify progress and calibration survived the changed loopback port.
7. Verify closing the app stops input and its local server; verify asset failures are reported rather than returning HTML as audio or worklet files.
8. Check keyboard navigation, 200% zoom, narrow windows and reduced-motion preferences.

## Dependency advisories

A compatible `npm audit fix` removed the high and critical advisories reported during implementation. Ten moderate transitive advisories remain through `sprintf-js` in TensorFlow CLI and Electron build tooling. The suggested forced fixes include downgrading TensorFlow and changing Electron packaging dependencies. Re-evaluate upstream fixes before a release instead of applying an untested forced downgrade.

## Design references

- [Frontend design skill](https://github.com/anthropics/skills/tree/main/skills/frontend-design): subject-specific design, restrained motion, and clear action/error copy.
- [Material 3 foundations](https://m3.material.io/foundations/): consistent layout, interaction states, and reusable design tokens.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): visible focus, readable contrast, keyboard operation and adequate target sizes. Formal conformance still requires a full audit.
