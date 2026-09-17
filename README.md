# 🔔 Manjira Tracker

An advanced, real-time rhythm tracking and Riyaz companion designed for Indian classical **Manjira / Taal** percussion. Built with acoustic DSP spectral analysis, support for physical **clip-on contact transducers** (and Texas Instruments microcontroller ADC telemetry), authentic **Pakhawaj synthesis**, and dual **Online Web / 100% Offline Desktop** modes.

---

## ✨ Features

- **Dual-Mode Architecture (Online & Offline)**:
  - **Online Web App**: Runs in any modern browser (`Chrome`, `Edge`, etc.) with Web Audio & Web Serial support.
  - **100% Offline Desktop App**: Native Windows Electron window with an embedded local loopback server (`127.0.0.1`), requiring zero internet connection.
- **Spectral Dual-Band Strike Classifier**:
  - Distinguishes **Open (*Ghanti*)** ringing strikes from **Closed (*Chapti*)** damped strikes using 1024-point FFT spectral prominence ($\Delta P$) in the $2.5\text{ kHz} - 8.5\text{ kHz}$ bell resonance band.
  - Logarithmic mechanical damping factor ($\alpha$) specifically tuned for physical contact vibration physics.
  - Sub-40ms latency detection for rapid Bhajan tempos.
  - Real-time fundamental cymbal resonance frequency readout (e.g. `3450 Hz`).
- **Hardware Ingestion for Clip-On Transducers**:
  - **Audio Device Picker**: Select your exact soundcard, USB audio interface, or line-in preamp.
  - **Texas Instruments (TI) Microcontroller Support**: Direct digital ADC telemetry via Web Serial API (`navigator.serial`) at 115200 baud.
  - **Transducer Cable Rumble Filter**: 100 Hz highpass filter strips mechanical cord drag and handling friction.
  - **Anti-Clipping Monitor**: Detects signal saturation and warns users to adjust transducer gain before distortion alters classification.
- **Live Studio & Indian Classical Taal Engine**:
  - Interactive **Matra Beat Ribbon** with classical Bols (*Dha, Dhin, Ge, Na, Tin, Ta...*), **Sam ($X$)**, and **Khali ($0$)** markers.
  - 5 rhythmic cycles: **Keherwa** (8), **Dadra** (6), **Roopak** (7), **Teentaal** (16), and **4/4 Western**.
  - Authentic procedural **Pakhawaj accompaniment synthesizer**.
  - **Tap Tempo Engine** and Early/On-Beat/Late millisecond precision gauge.
  - Dynamic **AI Technique Coach** and interactive sound check audition pads.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### Installation
```bash
npm install
```

---

## 🖥️ Running the Application

### 1. Offline Desktop App (Windows)
- **Option A (One-Click):** Double-click `launch-app.bat` in the project root.
- **Option B (Terminal):**
  ```bash
  npm run app
  ```
- **Option C (Live Dev Mode with Hot-Reload):**
  ```bash
  npm run app:dev
  ```

### 2. Online / Local Web Browser App
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in Chrome or Edge.

---

## 🎛️ Connecting Clip-On Transducers

1. **Via 3.5mm Mic / USB Soundcard / Preamp:**
   - Plug your contact transducer into your computer's audio input.
   - Open **Live Studio** and select your interface from the **Transducer Ingestion** dropdown.
   - Strike the cymbals and check the clipping indicator.
2. **Via Texas Instruments (TI) Microcontroller (USB Serial):**
   - Connect your TI LaunchPad / MSP / C2000 board running ADC firmware over USB.
   - Click **Connect TI USB** in the Transducer Ingestion bar and select the COM port.
   - Vibration telemetry streams directly into the DSP engine!

---

## 📜 Version History

See [CHANGELOG.md](CHANGELOG.md) for full release notes and architectural evolution.
