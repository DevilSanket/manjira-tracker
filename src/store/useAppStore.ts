import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { appStorage } from "../lib/storage";
import { sanitizePreferences } from "../lib/preferences";
import { timingAccuracy } from "../lib/rhythm";
export type StrikeType = "OPEN" | "CLOSED";
export type TimingVerdict = "PERFECT" | "NEAR" | "MISS";
export interface CalibrationSample {
  zcr: number;
  crestFactor: number;
  decayRatio: number;
  peakProminence: number;
  sustain?: number;
}
export interface StrikeEvent {
  id: string;
  label: StrikeType;
  confidence: number;
  timestamp: number;
  timingDeltaMs: number;
  timingVerdict: TimingVerdict;
  peakRms: number;
  zcr: number;
  decayRatio: number;
  peakFreq?: number;
  peakProminence?: number;
}
export interface SessionStats {
  correctType: number;
  incorrectType: number;
  perfect: number;
  near: number;
  miss: number;
}
export interface SavedSession {
  id: string;
  date: string;
  title: string;
  bpm: number;
  accuracy: number;
  stats: SessionStats;
  strikes?: number;
  scoring?: "type" | "timing" | "free";
}
const emptyStats = (): SessionStats => ({
  correctType: 0,
  incorrectType: 0,
  perfect: 0,
  near: 0,
  miss: 0,
});
export interface AppState {
  isRecording: boolean;
  audioStatus: "idle" | "starting" | "ready" | "error";
  audioError: string | null;
  bpm: number;
  isMetronomeActive: boolean;
  metronomeStartMs: number | null;
  timeSignature: number;
  strikeCount: number;
  accuracy: number;
  combo: number;
  bestCombo: number;
  evaluationCombo: number;
  bestEvaluationCombo: number;
  amplitudeHistory: number[];
  lastStrike: StrikeEvent | null;
  sessionStats: SessionStats;
  completedLessonIds: string[];
  sessions: SavedSession[];
  calibration: {
    noiseFloor: number;
    openZcr: number;
    closedZcr: number;
    minStrikePeak: number;
    maxStrikePeak: number;
    openSamples: CalibrationSample[];
    closedSamples: CalibrationSample[];
    inputLatency: number;
  };
  theme: {
    primary: string;
    secondary: string;
    intensity: number;
    mode: "LIGHT" | "DARK" | "GOLDEN";
  };
  inputMode: "microphone" | "serial";
  selectedAudioDeviceId: string;
  availableAudioDevices: Array<{ deviceId: string; label: string }>;
  isClipping: boolean;
  serialConnected: boolean;
  serialPortName: string;
  serialAdcBits: 10 | 12;
  serialSampleRate: number;
  setAudioStatus: (
    status: AppState["audioStatus"],
    error?: string | null,
  ) => void;
  setRecording: (val: boolean) => void;
  setMetronomeActive: (val: boolean) => void;
  setMetronomeStart: (val: number | null) => void;
  setBpm: (val: number) => void;
  setTimeSignature: (val: number) => void;
  addStrike: (strike: Omit<StrikeEvent, "id">) => void;
  evaluateStrike: (correct: boolean) => void;
  addMissedNotes: (count: number) => void;
  saveSession: (title: string) => void;
  completeLesson: (id: string) => void;
  updateCalibration: (data: Partial<AppState["calibration"]>) => void;
  updateTheme: (intensity: number) => void;
  resetGameplay: () => void;
  setInputMode: (mode: AppState["inputMode"]) => void;
  setSelectedAudioDeviceId: (id: string) => void;
  setAvailableAudioDevices: (
    devices: AppState["availableAudioDevices"],
  ) => void;
  setIsClipping: (val: boolean) => void;
  setSerialConnected: (val: boolean, name?: string) => void;
  setSerialConfig: (bits: 10 | 12, rate: number) => void;
}
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      isRecording: false,
      audioStatus: "idle",
      audioError: null,
      bpm: 100,
      isMetronomeActive: false,
      metronomeStartMs: null,
      timeSignature: 8,
      strikeCount: 0,
      accuracy: 0,
      combo: 0,
      bestCombo: 0,
      evaluationCombo: 0,
      bestEvaluationCombo: 0,
      amplitudeHistory: [],
      lastStrike: null,
      sessionStats: emptyStats(),
      completedLessonIds: [],
      sessions: [],
      calibration: {
        noiseFloor: 0.01,
        openZcr: 0.28,
        closedZcr: 0.15,
        minStrikePeak: 0.015,
        maxStrikePeak: 0.95,
        openSamples: [],
        closedSamples: [],
        inputLatency: 0,
      },
      theme: {
        primary: "#9b6814",
        secondary: "#b28b38",
        intensity: 0,
        mode: "LIGHT",
      },
      inputMode: "microphone",
      selectedAudioDeviceId: "",
      availableAudioDevices: [],
      isClipping: false,
      serialConnected: false,
      serialPortName: "",
      serialAdcBits: 12,
      serialSampleRate: 1000,
      setAudioStatus: (audioStatus, audioError = null) =>
        set({ audioStatus, audioError }),
      setRecording: (isRecording) =>
        set({ isRecording, ...(isRecording ? { audioError: null } : {}) }),
      setMetronomeActive: (isMetronomeActive) => set({ isMetronomeActive }),
      setMetronomeStart: (metronomeStartMs) => set({ metronomeStartMs }),
      setBpm: (bpm) => {
        if (Number.isFinite(bpm))
          set({ bpm: Math.max(40, Math.min(220, Math.round(bpm))) });
      },
      setTimeSignature: (timeSignature) => set({ timeSignature }),
      addStrike: (data) =>
        set((state) => {
          const stats = { ...state.sessionStats };
          if (state.isMetronomeActive) {
            if (data.timingVerdict === "PERFECT") stats.perfect++;
            else if (data.timingVerdict === "NEAR") stats.near++;
            else stats.miss++;
          }
          const combo = data.timingVerdict === "MISS" ? 0 : state.combo + 1;
          return {
            strikeCount: state.strikeCount + 1,
            lastStrike: { ...data, id: crypto.randomUUID() },
            sessionStats: stats,
            amplitudeHistory: [...state.amplitudeHistory, data.peakRms].slice(
              -50,
            ),
            combo,
            bestCombo: Math.max(state.bestCombo, combo),
            accuracy: timingAccuracy(stats),
          };
        }),
      evaluateStrike: (correct) =>
        set((state) => {
          const evaluationCombo = correct ? state.evaluationCombo + 1 : 0;
          return {
            evaluationCombo,
            bestEvaluationCombo: Math.max(
              state.bestEvaluationCombo,
              evaluationCombo,
            ),
            sessionStats: {
              ...state.sessionStats,
              correctType: state.sessionStats.correctType + Number(correct),
              incorrectType:
                state.sessionStats.incorrectType + Number(!correct),
            },
          };
        }),
      addMissedNotes: (count) =>
        set((state) => {
          const sessionStats = {
            ...state.sessionStats,
            miss: state.sessionStats.miss + count,
            incorrectType: state.sessionStats.incorrectType + count,
          };
          return {
            sessionStats,
            combo: 0,
            evaluationCombo: 0,
            accuracy: timingAccuracy(sessionStats),
          };
        }),
      saveSession: (title) => {
        const state = get();
        const total =
          state.sessionStats.correctType + state.sessionStats.incorrectType;
        if (!total && !state.amplitudeHistory.length) return;
        const accuracy = total
          ? (state.sessionStats.correctType / total) * 100
          : state.accuracy;
        const scoring: SavedSession["scoring"] = total
          ? "type"
          : state.sessionStats.perfect +
              state.sessionStats.near +
              state.sessionStats.miss
            ? "timing"
            : "free";
        set({
          sessions: [
            {
              id: crypto.randomUUID(),
              date: new Date().toISOString(),
              title,
              bpm: state.bpm,
              accuracy,
              strikes: state.strikeCount,
              scoring,
              stats: { ...state.sessionStats },
            },
            ...state.sessions,
          ].slice(0, 100),
        });
      },
      completeLesson: (id) =>
        set((state) => ({
          completedLessonIds: [...new Set([...state.completedLessonIds, id])],
        })),
      updateCalibration: (data) =>
        set((state) => ({ calibration: { ...state.calibration, ...data } })),
      updateTheme: (intensity) =>
        set((state) => ({ theme: { ...state.theme, intensity } })),
      resetGameplay: () =>
        set({
          strikeCount: 0,
          combo: 0,
          bestCombo: 0,
          evaluationCombo: 0,
          bestEvaluationCombo: 0,
          accuracy: 0,
          amplitudeHistory: [],
          lastStrike: null,
          sessionStats: emptyStats(),
        }),
      setInputMode: (inputMode) =>
        set({ inputMode, isRecording: false, isMetronomeActive: false }),
      setSelectedAudioDeviceId: (selectedAudioDeviceId) =>
        set({ selectedAudioDeviceId }),
      setAvailableAudioDevices: (availableAudioDevices) =>
        set({ availableAudioDevices }),
      setIsClipping: (isClipping) => set({ isClipping }),
      setSerialConnected: (serialConnected, serialPortName = "") =>
        set({
          serialConnected,
          serialPortName,
          ...(!serialConnected && get().inputMode === "serial"
            ? { isRecording: false, isMetronomeActive: false }
            : {}),
        }),
      setSerialConfig: (serialAdcBits, serialSampleRate) =>
        set({ serialAdcBits, serialSampleRate }),
    }),
    {
      name: "manjira-settings",
      version: 1,
      merge: (saved, current) => ({
        ...current,
        ...sanitizePreferences(saved, current),
      }),
      storage: createJSONStorage(() => appStorage),
      partialize: (state) => ({
        calibration: state.calibration,
        completedLessonIds: state.completedLessonIds,
        sessions: state.sessions,
        bpm: state.bpm,
        timeSignature: state.timeSignature,
        selectedAudioDeviceId: state.selectedAudioDeviceId,
        serialAdcBits: state.serialAdcBits,
        serialSampleRate: state.serialSampleRate,
      }),
    },
  ),
);
