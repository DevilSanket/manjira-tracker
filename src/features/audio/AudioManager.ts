/**
 * Audio Engine Management context
 * High-precision Spectral Dual-Band Manjira Strike Detection Engine
 */
import onsetProcessorUrl from './onset-processor.js?url';
import * as tf from '@tensorflow/tfjs';
import { useAppStore } from '../../store/useAppStore';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  private onStrikeCallback: (data: any) => void = () => {};
  private selectedDeviceId: string = '';
  private clipTimeout: any = null;
  private zcrThreshold: number = 0.22;
  private minPeak: number = 0.015;
  private maxPeak: number = 0.8;
  private lastStrikeTime: number = 0;
  private openSamples: any[] = [];
  private closedSamples: any[] = [];
  
  // Calibrated Baselines
  private calibratedOpenDecay: number = 0.35;
  private calibratedClosedDecay: number = 0.08;
  
  // AI Model
  private model: tf.LayersModel | null = null;
  private isModelTrained: boolean = false;
  private isTraining: boolean = false;
  private hasPendingTraining: boolean = false;


  constructor() {
    this.initModel();
  }

  private async initModel() {
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [4], units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 4, activation: 'relu' }),
        tf.layers.dense({ units: 2, activation: 'softmax' })
      ]
    });
    this.model.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
  }

  async setCalibrationSamples(open: any[], closed: any[]) {
    this.openSamples = open;
    this.closedSamples = closed;
    
    // Adapt physical decay baselines from user calibration data
    if (open.length > 0) {
      const openDecays = open.map(s => s.decayRatio || 0.35).filter(d => d > 0);
      if (openDecays.length > 0) {
        this.calibratedOpenDecay = openDecays.reduce((a, b) => a + b, 0) / openDecays.length;
      }
    }
    if (closed.length > 0) {
      const closedDecays = closed.map(s => s.decayRatio || 0.08).filter(d => d > 0);
      if (closedDecays.length > 0) {
        this.calibratedClosedDecay = closedDecays.reduce((a, b) => a + b, 0) / closedDecays.length;
      }
    }

    if (open.length > 0 && closed.length > 0) {
      await this.trainModel();
    }
  }

  private async trainModel() {
    if (!this.model) return;
    
    if (this.isTraining) {
      this.hasPendingTraining = true;
      return;
    }
    
    this.isTraining = true;

    try {
      while (true) {
        this.hasPendingTraining = false;
        console.log('AudioManager: Training background ML model...');
        
        const features: number[][] = [];
        const labels: number[][] = [];
        
        const normalize = (f: any) => [
            (f.zcr || 0.2) * 2.0, 
            (f.crestFactor || 2.0) / 20.0, 
            (f.peakProminence || 10) / 30.0, 
            (f.decayRatio || 0.2) * 2.0
        ];

        this.openSamples.forEach(s => {
          features.push(normalize(s));
          labels.push([1, 0]); // OPEN
        });
        
        this.closedSamples.forEach(s => {
          features.push(normalize(s));
          labels.push([0, 1]); // CLOSED
        });

        if (features.length > 0) {
          const xs = tf.tensor2d(features);
          const ys = tf.tensor2d(labels);

          await this.model.fit(xs, ys, {
            epochs: 50,
            shuffle: true,
            verbose: 0
          });

          xs.dispose();
          ys.dispose();
          this.isModelTrained = true;
          console.log('AudioManager: Background ML model trained and active');
        }

        if (!this.hasPendingTraining) {
          break;
        }
      }
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * High-accuracy analytical spectral dual-band classifier
   * Combines high-frequency temporal decay with FFT spectral peak prominence.
   */
  private classifySpectralStrike(
    decayRatio: number,
    peakProminence: number,
    highToMidRatio: number,
    zcr: number
  ): { type: 'OPEN' | 'CLOSED'; confidence: number; probability: number } {
    // Dynamic thresholds based on calibration if available
    const openDecayTarget = Math.max(0.20, this.calibratedOpenDecay);
    const closedDecayTarget = Math.min(0.18, this.calibratedClosedDecay);
    const decayMidpoint = (openDecayTarget + closedDecayTarget) / 2;

    // 1. Temporal Decay Score
    // Open strikes sustain ringing; Closed strikes attenuate in <25ms
    const decayRange = Math.max(0.10, openDecayTarget - closedDecayTarget);
    const decayScore = Math.max(0, Math.min(1, 0.5 + (decayRatio - decayMidpoint) / decayRange));

    // 2. Transducer Logarithmic Mechanical Damping Rate (alpha)
    // Physical cymbal contact vibration follows V(t) = V0 * e^(-alpha * t)
    // Open (Ghanti): alpha < 18 (rings continuously through metal)
    // Closed (Chapti): alpha > 42 (rapid hand flesh damping)
    const safeDecay = Math.max(0.0005, decayRatio);
    const alpha = -Math.log(safeDecay) / 0.024;
    const dampingScore = Math.max(0, Math.min(1, (44 - alpha) / (44 - 16)));

    // 3. Spectral Peak Prominence Score
    // Pure metallic bell modes create sharp peaks > 12dB above average floor
    const spectralScore = Math.max(0, Math.min(1, (peakProminence - 7.0) / (16.0 - 7.0)));

    // 4. High-to-Mid Tone Ratio
    // Open strikes are dominated by high frequencies; Closed have strong mid hand/slap presence
    const ratioScore = Math.max(0, Math.min(1, (highToMidRatio - 3.0) / (18.0 - 3.0)));

    // Fused Open Probability [0..1] with transducer contact physics weighting
    const openProbability = (decayScore * 0.35) + (dampingScore * 0.30) + (spectralScore * 0.25) + (ratioScore * 0.10);

    const isOpen = openProbability >= 0.48;
    const rawConfidence = isOpen ? openProbability : (1 - openProbability);
    const scaledConfidence = Math.max(0.72, Math.min(0.99, 0.65 + rawConfidence * 0.34));

    return {
      type: isOpen ? 'OPEN' : 'CLOSED',
      confidence: scaledConfidence,
      probability: openProbability
    };
  }


  async initialize(onStrike: (data: any) => void, deviceId?: string) {
    if (this.ctx) {
      await this.stop();
    }
    
    if (deviceId) {
      this.selectedDeviceId = deviceId;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
        throw new Error('Web Audio API not supported in this browser');
    }

    this.ctx = new AudioContextClass({ latencyHint: 'interactive' });
    this.onStrikeCallback = onStrike;

    try {
      console.log('AudioManager: Requesting raw microphone/transducer access...');
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        ...(this.selectedDeviceId ? { deviceId: { exact: this.selectedDeviceId } } : {})
      };

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      
      console.log('AudioManager: Audio input access granted');

      if (!this.ctx) return;

      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
        console.log('AudioManager: AudioContext resumed');
      }

      this.source = this.ctx.createMediaStreamSource(this.stream);
      
      // 1. Cable Rumble Filter: 100Hz Highpass for contact transducer handling noise
      const cableFilter = this.ctx.createBiquadFilter();
      cableFilter.type = 'highpass';
      cableFilter.frequency.value = 100;
      cableFilter.Q.value = 0.707;
      this.source.connect(cableFilter);

      // 2. High-resolution Analyser for real-time FFT spectrum & visualizer
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024; // 512 bins (~23.4Hz resolution at 48kHz)
      this.analyser.smoothingTimeConstant = 0.25;
      cableFilter.connect(this.analyser);

      // 3. Transducer Pre-Filter: Highpass at 1500Hz
      // Blinds onset detector to Pakhawaj drum bass (C2/G2 <= 100Hz), body resonance (E4 <= 330Hz),
      // and table thumps, isolating high metal cymbals chime.
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1500;
      hp.Q.value = 0.707;

      // 4. Load AudioWorklet
      await this.ctx.audioWorklet.addModule(onsetProcessorUrl);
      if (!this.ctx) return;

      this.worklet = new AudioWorkletNode(this.ctx, 'onset-processor');
      this.worklet.port.onmessage = (event) => {
        if (event.data.type === 'ONSET') {
          this.processStrike(event.data.payload);
        }
      };

      // Connect onset detector path
      this.source.connect(hp);
      hp.connect(this.worklet);
      this.worklet.connect(this.ctx.destination);

      // Refresh devices in store
      this.refreshAvailableDevices();

    } catch (err) {
      console.error('Failed to start audio', err);
      await this.stop();
      throw err;
    }
  }

  async refreshAvailableDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(d => d.kind === 'audioinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Audio / Transducer Input ${index + 1}`
        }));
      useAppStore.getState().setAvailableAudioDevices(audioInputs);
    } catch (e) {
      console.warn('Could not enumerate audio devices:', e);
    }
  }

  async switchAudioDevice(deviceId: string) {
    this.selectedDeviceId = deviceId;
    useAppStore.getState().setSelectedAudioDeviceId(deviceId);
    if (this.ctx && this.onStrikeCallback) {
      await this.initialize(this.onStrikeCallback, deviceId);
    }
  }

  private async processStrike(payload: any) {
    const samples: Float32Array = payload.buffer;
    const sampleRate = payload.sampleRate || (this.ctx ? this.ctx.sampleRate : 48000);
    const len = samples.length;

    if (len < 64) return;

    // 1. Time-Domain Metrics over full 40ms buffer
    let peak = 0;
    let squaredSum = 0;
    let zeroCrossings = 0;

    for (let i = 0; i < len; i++) {
        const v = Math.abs(samples[i]);
        if (v > peak) peak = v;
        squaredSum += samples[i] * samples[i];
        
        if (i > 0 && ((samples[i] >= 0 && samples[i-1] < 0) || (samples[i] < 0 && samples[i-1] >= 0))) {
            zeroCrossings++;
        }
    }

    // Contact Transducer Anti-Clipping Check
    if (peak >= 0.95) {
      useAppStore.getState().setIsClipping(true);
      if (this.clipTimeout) clearTimeout(this.clipTimeout);
      this.clipTimeout = setTimeout(() => {
        useAppStore.getState().setIsClipping(false);
      }, 1200);
    }


    const rms = Math.sqrt(squaredSum / len);
    const zcr = zeroCrossings / len;
    const crestFactor = peak / (rms || 0.001);

    // 2. High-Frequency Temporal Decay (Attack 0..8ms vs Tail 24..40ms)
    const attackLen = Math.min(len, Math.floor(0.008 * sampleRate));
    const tailStart = Math.min(len, Math.floor(0.024 * sampleRate));

    let attackEnergySq = 0;
    for (let i = 0; i < attackLen; i++) {
        attackEnergySq += samples[i] * samples[i];
    }
    const attackRms = Math.sqrt(attackEnergySq / Math.max(1, attackLen));

    let tailEnergySq = 0;
    let tailCount = 0;
    for (let i = tailStart; i < len; i++) {
        tailEnergySq += samples[i] * samples[i];
        tailCount++;
    }
    const tailRms = Math.sqrt(tailEnergySq / Math.max(1, tailCount));
    const decayRatio = tailRms / (attackRms + 0.0001);

    // 3. Spectral Peak Prominence & Resonance from Analyser FFT
    let peakProminence = 0;
    let peakFreq = 3500;
    let highToMidRatio = 0;

    if (this.analyser && this.ctx) {
        const binCount = this.analyser.frequencyBinCount;
        const freqData = new Float32Array(binCount);
        this.analyser.getFloatFrequencyData(freqData);

        const binWidth = (this.ctx.sampleRate / 2) / binCount;

        // Manjira Bell Resonance Band: 2500Hz - 8500Hz
        const bellMinBin = Math.max(0, Math.floor(2500 / binWidth));
        const bellMaxBin = Math.min(binCount - 1, Math.floor(8500 / binWidth));

        let maxMag = -150;
        let peakBin = bellMinBin;
        let sumBellMag = 0;

        for (let i = bellMinBin; i <= bellMaxBin; i++) {
            const m = freqData[i];
            sumBellMag += m;
            if (m > maxMag) {
                maxMag = m;
                peakBin = i;
            }
        }

        const avgBellMag = sumBellMag / Math.max(1, bellMaxBin - bellMinBin + 1);
        peakProminence = Math.max(0, maxMag - avgBellMag);
        peakFreq = peakBin * binWidth;

        // Mid-frequency band: 400Hz - 2000Hz (Hand contact, room background)
        const midMinBin = Math.max(0, Math.floor(400 / binWidth));
        const midMaxBin = Math.min(binCount - 1, Math.floor(2000 / binWidth));
        let sumMidMag = 0;
        for (let i = midMinBin; i <= midMaxBin; i++) {
            sumMidMag += freqData[i];
        }
        const avgMidMag = sumMidMag / Math.max(1, midMaxBin - midMinBin + 1);
        highToMidRatio = maxMag - avgMidMag;
    }

    // Gating / Filtering
    const now = Date.now();
    // 90ms cooldown prevents secondary bounce double-triggers
    if (now - this.lastStrikeTime < 90) { 
        return;
    }

    if (peak < this.minPeak) {
        return;
    }

    this.lastStrikeTime = now;
    
    // 4. Spectral Dual-Band Classification
    const dspResult = this.classifySpectralStrike(decayRatio, peakProminence, highToMidRatio, zcr);
    let finalType = dspResult.type;
    let finalConfidence = dspResult.confidence;

    // Optional ML blend if model was explicitly trained
    if (this.model && this.isModelTrained) {
        try {
            const normInput = [zcr * 2.0, crestFactor / 20.0, peakProminence / 30.0, decayRatio * 2.0];
            const prediction = tf.tidy(() => {
                const input = tf.tensor2d([normInput]);
                return this.model!.predict(input) as tf.Tensor;
            });
            const data = await prediction.data();
            prediction.dispose();

            const mlOpenConf = data[0];
            const mlClosedConf = data[1];
            const mlType = mlOpenConf > mlClosedConf ? 'OPEN' : 'CLOSED';
            const mlConfidence = Math.max(mlOpenConf, mlClosedConf);

            // Blend DSP with ML: if both agree, boost confidence
            if (mlType === dspResult.type) {
                finalConfidence = Math.min(0.99, Math.max(finalConfidence, mlConfidence));
            } else if (mlConfidence > 0.85) {
                finalType = mlType;
                finalConfidence = mlConfidence;
            }
        } catch (e) {
            console.warn('ML inference error, using DSP result:', e);
        }
    }

    console.log(`[Strike] ${finalType} (${(finalConfidence * 100).toFixed(0)}%) | DecayR: ${decayRatio.toFixed(3)}, Prominence: ${peakProminence.toFixed(1)}dB, PeakFreq: ${Math.round(peakFreq)}Hz, Peak: ${peak.toFixed(3)}`);

    this.onStrikeCallback({
        type: finalType,
        confidence: finalConfidence,
        peakRms: peak,
        timestamp: payload.timestamp - 40, // 40ms capture window offset
        zcr,
        crestFactor,
        sustain: tailRms,
        decayRatio,
        peakFreq: Math.round(peakFreq),
        peakProminence,
        rms
    });
  }

  getAnalyser() { return this.analyser; }

  setThreshold(val: number) {
    this.zcrThreshold = val;
  }

  setLoudnessThresholds(min: number, max: number) {
    this.minPeak = min;
    this.maxPeak = max;
  }

  async stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        await this.ctx.close();
      } catch (err) {
        console.warn('Error closing AudioContext:', err);
      }
    }
    this.ctx = null;
  }
}

export const audioManager = new AudioManager();
