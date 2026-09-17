/**
 * Onset Detection Worklet Processor
 * Runs in the audio thread for ultra-low-latency strike detection.
 * Captures a 40ms high-resolution audio buffer for spectral decay analysis.
 */
class OnsetProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferCapacity = 2048; // Up to ~42ms at 48kHz
    this.sampleBuffer = new Float32Array(this.bufferCapacity);
    this.bufferOffset = 0;
    
    this.lastFlux = 0;
    this.refractoryCount = 0;
    // ~100ms cooldown to support fast bhajans while preventing double-triggers
    this.refractoryPeriod = Math.floor((sampleRate * 0.10) / 128);

    // 40ms tracking window (~15 frames of 128 samples at 48kHz)
    this.maxFrames = Math.max(8, Math.floor((sampleRate * 0.040) / 128));
    this.trackingFrames = 0;
    this.isTracking = false;
    
    this.onsetTimestamp = 0;
    this.onsetFlux = 0;
    this.maxPeak = 0;
  }

  static get parameterDescriptors() {
    return [
      { name: 'sensitivity', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'threshold', defaultValue: 0.025, minValue: 0, maxValue: 1 }
    ];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];
    const len = samples.length;
    
    let sum = 0;
    let blockPeak = 0;
    for (let i = 0; i < len; i++) {
        const absVal = Math.abs(samples[i]);
        sum += absVal;
        if (absVal > blockPeak) blockPeak = absVal;
    }
    const currentFlux = sum / len;

    if (this.isTracking) {
        // Accumulate incoming samples into buffer
        if (this.bufferOffset + len <= this.bufferCapacity) {
            this.sampleBuffer.set(samples, this.bufferOffset);
            this.bufferOffset += len;
        }
        if (blockPeak > this.maxPeak) this.maxPeak = blockPeak;
        this.trackingFrames++;

        // When 40ms tracking completes, post full audio buffer to main thread
        if (this.trackingFrames >= this.maxFrames) {
            const capturedBuffer = new Float32Array(this.sampleBuffer.subarray(0, this.bufferOffset));

            this.port.postMessage({
              type: 'ONSET',
              payload: {
                timestamp: this.onsetTimestamp,
                flux: this.onsetFlux,
                peak: this.maxPeak,
                buffer: capturedBuffer,
                sampleRate: sampleRate
              }
            });

            this.isTracking = false;
            this.trackingFrames = 0;
            this.bufferOffset = 0;
            this.maxPeak = 0;
        }
    } else {
        if (this.refractoryCount > 0) {
          this.refractoryCount--;
        } else {
          const dynamicThreshold = (parameters.threshold ? parameters.threshold[0] : 0.025);
          const isSharpRise = currentFlux > this.lastFlux * 1.35;
          const isLoudEnough = blockPeak > 0.015 && currentFlux > dynamicThreshold;

          if (isSharpRise && isLoudEnough) {
            // Trigger onset event
            this.isTracking = true;
            this.trackingFrames = 0;
            this.bufferOffset = 0;
            this.onsetTimestamp = currentTime * 1000;
            this.onsetFlux = currentFlux;
            this.maxPeak = blockPeak;

            // Copy initial attack block
            this.sampleBuffer.set(samples, 0);
            this.bufferOffset = len;
            this.refractoryCount = this.refractoryPeriod;
          }
        }
    }

    this.lastFlux = currentFlux;
    return true;
  }
}

registerProcessor('onset-processor', OnsetProcessor);

