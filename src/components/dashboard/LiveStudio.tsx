import { useEffect, useState } from "react";
import { Play, Square, Volume2, Settings } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { pakhawajSynth } from "../../services/accompaniment";
import { TAAL_PRESETS } from "../../services/taals";
import { playStrike } from "../../services/strikePlayback";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { InputSettings } from "./InputSettings";
import { CalibrationWizard } from "../calibration/CalibrationWizard";
import { Modal } from "../Modal";

export function LiveStudio({ volume, onVolumeChange }: { volume: number; onVolumeChange: (value: number) => void }) {
  const state = useAppStore();
  const [beat, setBeat] = useState(-1);
  const [settings, setSettings] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [withBeat, setWithBeat] = useState(false);
  const [recap, setRecap] = useState<number | null>(null);
  const [demo, setDemo] = useState<"OPEN" | "CLOSED" | null>(null);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  useEffect(() => pakhawajSynth.addBeatListener(setBeat), []);
  useEffect(() => { if (!state.isMetronomeActive) setBeat(-1); }, [state.isMetronomeActive]);
  const taal = TAAL_PRESETS[state.timeSignature] || TAAL_PRESETS[8];
  const strike = state.lastStrike;
  const calibrated = state.calibration.openSamples.length >= 5 && state.calibration.closedSamples.length >= 5;
  const finish = () => {
    state.setRecording(false);
    state.setMetronomeActive(false);
    setRecap(state.strikeCount);
    state.saveSession("Live studio");
    state.resetGameplay();
  };
  const start = () => {
    setRecap(null);
    setDemo(null);
    state.setRecording(true);
    state.setMetronomeActive(withBeat);
  };
  const tap = () => {
    const now = performance.now();
    const taps = [...tapTimes.filter(t => now - t < 3000), now].slice(-6);
    setTapTimes(taps);
    if (taps.length > 1) state.setBpm(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
  };
  return (
    <div className="play-studio">
      <section className="panel play-stage" aria-label="Manjira play space">
        <span className="status-chip">{state.audioStatus === "ready" ? "Listening" : state.audioStatus === "starting" ? "Getting ready…" : "Ready when you are"}</span>
        <div key={strike?.id || "ready"} className={`play-instrument ${strike ? "struck" : ""} ${strike?.label === "CLOSED" ? "closed" : ""}`} aria-hidden="true">
          {strike?.label === "CLOSED" ? "●" : "◯"}
        </div>
        <h2>{strike ? strike.label === "OPEN" ? "Murda!" : "Tardi!" : "Your turn to play"}</h2>
        <p>{strike ? strike.label === "OPEN" ? "A lovely ringing sound." : "A short, soft sound." : state.audioStatus === "ready" ? "Try a ringing Murda." : "Two little cymbals. So many sounds."}</p>
        {recap !== null && <div className="play-recap" role="status">{recap > 0 ? `You played ${recap} ${recap === 1 ? "strike" : "strikes"}! Your practice is saved.` : "Ready for another try?"}</div>}
        <button className="button primary play-start" onClick={state.isRecording ? finish : start}>
          {state.isRecording ? <Square size={22} /> : <Play size={22} />}
          {state.audioStatus === "starting" ? "Cancel startup" : state.isRecording ? "Finish" : "Start playing"}
        </button>
        {!state.isRecording && state.inputMode === "microphone" && <p className="field-hint">Choose “Allow” if your browser asks to use the microphone.</p>}
        {state.isClipping && <p role="status">Try moving your Manjira a little farther from the microphone.</p>}
      </section>

      <section className="play-sounds" aria-label="Explore the two sounds">
        {(["OPEN", "CLOSED"] as const).map(type => <button key={type} className={`sound-card ${demo === type ? "selected" : ""}`} disabled={state.isRecording} onClick={() => { setDemo(type); void playStrike(type); }}>
          <img src={type === "OPEN" ? "/open_strike.gif" : "/close_strike.gif"} alt={`${type === "OPEN" ? "Murda" : "Tardi"} strike demonstration`} />
          <span><strong>{type === "OPEN" ? "Murda · मुर्दा" : "Tardi · तर्डी"}</strong><span>{type === "OPEN" ? "Let it ring" : "Hold the rims firmly"}</span><small><Volume2 size={16} /> {demo === type ? "Hear it again" : "Hear the sound"}</small></span>
        </button>)}
      </section>
      {state.isRecording && <p className="field-hint play-hint">Finish playing to hear the sound examples.</p>}
      <section className="panel play-beat" aria-label="Optional beat">
        <label className="beat-toggle"><input type="checkbox" checked={withBeat} onChange={e => { setWithBeat(e.target.checked); state.setMetronomeActive(e.target.checked && state.isRecording); }} /><span>Play with a beat</span></label>
        {withBeat && <>
          <div className="segmented play-speeds" aria-label="Beat speed">{[["Slow", 60], ["Medium", 100], ["Fast", 120]].map(([name, bpm]) => <button key={name} aria-pressed={state.bpm === bpm} onClick={() => state.setBpm(Number(bpm))}>{name}</button>)}</div>
          <div className="play-beat-dots" aria-label={`${taal.name}, ${taal.beats} beats`}>{taal.bols.map((_, i) => <span key={i} className={beat === i ? "current" : ""}>{i + 1}</span>)}</div>
          <p className="field-hint">{state.isRecording ? "Follow the moving beat." : "The beat begins when you start playing."} Use headphones so we can hear your Manjira.</p>
        </>}
      </section>
      <button className="button ghost teacher-toggle" aria-expanded={settings} aria-controls="teacher-settings" onClick={() => setSettings(!settings)}><Settings size={18} />Teacher / Parent settings</button>
      {settings && <section id="teacher-settings" className="panel teacher-settings">
        <h2>Practice settings</h2>
        <InputSettings onCalibrate={() => { state.setRecording(false); state.setMetronomeActive(false); setCalibrating(true); }} />
        <p className="field-hint">{calibrated ? "Your calibration is saved" : "Calibrate for your Manjira"} · Delay compensation {state.calibration.inputLatency} ms</p>
        <div className="field-grid">
          <label className="field">Taal<select value={state.timeSignature} onChange={e => state.setTimeSignature(Number(e.target.value))}>{Object.values(TAAL_PRESETS).map(t => <option key={t.id} value={t.beats}>{t.name} · {t.beats} beats</option>)}</select></label>
          <label className="field">Tempo in beats per minute<input type="number" min="40" max="220" value={state.bpm} onChange={e => state.setBpm(Number(e.target.value))} /></label>
          <button className="button secondary" onClick={tap}>{tapTimes.length ? "Tap again" : "Tap tempo"}</button>
          <label className="field">Ambience<input aria-label="Ambience volume" type="range" min="0" max="0.5" step="0.05" value={volume} onChange={e => onVolumeChange(Number(e.target.value))} /></label>
        </div>
        <details><summary>Detailed readings</summary><div className="signal-display"><WaveformVisualizer /></div><p>Strikes played: {state.strikeCount} · Best streak: {state.bestCombo}</p><p>Timing accuracy: {state.sessionStats.perfect + state.sessionStats.near + state.sessionStats.miss ? `${Math.round(state.accuracy)}%` : "—"} · Last timing: {strike && state.isMetronomeActive ? `${strike.timingDeltaMs} ms` : "—"}</p></details>
      </section>}
      {calibrating && <Modal title="Input calibration" onClose={() => setCalibrating(false)}><CalibrationWizard onComplete={() => setCalibrating(false)} /></Modal>}
    </div>
  );
}
