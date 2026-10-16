import { useEffect, useState } from "react";
import { Mic, Usb, SlidersHorizontal } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { audioManager } from "../../features/audio/AudioManager";
import { serialManager } from "../../services/serialManager";
export function InputSettings({ onCalibrate }: { onCalibrate?: () => void }) {
  const state = useAppStore();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => void audioManager.refreshAvailableDevices();
    refresh();
    navigator.mediaDevices?.addEventListener("devicechange", refresh);
    return () =>
      navigator.mediaDevices?.removeEventListener("devicechange", refresh);
  }, []);
  const connect = async () => {
    setError(null);
    setConnecting(true);
    try {
      await serialManager.connect();
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === "NotFoundError"))
        setError(
          cause instanceof Error
            ? cause.message
            : "USB connection failed. Try again.",
        );
    } finally {
      setConnecting(false);
    }
  };
  return (
    <section className="input-settings" aria-label="Audio input settings">
      <div className="input-top">
        <div className="segmented" aria-label="Input source">
          <button
            aria-pressed={state.inputMode === "microphone"}
            onClick={() => state.setInputMode("microphone")}
          >
            <Mic size={16} />
            Microphone
          </button>
          <button
            aria-pressed={state.inputMode === "serial"}
            onClick={() => state.setInputMode("serial")}
          >
            <Usb size={16} />
            USB serial
          </button>
        </div>
        {onCalibrate && (
          <button
            className="button secondary"
            disabled={state.inputMode !== "microphone" || connecting}
            onClick={onCalibrate}
          >
            <SlidersHorizontal size={16} />
            Calibrate input
          </button>
        )}
      </div>
      {state.inputMode === "microphone" ? (
        <label className="field">
          Audio input
          <select
            value={state.selectedAudioDeviceId}
            onChange={(e) => state.setSelectedAudioDeviceId(e.target.value)}
          >
            <option value="">System default microphone</option>
            {state.availableAudioDevices
              .filter((d) => d.deviceId !== "default")
              .map((d) => (
                <option value={d.deviceId} key={d.deviceId}>
                  {d.label}
                </option>
              ))}
          </select>
          <span className="field-hint">
            USB audio interfaces and transducers connected through a sound card
            use this input. Device names appear after microphone access is
            allowed.
          </span>
        </label>
      ) : (
        <>
          <div className="serial-row">
            <p>
              {state.serialConnected
                ? state.serialPortName
                : "No USB serial device connected"}
            </p>
            <button
              className="button secondary"
              disabled={connecting}
              onClick={
                state.serialConnected
                  ? () => void serialManager.disconnect()
                  : connect
              }
            >
              {connecting
                ? "Choosing device…"
                : state.serialConnected
                  ? "Disconnect USB"
                  : "Connect USB"}
            </button>
          </div>
          {!serialManager.isSupported() && (
            <p className="error-message">
              USB serial requires Chrome, Edge, or the desktop app.
            </p>
          )}
          <details>
            <summary>Raw ADC settings</summary>
            <div className="field-grid">
              <label className="field">
                ADC resolution
                <select
                  value={state.serialAdcBits}
                  disabled={state.serialConnected}
                  onChange={(e) =>
                    state.setSerialConfig(
                      Number(e.target.value) as 10 | 12,
                      state.serialSampleRate,
                    )
                  }
                >
                  <option value="12">12 bit (0–4095)</option>
                  <option value="10">10 bit (0–1023)</option>
                </select>
              </label>
              <label className="field">
                Samples per second
                <input
                  type="number"
                  min="200"
                  max="2000"
                  step="100"
                  value={state.serialSampleRate}
                  disabled={state.serialConnected}
                  onChange={(e) => {
                    const rate = Number(e.target.value);
                    if (rate >= 200 && rate <= 2000)
                      state.setSerialConfig(state.serialAdcBits, rate);
                  }}
                />
              </label>
            </div>
            <p className="field-hint">
              Match the firmware settings before connecting. Raw ADC
              classification is experimental; classified OPEN/CLOSED telemetry
              is preferred.
            </p>
          </details>
        </>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
