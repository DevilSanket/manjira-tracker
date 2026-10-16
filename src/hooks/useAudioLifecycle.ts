import { useEffect } from "react";
import { audioManager } from "../features/audio/AudioManager";
import { serialManager } from "../services/serialManager";
import { pakhawajSynth } from "../services/accompaniment";
import { useAppStore } from "../store/useAppStore";
import { timingAt } from "../lib/rhythm";
import { audioErrorMessage } from "../lib/audioErrors";

export function processStrikeEvent(raw: any, source: "microphone" | "serial") {
  const state = useAppStore.getState();
  if (
    !state.isRecording ||
    state.audioStatus !== "ready" ||
    state.inputMode !== source
  )
    return;
  const timestamp =
    (raw.timestamp ?? performance.now()) - state.calibration.inputLatency;
  const timing =
    state.metronomeStartMs !== null && state.isMetronomeActive
      ? timingAt(timestamp, state.metronomeStartMs, state.bpm)
      : { delta: 0, verdict: "PERFECT" as const };
  if (
    state.isMetronomeActive &&
    (state.metronomeStartMs === null ||
      timestamp < state.metronomeStartMs - 150)
  )
    return;
  state.addStrike({
    label: raw.type,
    confidence: raw.confidence,
    timestamp,
    timingDeltaMs: Math.round(timing.delta),
    timingVerdict: timing.verdict,
    peakRms: raw.peakRms ?? raw.peak ?? 0,
    zcr: raw.zcr ?? 0,
    decayRatio: raw.decayRatio ?? 0,
    peakFreq: raw.peakFreq,
    peakProminence: raw.peakProminence,
  });
}
export function useAudioLifecycle() {
  const {
    isRecording,
    inputMode,
    selectedAudioDeviceId,
    calibration,
    serialConnected,
    isMetronomeActive,
    bpm,
    timeSignature,
    audioStatus,
  } = useAppStore();
  useEffect(() => {
    audioManager.setLoudnessThresholds(
      calibration.minStrikePeak,
      calibration.maxStrikePeak,
    );
    void audioManager
      .setCalibrationSamples(calibration.openSamples, calibration.closedSamples)
      .catch(console.error);
  }, [
    calibration.openSamples,
    calibration.closedSamples,
    calibration.minStrikePeak,
    calibration.maxStrikePeak,
  ]);
  useEffect(() => {
    serialManager.setStrikeCallback((raw) => processStrikeEvent(raw, "serial"));
    const onDeviceChange = () => void audioManager.refreshAvailableDevices();
    navigator.mediaDevices?.addEventListener("devicechange", onDeviceChange);
    return () => {
      serialManager.setStrikeCallback(null);
      navigator.mediaDevices?.removeEventListener(
        "devicechange",
        onDeviceChange,
      );
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const state = useAppStore.getState();
    if (!isRecording) {
      void audioManager.stop();
      if (state.audioStatus !== "error") state.setAudioStatus("idle");
      return;
    }
    state.setAudioStatus("starting");
    if (inputMode === "serial") {
      void audioManager.stop();
      if (serialConnected) state.setAudioStatus("ready");
      else {
        state.setRecording(false);
        state.setMetronomeActive(false);
        state.setAudioStatus(
          "error",
          "Connect your USB serial device before starting.",
        );
      }
    } else {
      void audioManager
        .initialize(
          (raw) => processStrikeEvent(raw, "microphone"),
          selectedAudioDeviceId,
        )
        .then(() => {
          if (!cancelled) useAppStore.getState().setAudioStatus("ready");
        })
        .catch((error) => {
          if (cancelled) return;
          const current = useAppStore.getState();
          current.setRecording(false);
          current.setMetronomeActive(false);
          current.setAudioStatus("error", audioErrorMessage(error));
        });
    }
    return () => {
      cancelled = true;
      void audioManager.stop();
    };
  }, [isRecording, inputMode, selectedAudioDeviceId, serialConnected]);
  useEffect(() => {
    if (!isMetronomeActive || (isRecording && audioStatus !== "ready")) {
      pakhawajSynth.stop();
      useAppStore.getState().setMetronomeStart(null);
      return;
    }
    void pakhawajSynth.start(bpm, timeSignature).catch((error) => {
      const state = useAppStore.getState();
      state.setMetronomeActive(false);
      state.setAudioStatus("error", audioErrorMessage(error));
    });
    return () => {
      pakhawajSynth.stop();
      useAppStore.getState().setMetronomeStart(null);
    };
  }, [isMetronomeActive, isRecording, audioStatus, bpm, timeSignature]);
  return { isInitialized: audioStatus === "ready" };
}
