import type { pakhawajSynth as Synth } from "./pakhawajSynth";
let loaded: typeof Synth | null = null;
let loading: Promise<typeof Synth> | null = null;
let generation = 0;
const listeners = new Set<(beat: number) => void>();
export const pakhawajSynth = {
  async start(bpm: number, beats: number) {
    const run = ++generation;
    loading ??= import("./pakhawajSynth")
      .then((module) => {
        loaded = module.pakhawajSynth;
        loaded.addBeatListener((beat) =>
          listeners.forEach((callback) => callback(beat)),
        );
        return loaded;
      })
      .catch((error) => {
        loading = null;
        throw error;
      });
    const synth = await loading;
    if (run === generation) await synth.start(bpm, beats);
  },
  stop() {
    ++generation;
    loaded?.stop();
  },
  addBeatListener(callback: (beat: number) => void) {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  },
};
