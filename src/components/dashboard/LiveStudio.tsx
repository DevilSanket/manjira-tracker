import { useEffect, useState } from "react";
import {
  Play,
  Square,
  Volume2,
  RotateCcw,
  Mic,
  Activity,
  Headphones,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { pakhawajSynth } from "../../services/accompaniment";
import { TAAL_PRESETS } from "../../services/taals";
import { playStrike } from "../../services/strikePlayback";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { InputSettings } from "./InputSettings";
import { CalibrationWizard } from "../calibration/CalibrationWizard";
import { Modal } from "../Modal";
export function LiveStudio() {
  const state = useAppStore();
  const [beat, setBeat] = useState(-1);
  const [calibrating, setCalibrating] = useState(false);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [lastTap, setLastTap] = useState(false);
  useEffect(() => pakhawajSynth.addBeatListener(setBeat), []);
  useEffect(() => {
    if (!state.isMetronomeActive) setBeat(-1);
  }, [state.isMetronomeActive]);
  const taal = TAAL_PRESETS[state.timeSignature] || TAAL_PRESETS[8];
  const strike = state.lastStrike;
  const total =
    state.sessionStats.perfect +
    state.sessionStats.near +
    state.sessionStats.miss;
  const calibrated =
    state.calibration.openSamples.length >= 5 &&
    state.calibration.closedSamples.length >= 5;
  const tap = () => {
    const now = performance.now();
    const taps = [...tapTimes.filter((t) => now - t < 3000), now].slice(-6);
    setTapTimes(taps);
    setLastTap(true);
    if (taps.length > 1)
      state.setBpm(
        60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)),
      );
  };
  const calibrate = () => {
    state.setRecording(false);
    state.setMetronomeActive(false);
    setCalibrating(true);
  };
  return (
    <div className="studio-layout">
      <div className="studio-main">
        <section className="panel pulse-panel">
          <div className="section-heading">
            <div>
              <h2>Your rhythm, one beat at a time</h2>
              <p>Choose a taal, settle into the pulse, and play.</p>
            </div>
            <span
              className={`status-chip ${state.isMetronomeActive ? "positive" : ""}`}
            >
              {state.isMetronomeActive ? "Accompaniment on" : "Free play"}
            </span>
          </div>
          <div className="tempo-controls">
            <label className="field taal-field">
              Taal
              <select
                value={state.timeSignature}
                onChange={(e) => state.setTimeSignature(Number(e.target.value))}
              >
                {Object.values(TAAL_PRESETS).map((t) => (
                  <option key={t.id} value={t.beats}>
                    {t.name} · {t.beats} beats
                  </option>
                ))}
              </select>
            </label>
            <label className="field tempo-field">
              Tempo
              <div className="tempo-number">
                <input
                  aria-label="Tempo in beats per minute"
                  type="number"
                  min="40"
                  max="220"
                  value={state.bpm}
                  onChange={(e) => state.setBpm(Number(e.target.value))}
                />
                <span>bpm</span>
              </div>
            </label>
            <button className="button secondary" onClick={tap}>
              {lastTap ? "Tap again" : "Tap tempo"}
            </button>
            <button
              className={`button ${state.isMetronomeActive ? "secondary" : "primary"}`}
              onClick={() => state.setMetronomeActive(!state.isMetronomeActive)}
            >
              {state.isMetronomeActive ? (
                <Square size={16} />
              ) : (
                <Play size={16} />
              )}
              {state.isMetronomeActive
                ? "Stop accompaniment"
                : "Play accompaniment"}
            </button>
          </div>
          <input
            aria-label="Tempo"
            className="tempo-slider"
            type="range"
            min="40"
            max="220"
            value={state.bpm}
            onChange={(e) => state.setBpm(Number(e.target.value))}
          />
          <div
            className="beat-ribbon"
            style={{
              gridTemplateColumns: `repeat(${taal.beats}, minmax(42px, 1fr))`,
            }}
            aria-label={`${taal.name} beat cycle`}
          >
            {taal.bols.map((bol, i) => {
              const marker = taal.vibhags.find((v) => v.startBeat === i);
              return (
                <div
                  key={i}
                  className={`beat-cell ${beat === i ? "current" : ""} ${marker?.type === "sam" ? "sam" : ""}`}
                >
                  <span className="beat-marker">
                    {marker?.type === "sam"
                      ? "Sam"
                      : marker?.type === "khali"
                        ? "Khali"
                        : "\u00a0"}
                  </span>
                  <strong>{i + 1}</strong>
                  <span>{bol}</span>
                </div>
              );
            })}
          </div>
          <div className="ribbon-caption">
            <span>{taal.description}</span>
            <span>Division {taal.division}</span>
          </div>
        </section>
        <section className="panel signal-panel">
          <div className="section-heading">
            <div>
              <h2>Listen. Strike. Refine.</h2>
              <p>
                {state.inputMode === "serial"
                  ? "Strikes arrive from your connected USB controller."
                  : "Your input signal and most recent strike."}
              </p>
            </div>
            <span
              className={`status-chip ${state.audioStatus === "ready" ? "positive" : ""}`}
            >
              <Mic size={14} />
              {state.audioStatus === "ready"
                ? "Listening"
                : state.audioStatus === "starting"
                  ? "Starting input"
                  : "Input idle"}
            </span>
          </div>
          <div className="signal-display">
            <WaveformVisualizer />
            <div className="signal-empty">
              {state.audioStatus !== "ready"
                ? "Start listening to see your input"
                : state.inputMode === "serial"
                  ? "Waveform is available for microphone input"
                  : ""}
            </div>
          </div>
          <div className="strike-readout">
            <div
              className={`strike-symbol ${strike?.label === "CLOSED" ? "closed" : ""}`}
            >
              {strike?.label === "CLOSED" ? "●" : "◯"}
            </div>
            <div>
              <span className="readout-label">Last strike</span>
              <h3>
                {strike
                  ? strike.label === "OPEN"
                    ? "Murda"
                    : "Tardi"
                  : "Ready when you are"}
              </h3>
              <p>
                {strike
                  ? strike.label === "OPEN"
                    ? "Open, ringing strike"
                    : "Closed, damped strike"
                  : "Play an open or closed strike to begin."}
              </p>
            </div>
            <div className="strike-detail">
              <span className="readout-label">Timing</span>
              <strong>
                {strike && state.isMetronomeActive
                  ? `${strike.timingDeltaMs > 0 ? "+" : ""}${strike.timingDeltaMs} ms`
                  : "—"}
              </strong>
              <span>
                {strike && state.isMetronomeActive
                  ? strike.timingVerdict === "PERFECT"
                    ? "On the beat"
                    : strike.timingDeltaMs < 0
                      ? "Early"
                      : "Late"
                  : "Enable accompaniment"}
              </span>
            </div>
          </div>
          {state.isClipping && (
            <p className="error-message" role="status">
              Input is clipping. Lower your microphone or preamp gain for
              clearer strikes.
            </p>
          )}
          <div className="studio-stats">
            <div>
              <span>Timing accuracy</span>
              <strong>{total ? `${Math.round(state.accuracy)}%` : "—"}</strong>
            </div>
            <div>
              <span>Strikes played</span>
              <strong>{state.strikeCount}</strong>
            </div>
            <div>
              <span>Best streak</span>
              <strong>{state.bestCombo}</strong>
            </div>
            <button
              className="button ghost"
              onClick={() => {
                state.saveSession("Live studio");
                state.resetGameplay();
              }}
            >
              <RotateCcw size={15} />
              Save & reset
            </button>
          </div>
        </section>
        <div className="practice-note">
          <Headphones size={20} />
          <p>
            Use headphones when playing accompaniment. This helps the microphone
            hear your Manjira clearly.
          </p>
        </div>
      </div>
      <aside className="studio-aside">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Set up your input</h2>
              <p>A clear signal makes a better practice.</p>
            </div>
          </div>
          <InputSettings onCalibrate={calibrate} />
          <div className="calibration-status">
            <Activity size={16} />
            <span>
              {calibrated
                ? "Your calibration is saved"
                : "Calibrate for your Manjira"}
            </span>
          </div>
        </section>
        <section className="panel technique-panel">
          <div className="section-heading">
            <div>
              <h2>Two sounds. One instrument.</h2>
              <p>Hear and see the difference.</p>
            </div>
          </div>
          {(["OPEN", "CLOSED"] as const).map((type) => (
            <div className="technique-row" key={type}>
              <img
                src={type === "OPEN" ? "/open_strike.gif" : "/close_strike.gif"}
                alt={`${type === "OPEN" ? "Murda" : "Tardi"} strike demonstration`}
              />
              <div>
                <h3>{type === "OPEN" ? "Murda · मुर्दा" : "Tardi · तर्डी"}</h3>
                <p>
                  {type === "OPEN"
                    ? "Let the edges ring freely."
                    : "Hold the rim to damp the ring."}
                </p>
                <button
                  className="button ghost"
                  onClick={() => void playStrike(type)}
                >
                  <Volume2 size={15} />
                  Hear {type === "OPEN" ? "Murda" : "Tardi"}
                </button>
              </div>
            </div>
          ))}
        </section>
      </aside>
      {calibrating && (
        <Modal title="Input calibration" onClose={() => setCalibrating(false)}>
          <CalibrationWizard onComplete={() => setCalibrating(false)} />
        </Modal>
      )}
    </div>
  );
}
