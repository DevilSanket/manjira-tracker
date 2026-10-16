import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { audioManager } from "../../features/audio/AudioManager";
import { useAppStore, type CalibrationSample } from "../../store/useAppStore";
import { audioErrorMessage } from "../../lib/audioErrors";
const steps = [
  "Preparation",
  "Room noise",
  "Murda · open",
  "Tardi · closed",
  "Input delay",
];
export function CalibrationWizard({ onComplete }: { onComplete: () => void }) {
  const { calibration, updateCalibration, selectedAudioDeviceId } =
    useAppStore();
  const [step, setStep] = useState(0);
  const [measuring, setMeasuring] = useState(false);
  const [samples, setSamples] = useState<CalibrationSample[]>([]);
  const [volume, setVolume] = useState(0);
  const [countdown, setCountdown] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const frame = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const captured = useRef<CalibrationSample[]>([]);
  const cleanUp = () => {
    ++generation.current;
    cancelAnimationFrame(frame.current);
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    void audioManager.stop();
  };
  useEffect(() => () => cleanUp(), []);
  const capture = async () => {
    cleanUp();
    const run = generation.current;
    setError(null);
    setMeasuring(true);
    setSamples([]);
    captured.current = [];
    try {
      audioManager.setLoudnessThresholds(
        step === 1 ? 0.015 : calibration.minStrikePeak,
        0.95,
      );
      await audioManager.initialize((raw) => {
        if (run !== generation.current || step === 1) return;
        captured.current.push({
          zcr: raw.zcr,
          crestFactor: raw.crestFactor,
          decayRatio: raw.decayRatio,
          peakProminence: raw.peakProminence,
          sustain: raw.sustain,
        });
        setSamples([...captured.current]);
        setVolume(raw.peakRms);
        if (captured.current.length === 5) {
          const data = [...captured.current];
          const avgZcr =
            data.reduce((sum, sample) => sum + sample.zcr, 0) / data.length;
          updateCalibration(
            step === 2
              ? { openSamples: data, openZcr: avgZcr }
              : { closedSamples: data, closedZcr: avgZcr },
          );
          cleanUp();
          setMeasuring(false);
          setStep(step + 1);
        }
      }, selectedAudioDeviceId);
      if (run !== generation.current) return;
      if (step === 1) {
        const peaks: number[] = [];
        let lastSample = 0;
        const started = performance.now();
        setCountdown(7);
        const read = () => {
          if (run !== generation.current) return;
          const analyser = audioManager.getAnalyser();
          if (analyser) {
            const values = new Float32Array(analyser.fftSize);
            analyser.getFloatTimeDomainData(values);
            const peak = values.reduce(
              (max, value) => Math.max(max, Math.abs(value)),
              0,
            );
            setVolume(peak);
            if (performance.now() - lastSample > 100) {
              peaks.push(peak);
              lastSample = performance.now();
            }
          }
          frame.current = requestAnimationFrame(read);
        };
        frame.current = requestAnimationFrame(read);
        timer.current = setInterval(() => {
          const remaining = Math.max(
            0,
            7 - Math.floor((performance.now() - started) / 1000),
          );
          setCountdown(remaining);
          if (!remaining) {
            const sorted = [...peaks].sort((a, b) => a - b);
            if (!sorted.length) {
              cleanUp();
              setMeasuring(false);
              setError(
                "No audio samples received. Check your input and retry.",
              );
              return;
            }
            const floor = sorted[Math.floor(sorted.length * 0.9)];
            updateCalibration({
              noiseFloor: floor,
              minStrikePeak: Math.max(0.01, Math.min(0.8, floor * 2.5)),
            });
            cleanUp();
            setMeasuring(false);
            setStep(2);
          }
        }, 200);
      }
    } catch (cause) {
      if (run !== generation.current) return;
      cleanUp();
      setMeasuring(false);
      setError(audioErrorMessage(cause));
    }
  };
  return (
    <section className="calibration panel">
      <div className="section-heading">
        <div>
          <h2>Make it sound like you</h2>
          <p>Calibrate for your instrument and selected microphone.</p>
        </div>
      </div>
      <ol className="calibration-steps" aria-label="Calibration progress">
        {steps.map((name, index) => (
          <li
            key={name}
            aria-current={index === step ? "step" : undefined}
            className={index === step ? "active" : index < step ? "done" : ""}
          >
            <span>{index < step ? <Check size={16} /> : index + 1}</span>
            <span>{name}</span>
          </li>
        ))}
      </ol>
      <div className="calibration-content">
        {step === 0 && (
          <>
            <h3>A quiet room. Your usual setup.</h3>
            <p>
              Use the input you practice with. Keep accompaniment and background
              music off during calibration. We’ll measure room noise, then
              capture five strikes of each type.
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <h3>Listen to the room</h3>
            <p>
              Stay quiet for seven seconds. Measurement starts after microphone
              access is granted.
            </p>
            {measuring && (
              <>
                <strong className="countdown">{countdown}s</strong>
                <progress
                  value={Math.min(1, volume)}
                  max={1}
                  aria-label="Microphone level"
                />
              </>
            )}
          </>
        )}
        {(step === 2 || step === 3) && (
          <>
            <img
              className="calibration-demo"
              src={step === 2 ? "/open_strike.gif" : "/close_strike.gif"}
              alt={
                step === 2 ? "Murda strike technique" : "Tardi strike technique"
              }
            />
            <h3>
              {step === 2
                ? "Let the edges ring freely"
                : "Hold the rim to damp the ring"}
            </h3>
            <p>Play five clear strikes with a short pause between each.</p>
            <div
              className="sample-dots"
              aria-label={`${samples.length} of 5 strikes captured`}
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={i < samples.length ? "captured" : ""}>
                  {i < samples.length ? <Check size={18} /> : i + 1}
                </span>
              ))}
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <h3>Adjust only if your hits feel late</h3>
            <p>
              Start at 0 ms for wired inputs. Increase compensation if known
              input or output delay makes accurate hits appear late.
            </p>
            <label htmlFor="latency">
              Delay compensation <strong>{calibration.inputLatency} ms</strong>
            </label>
            <input
              id="latency"
              type="range"
              min="0"
              max="200"
              step="5"
              value={calibration.inputLatency}
              onChange={(e) =>
                updateCalibration({ inputLatency: Number(e.target.value) })
              }
            />
          </>
        )}
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <div className="button-row">
          {measuring ? (
            <button
              className="button secondary"
              onClick={() => {
                cleanUp();
                setMeasuring(false);
              }}
            >
              Cancel capture
            </button>
          ) : (
            <button
              className="button primary"
              onClick={
                step === 0
                  ? () => setStep(1)
                  : step === 4
                    ? onComplete
                    : capture
              }
            >
              {step === 0
                ? "Start calibration"
                : step === 4
                  ? "Save calibration"
                  : error
                    ? "Retry capture"
                    : "Begin capture"}
              <ArrowRight size={17} />
            </button>
          )}
          {step > 0 && !measuring && (
            <button
              className="button ghost"
              onClick={() => {
                cleanUp();
                setStep(0);
                setError(null);
              }}
            >
              <RotateCcw size={16} />
              Start over
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
