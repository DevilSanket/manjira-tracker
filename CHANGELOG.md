# Changelog - Manjira Tracker

All notable changes, architectural overhauls, and feature enhancements to this project are documented below.

---

## [1.3.0] - Complete Offline Hardening & Clerk Decoupling
### Removed
- **Clerk Cloud Authentication**:
  - Uninstalled `@clerk/clerk-react` and removed all cloud auth dependencies.
  - Removed `ClerkProvider` and environment key checks from `src/main.tsx`.
  - Cleaned `VITE_CLERK_PUBLISHABLE_KEY` from `.env.local` and `.env.example`.
- **Cloud Latency & Sign-In Blockers**:
  - Removed cloud sign-in modals and external network authentication gates.

### Added
- **Local Riyaz Student Profile**:
  - Replaced cloud user buttons with a sleek, permanent **"Riyaz Student · Offline Mode"** status badge in the top navigation bar.
  - Direct application boot into `<StrictMode>` with zero network roundtrips or startup delay.

---

## [1.2.0] - Standalone Offline Desktop App (Electron)
### Added
- **Native Windows Desktop Window**:
  - Created native Electron wrapper (`electron/main.cjs` and `electron/preload.cjs`) running a borderless-optional 1280x850 desktop window.
- **Embedded Loopback Static Server**:
  - Solved Chromium's strict local file protocol (`file:///`) security restrictions that block `AudioWorkletNode.addModule()`.
  - Embedded an internal, lightweight Node.js HTTP loopback server binding to `127.0.0.1:0` (ephemeral port), giving full audio worklet and Tone.js sample loading functionality offline.
- **One-Click Windows Launcher**:
  - Created `launch-app.bat` for instant launching from Windows Explorer without opening a command prompt.
- **Desktop NPM Commands**:
  - `npm run app`: Boots the built application in the native Electron desktop window.
  - `npm run app:dev`: Boots development server with hot-reloading in the Electron window.
  - Configured `electron-builder` in `package.json` for Windows distribution.

---

## [1.1.0] - Spectral Dual-Band Strike Detection & Audio Engine Upgrade
### Added
- **Spectral Dual-Band DSP Classifier**:
  - Replaced legacy 128-sample time-domain RMS heuristic with acoustic physics-based spectral discrimination.
  - **1024-Point FFT Peak Prominence**: Measures $\Delta P$ (peak magnitude above the $2.5\text{ kHz} - 8.5\text{ kHz}$ band floor) to differentiate sharp bell harmonics (Open / Ghanti, $\Delta P > 12\text{ dB}$) from broadband hand damping (Closed / Chapti, $\Delta P < 8\text{ dB}$).
  - **High-to-Mid Tone Ratio**: Distinguishes metallic rim resonance from palm slaps and thuds.
  - **Fundamental Resonance Readout**: Computes and displays the exact cymbal pitch frequency (e.g. `3450 Hz`) in real time.
- **Ring Buffer & Latency Reduction**:
  - Implemented a 2048-sample circular buffer in `onset-processor.js`.
  - Reduced post-onset observation window from 120ms to 40ms, cutting strike detection latency by **66%**.
- **1500 Hz Highpass Drum Bleed Filter**:
  - Routed onset detection through a 1500 Hz highpass filter ($Q=0.707$).
  - Blinds detector to Pakhawaj bass frequencies ($C_2 \approx 65\text{ Hz}$, $G_2 \approx 98\text{ Hz}$), speaker bleed, and room rumbles, eliminating false triggers while playing with backing music.

---

## [1.0.0] - Live Studio Redesign & Indian Classical Rhythm Engine
### Added
- **Unified Hero Performance Stage**:
  - Redesigned interface into an obsidian dark-glass stage framed in warm saffron/amber glows.
  - Replaced fragmented debug tiles with a focused visual center stage.
- **Live Matra Beat Ribbon**:
  - Animated horizontal beat ribbon visualizing current beat position, classical Bols (*Dha, Dhin, Ge, Na, Tin, Ta...*), **Sam (Beat 1 / X)**, and **Khali (0)** markers.
- **Multi-Taal Selector**:
  - Native support for Indian classical rhythmic cycles:
    - **Keherwa** (8 Matras)
    - **Dadra** (6 Matras)
    - **Roopak** (7 Matras)
    - **Teentaal** (16 Matras)
    - **4/4 Western Metronome**
- **Authentic Pakhawaj Accompaniment Synthesizer**:
  - Real-time synthesis of theka bols matched to each selected Taal.
- **Interactive Tap Tempo & BPM Fine-Tuning**:
  - Tap tempo button for syncing with live bhajan singing, with $+5 / -5$ BPM nudges.
- **Timing Telemetry & Dynamic AI Coach**:
  - Horizontal Early / On-Beat / Late gauge displaying exact millisecond offsets.
  - Real-time coaching prompts on wrist damping speed, decay, and timing alignment.
- **Sound Check Console**:
  - Instant audition pads: "Hear Ghanti (Open)" and "Hear Chapti (Closed)" with guidance on strike techniques.

### Changed
- **Branding & Header**:
  - Removed "Google AI Studio" branding from the page title and top bar.
  - Integrated custom "MANJIRA TRACKER" identity with dynamic pulsating metronome indicator.
