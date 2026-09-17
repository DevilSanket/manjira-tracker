import { create } from 'zustand';

export type StrikeType = 'OPEN' | 'CLOSED';
export type TimingVerdict = 'PERFECT' | 'NEAR' | 'MISS';

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

interface AppState {
  isRecording: boolean;
  bpm: number;
  isMetronomeActive: boolean;
  timeSignature: number;
  accuracy: number;
  combo: number;
  amplitudeHistory: number[];
  lastStrike: StrikeEvent | null;
  sessionStats: {
    correctType: number;
    incorrectType: number;
    perfect: number;
    near: number;
    miss: number;
  };
  completedLessonIds: string[];
  calibration: {
    noiseFloor: number;
    openZcr: number;
    closedZcr: number;
    minStrikePeak: number;
    maxStrikePeak: number;
    openSamples: any[];
    closedSamples: any[];
    inputLatency: number;
  };
  theme: {
    primary: string;
    secondary: string;
    intensity: number;
    mode: 'LIGHT' | 'DARK' | 'GOLDEN';
  };
  
  // Hardware & Transducer Settings
  inputMode: 'microphone' | 'serial';
  selectedAudioDeviceId: string;
  availableAudioDevices: Array<{ deviceId: string; label: string }>;
  isClipping: boolean;
  serialConnected: boolean;
  serialPortName: string;
  
  // Actions
  setRecording: (val: boolean) => void;
  setMetronomeActive: (val: boolean) => void;
  setBpm: (val: number) => void;
  setTimeSignature: (val: number) => void;
  addStrike: (strike: Omit<StrikeEvent, 'id'>) => void;
  evaluateStrike: (wasCorrectType: boolean) => void;
  completeLesson: (id: string) => void;
  updateCalibration: (data: Partial<AppState['calibration']>) => void;
  updateTheme: (intensity: number) => void;
  resetGameplay: () => void;
  setInputMode: (mode: 'microphone' | 'serial') => void;
  setSelectedAudioDeviceId: (id: string) => void;
  setAvailableAudioDevices: (devices: Array<{ deviceId: string; label: string }>) => void;
  setIsClipping: (val: boolean) => void;
  setSerialConnected: (val: boolean, portName?: string) => void;
}


export const useAppStore = create<AppState>((set) => ({
  isRecording: false,
  bpm: 100,
  isMetronomeActive: false,
  timeSignature: 4,
  accuracy: 0,
  combo: 0,
  amplitudeHistory: [],
  lastStrike: null,
  sessionStats: {
    correctType: 0,
    incorrectType: 0,
    perfect: 0,
    near: 0,
    miss: 0,
  },
  completedLessonIds: [],
  calibration: {
    noiseFloor: 0.01,
    openZcr: 0.28,
    closedZcr: 0.15,
    minStrikePeak: 0.1,
    maxStrikePeak: 0.8,
    openSamples: [],
    closedSamples: [],
    inputLatency: 60, // Default typical bluetooth/mobile latency
  },
  theme: {
    primary: '#fb923c', // Saffron
    secondary: '#f59e0b', // Amber
    intensity: 0,
    mode: 'LIGHT'
  },

  // Hardware & Transducer initial values
  inputMode: 'microphone',
  selectedAudioDeviceId: '',
  availableAudioDevices: [],
  isClipping: false,
  serialConnected: false,
  serialPortName: '',

  setInputMode: (mode) => set({ inputMode: mode }),
  setSelectedAudioDeviceId: (id) => set({ selectedAudioDeviceId: id }),
  setAvailableAudioDevices: (devices) => set({ availableAudioDevices: devices }),
  setIsClipping: (val) => set({ isClipping: val }),
  setSerialConnected: (val, portName = '') => set({ serialConnected: val, serialPortName: portName }),

  setRecording: (val) => set({ isRecording: val }),
  setMetronomeActive: (val) => set({ isMetronomeActive: val }),
  setBpm: (val) => set({ bpm: val }),
  setTimeSignature: (val) => set({ timeSignature: val }),
  addStrike: (strikeData) => set((state) => {
    const strike = { ...strikeData, id: crypto.randomUUID() };
    const newStats = { ...state.sessionStats };
    if (strike.timingVerdict === 'PERFECT') newStats.perfect++;
    else if (strike.timingVerdict === 'NEAR') newStats.near++;
    else if (strike.timingVerdict === 'MISS') newStats.miss++;

    return { 
      lastStrike: strike,
      sessionStats: newStats,
      amplitudeHistory: [...state.amplitudeHistory, strike.peakRms].slice(-50),
      combo: strike.timingVerdict === 'MISS' ? 0 : state.combo + 1,
      accuracy: (state.accuracy * state.combo + (strike.timingVerdict === 'PERFECT' ? 100 : strike.timingVerdict === 'NEAR' ? 50 : 0)) / (state.combo + 1)
    };
  }),
  evaluateStrike: (wasCorrectType) => set((state) => {
    const newStats = { ...state.sessionStats };
    if (wasCorrectType) newStats.correctType++;
    else newStats.incorrectType++;
    return { sessionStats: newStats };
  }),
  completeLesson: (id) => set((state) => ({
    completedLessonIds: state.completedLessonIds.includes(id) 
      ? state.completedLessonIds 
      : [...state.completedLessonIds, id]
  })),
  updateCalibration: (data) => set((state) => ({ 
    calibration: { ...state.calibration, ...data } 
  })),
  updateTheme: (intensity) => set((state) => ({
    theme: {
      ...state.theme,
      intensity: intensity,
      primary: intensity > 0.8 ? '#fcd34d' : '#fb923c' // Gold when loud
    }
  })),
  resetGameplay: () => set({ 
    combo: 0, 
    accuracy: 0, 
    amplitudeHistory: [],
    lastStrike: null,
    sessionStats: {
      correctType: 0,
      incorrectType: 0,
      perfect: 0,
      near: 0,
      miss: 0,
    }
  }),
}));
