import { useEffect, useRef, useState, useCallback } from 'react';
import { audioManager } from '../features/audio/AudioManager';
import { serialManager } from '../services/serialManager';
import { useAppStore } from '../store/useAppStore';

export function useAudioLifecycle() {
  const { 
    isRecording, 
    addStrike, 
    bpm, 
    isMetronomeActive, 
    timeSignature, 
    calibration, 
    updateTheme,
    selectedAudioDeviceId,
    inputMode 
  } = useAppStore();
  const [isInitialized, setInitialized] = useState(false);
  const nextBeatTime = useRef(0);
  const beatInterval = useRef(0);
  const sessionStartTime = useRef(0);

  useEffect(() => {
    // Decision boundary for fallback
    const threshold = (calibration.openZcr + calibration.closedZcr) / 2;
    audioManager.setThreshold(threshold);
    audioManager.setLoudnessThresholds(calibration.minStrikePeak, calibration.maxStrikePeak);
    // Sync ML samples
    if (calibration.openSamples?.length > 0) {
      audioManager.setCalibrationSamples(calibration.openSamples, calibration.closedSamples);
    }
  }, [calibration]);

  useEffect(() => {
    beatInterval.current = (60 / bpm) * 1000;
  }, [bpm]);

  const processStrikeEvent = useCallback((rawStrike: any) => {
    const startTime = sessionStartTime.current || performance.now();
    const now = performance.now();
    const adjustedNow = now - calibration.inputLatency;
    
    // Timing logic with latency compensation
    const elapsed = adjustedNow - startTime;
    const currentBeatDur = beatInterval.current;
    
    let offsetInBeat = elapsed % currentBeatDur;
    const halfBeat = currentBeatDur / 2;
    
    // Signed delta: negative = early, positive = late
    let signedDelta = offsetInBeat > halfBeat ? -(currentBeatDur - offsetInBeat) : offsetInBeat;
    let absDelta = Math.abs(signedDelta);

    let verdict: 'PERFECT' | 'NEAR' | 'MISS' = 'MISS';
    if (!isMetronomeActive) {
      verdict = 'PERFECT';
    } else {
      if (absDelta < 50) verdict = 'PERFECT';
      else if (absDelta < 150) verdict = 'NEAR';
    }

    updateTheme(rawStrike.peakRms || rawStrike.peak || 0.5);

    addStrike({
      label: rawStrike.type,
      confidence: rawStrike.confidence,
      timestamp: adjustedNow,
      timingDeltaMs: Math.round(signedDelta),
      timingVerdict: verdict,
      peakRms: rawStrike.peakRms || rawStrike.peak || 0.5,
      zcr: rawStrike.zcr || 0.25,
      decayRatio: rawStrike.decayRatio || 0.2,
      peakFreq: rawStrike.peakFreq,
      peakProminence: rawStrike.peakProminence
    });
  }, [calibration.inputLatency, isMetronomeActive, addStrike, updateTheme]);

  // Hook up serial callback
  useEffect(() => {
    serialManager.setStrikeCallback(processStrikeEvent);
  }, [processStrikeEvent]);

  useEffect(() => {
    let aborted = false;

    if (isRecording && !isInitialized) {
      sessionStartTime.current = performance.now();
      audioManager.initialize(processStrikeEvent, selectedAudioDeviceId).then(() => {
        if (!aborted) setInitialized(true);
      }).catch(err => {
        console.error("Critical: Microphone/Transducer initialization failed", err);
        if (!aborted) setInitialized(true); 
      });
    }

    return () => {
      aborted = true;
      audioManager.stop();
      setInitialized(false);
    };
  }, [isRecording, selectedAudioDeviceId, processStrikeEvent]);

  // Metronome simulator (visual/internal)
  useEffect(() => {
    if (!isMetronomeActive) {
        nextBeatTime.current = 0;
        import('../services/pakhawajSynth').then(({ pakhawajSynth }) => {
            pakhawajSynth.stop();
        });
        return;
    }

    import('../services/pakhawajSynth').then(({ pakhawajSynth }) => {
        pakhawajSynth.start(bpm, timeSignature);
    });

    const startTime = performance.now();
    let rAFId: number;

    const loop = () => {
        const now = performance.now();
        const elapsed = now - startTime;
        const beatsPassed = Math.floor(elapsed / beatInterval.current);
        nextBeatTime.current = startTime + ((beatsPassed + 1) * beatInterval.current);
        rAFId = requestAnimationFrame(loop);
    };

    rAFId = requestAnimationFrame(loop);
    return () => {
        cancelAnimationFrame(rAFId);
        import('../services/pakhawajSynth').then(({ pakhawajSynth }) => {
            pakhawajSynth.stop();
        });
    };
  }, [isMetronomeActive, bpm, timeSignature]);

  return { isInitialized };
}
