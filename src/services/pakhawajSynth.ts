import { useAppStore } from "../store/useAppStore";
import * as Tone from "tone";

export { TAAL_PRESETS } from "./taals";
export type { TaalDefinition } from "./taals";

class PakhawajSynth {
  private bassSynth: Tone.MembraneSynth | null = null;
  private trebleSynth: Tone.MembraneSynth | null = null;
  private initialized = false;
  private loop: Tone.Loop | null = null;
  private step = 0;
  private generation = 0;
  private beatListeners: Set<(beatIndex: number) => void> = new Set();

  addBeatListener(cb: (beatIndex: number) => void) {
    this.beatListeners.add(cb);
    return () => {
      this.beatListeners.delete(cb);
    };
  }

  private init() {
    if (this.initialized) return;

    this.bassSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 2,
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.001,
        decay: 0.4,
        sustain: 0.01,
        release: 1.4,
        attackCurve: "exponential",
      },
    }).toDestination();
    this.bassSynth.volume.value = -3;

    this.trebleSynth = new Tone.MembraneSynth({
      pitchDecay: 0.01,
      octaves: 1.2,
      oscillator: { type: "triangle" },
      envelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0,
        release: 0.1,
      },
    }).toDestination();
    this.trebleSynth.volume.value = -10;

    this.initialized = true;
  }

  async start(bpm: number, timeSignature: number = 4) {
    const generation = ++this.generation;
    if (Tone.context.state !== "running") {
      await Tone.start();
    }
    if (generation !== this.generation) return;
    this.init();
    Tone.Transport.stop();
    Tone.Transport.position = 0;

    Tone.Transport.bpm.value = bpm;
    this.step = 0;

    if (this.loop) {
      this.loop.dispose();
    }

    this.loop = new Tone.Loop((time) => {
      const beat = this.step % timeSignature;

      // Dispatch beat to UI subscribers
      Tone.Draw.schedule(() => {
        if (generation === this.generation)
          this.beatListeners.forEach((cb) => cb(beat));
      }, time);

      if (timeSignature === 7) {
        // Roopak Taal: Tin Tin Na, Dhin Na, Dhin Na (3+2+2)
        if (beat === 0) {
          this.trebleSynth?.triggerAttackRelease("G4", "16n", time, 1.0); // Khali
        } else if (beat === 1) {
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 0.6);
        } else if (beat === 2) {
          this.trebleSynth?.triggerAttackRelease("G4", "16n", time, 0.8);
        } else if (beat === 3) {
          this.bassSynth?.triggerAttackRelease("C2", "8n", time, 0.8);
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 0.8);
        } else if (beat === 4) {
          this.trebleSynth?.triggerAttackRelease("G4", "16n", time, 0.7);
        } else if (beat === 5) {
          this.bassSynth?.triggerAttackRelease("C2", "8n", time, 0.8);
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 0.8);
        } else if (beat === 6) {
          this.trebleSynth?.triggerAttackRelease("G4", "16n", time, 0.7);
        }
      } else if (timeSignature === 6) {
        // Dadra: Dha Dhin Na | Dha Tin Na (3+3)
        if (beat === 0) {
          this.bassSynth?.triggerAttackRelease("C2", "8n", time, 1.0);
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 1.0);
        } else if (beat === 1) {
          this.bassSynth?.triggerAttackRelease("G2", "8n", time, 0.6);
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 0.6);
        } else if (beat === 2) {
          this.trebleSynth?.triggerAttackRelease("G4", "16n", time, 0.8);
        } else if (beat === 3) {
          // Khali
          this.trebleSynth?.triggerAttackRelease("G4", "16n", time, 0.9);
        } else if (beat === 4) {
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 0.6);
        } else if (beat === 5) {
          this.trebleSynth?.triggerAttackRelease("G4", "16n", time, 0.7);
        }
      } else if (timeSignature === 16) {
        // Teentaal: 4 + 4 + 4 + 4
        if (beat === 0) {
          // Sam
          this.bassSynth?.triggerAttackRelease("C2", "8n", time, 1.0);
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 1.0);
        } else if (beat === 1 || beat === 2) {
          this.bassSynth?.triggerAttackRelease("G2", "8n", time, 0.6);
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 0.6);
        } else if (beat === 3) {
          this.bassSynth?.triggerAttackRelease("C2", "8n", time, 0.7);
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 0.7);
        } else if (beat === 4) {
          // Tali 2
          this.bassSynth?.triggerAttackRelease("C2", "8n", time, 0.9);
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 0.9);
        } else if (beat === 5 || beat === 6) {
          this.bassSynth?.triggerAttackRelease("G2", "8n", time, 0.6);
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 0.6);
        } else if (beat === 7) {
          this.bassSynth?.triggerAttackRelease("C2", "8n", time, 0.7);
        } else if (beat === 8) {
          // Khali (no bass)
          this.trebleSynth?.triggerAttackRelease("G4", "16n", time, 1.0);
        } else if (beat === 9 || beat === 10) {
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 0.5);
        } else if (beat === 11) {
          this.trebleSynth?.triggerAttackRelease("G4", "16n", time, 0.6);
        } else if (beat === 12) {
          // Tali 3
          this.bassSynth?.triggerAttackRelease("C2", "8n", time, 0.9);
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 0.9);
        } else if (beat === 13 || beat === 14) {
          this.bassSynth?.triggerAttackRelease("G2", "8n", time, 0.6);
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 0.6);
        } else if (beat === 15) {
          this.bassSynth?.triggerAttackRelease("C2", "8n", time, 0.7);
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 0.7);
        }
      } else if (timeSignature === 8) {
        // Keherwa (8 beats)
        if (beat === 0) {
          this.bassSynth?.triggerAttackRelease("C2", "8n", time, 1.0);
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 1.0);
        } else if (beat === 2) {
          this.trebleSynth?.triggerAttackRelease("G4", "16n", time, 0.6);
        } else if (beat === 4) {
          this.trebleSynth?.triggerAttackRelease("G4", "16n", time, 0.8); // Khali
        } else if (beat === 5) {
          this.bassSynth?.triggerAttackRelease("G2", "8n", time, 0.5);
        } else if (beat === 6) {
          this.bassSynth?.triggerAttackRelease("C2", "8n", time, 0.8);
        }
      } else {
        // 4/4 Basic
        if (beat === 0) {
          this.bassSynth?.triggerAttackRelease("C2", "8n", time, 1.0);
          this.trebleSynth?.triggerAttackRelease("E4", "16n", time, 1.0);
        } else if (beat === 1) {
          this.bassSynth?.triggerAttackRelease("G2", "8n", time, 0.5);
        } else if (beat === 2) {
          this.bassSynth?.triggerAttackRelease("C2", "8n", time, 0.5);
          this.trebleSynth?.triggerAttackRelease("G3", "16n", time, 0.5);
        } else if (beat === 3) {
          this.trebleSynth?.triggerAttackRelease("C4", "16n", time, 0.5);
        }
      }
      this.step++;
    }, "4n");

    this.loop.start(0);
    const startAt = Tone.now() + 0.15;
    const raw = Tone.getContext().rawContext;
    const stamp =
      "getOutputTimestamp" in raw ? raw.getOutputTimestamp() : undefined;
    const origin =
      stamp && stamp.contextTime > 0
        ? stamp.performanceTime - stamp.contextTime * 1000
        : performance.now() - Tone.immediate() * 1000;
    useAppStore.getState().setMetronomeStart(origin + startAt * 1000);
    Tone.Transport.start(startAt);
    console.log("Pakhawaj loop started with time signature", timeSignature);
  }

  setBpm(bpm: number) {
    useAppStore.getState().setBpm(bpm);
  }

  stop() {
    ++this.generation;
    if (this.loop) {
      this.loop.stop();
      this.loop.dispose();
      this.loop = null;
    }
    Tone.Transport.stop();
    this.step = 0;
    console.log("Pakhawaj loop stopped");
  }
}

export const pakhawajSynth = new PakhawajSynth();
