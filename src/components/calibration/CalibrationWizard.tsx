import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../../store/useAppStore';
import { Waves, Mic, Sparkles, ChevronRight, Check, Music } from 'lucide-react';
import { cn } from '../../lib/utils';
import { audioManager } from '../../features/audio/AudioManager';
import { ManjiraVisual } from '../ManjiraVisual';

const steps = [
  { id: 'start', title: 'Preparation', icon: Waves, description: 'Find a quiet place and hold your Manjira naturally.' },
  { id: 'latency', title: 'Audio Latency', icon: Music, description: 'Adjust delay to match your devices (Bluetooth/Web audio typical delay is ~60ms).' },
  { id: 'noise', title: 'Noise Floor', icon: Mic, description: 'Keep silent for 7 seconds so we can measure room noise.' },
  { id: 'open', title: 'Open Strikes', icon: Sparkles, description: 'Hold by the string loops loosely. Strike edge-to-edge and let them ring out completely. Perform 5 clear OPEN strikes.' },
  { id: 'closed', title: 'Closed Strikes', icon: ChevronRight, description: 'Hold the metal bells firmly. Strike them surface-to-surface for a short, muted sound. Perform 5 sharp CLOSED strikes.' },
];

export const CalibrationWizard: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const [currentStepIdx, setStepIdx] = useState(0);
    const [isMeasuring, setIsMeasuring] = useState(false);
    const [noiseCountdown, setNoiseCountdown] = useState(7);
    const [capturedValues, setCapturedValues] = useState<any[]>([]);
    const [liveVolume, setLiveVolume] = useState<number>(0);
    const [lastStrikeIntensity, setLastStrikeIntensity] = useState<number | null>(null);
    const { updateCalibration, calibration } = useAppStore();
    const currentStep = steps[currentStepIdx];

    const getMedian = (arr: number[]) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    useEffect(() => {
        if (isMeasuring && (currentStep.id === 'open' || currentStep.id === 'closed')) {
            const requiredStrikes = 5;
            
            const handleStrike = (data: any) => {
                setCapturedValues(prev => [...prev, data]);
            };

            audioManager.setLoudnessThresholds(calibration.minStrikePeak || 0.015, 1.0); 
            // audioManager.initialize now happens in runMeasurement click handler
            return () => { audioManager.stop(); };
        } else if (isMeasuring && currentStep.id === 'noise') {
            // Capture noise floor
            const peaks: number[] = [];
            let lastSampleTime = Date.now();
            setNoiseCountdown(7);

            const checkNoise = () => {
                const analyser = audioManager.getAnalyser();
                if (analyser) {
                    const data = new Uint8Array(analyser.frequencyBinCount);
                    analyser.getByteTimeDomainData(data);
                    let localMax = 0;
                    for(let i=0; i<data.length; i++) {
                        const val = Math.abs(data[i]/128.0 - 1);
                        if(val > localMax) localMax = val;
                    }
                    
                    setLiveVolume(localMax);

                    // Collect samples every 100ms
                    const now = Date.now();
                    if (now - lastSampleTime > 100) {
                        peaks.push(localMax);
                        lastSampleTime = now;
                    }
                }
                if (isMeasuring) requestAnimationFrame(checkNoise);
            };

            audioManager.initialize(() => {}).then(() => {
                requestAnimationFrame(checkNoise);
            }).catch(err => {
                console.error("Noise measurement failed", err);
                setIsMeasuring(false);
            });

            const countdownInterval = setInterval(() => {
                setNoiseCountdown(prev => Math.max(0, prev - 1));
            }, 1000);

            const timer = setTimeout(() => {
                const avgPeak = peaks.length > 0 
                    ? peaks.reduce((a, b) => a + b, 0) / peaks.length 
                    : 0.01;
                finishStep([{ peak: avgPeak }]);
            }, 7000);

            return () => {
                clearTimeout(timer);
                clearInterval(countdownInterval);
                audioManager.stop();
            };
        }
    }, [isMeasuring, currentStepIdx]);

    useEffect(() => {
        if (!isMeasuring) return;
        
        if ((currentStep.id === 'open' || currentStep.id === 'closed') && capturedValues.length >= 5) {
            finishStep(capturedValues);
        }
    }, [capturedValues.length, isMeasuring, currentStep.id]);

    const finishStep = (finalData: any[]) => {
        setIsMeasuring(false);

        if (currentStep.id === 'open') {
            const zcrs = finalData.map(d => d.zcr);
            updateCalibration({ 
                openZcr: getMedian(zcrs),
                openSamples: finalData.map(d => ({ 
                    zcr: d.zcr, 
                    crestFactor: d.crestFactor, 
                    sustain: d.sustain || 0.02,
                    decayRatio: d.decayRatio || 0.0
                }))
            });
        } else if (currentStep.id === 'closed') {
            const zcrs = finalData.map(d => d.zcr);
            updateCalibration({ 
                closedZcr: getMedian(zcrs),
                closedSamples: finalData.map(d => ({ 
                    zcr: d.zcr, 
                    crestFactor: d.crestFactor, 
                    sustain: d.sustain || 0.0,
                    decayRatio: d.decayRatio || 0.0
                }))
            });
        } else if (currentStep.id === 'noise') {
            const noisePeak = finalData[0]?.peak || 0.01;
            // Set min peak to be moderately above average noise floor
            updateCalibration({ minStrikePeak: Math.max(0.01, noisePeak * 2.5) });
            console.log("Noise floor captured (avg peak):", noisePeak);
        }

        setCapturedValues([]);
        next();
    };

    const next = () => {
        if (currentStepIdx < steps.length - 1) {
            setStepIdx(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const runMeasurement = () => {
        setIsMeasuring(true);
        setCapturedValues([]);
        setLastStrikeIntensity(null);

        if (currentStep.id === 'open' || currentStep.id === 'closed') {
            const handleStrike = (data: any) => {
                setCapturedValues(prev => [...prev, data]);
                setLastStrikeIntensity(data.peak || 0);
            };
            audioManager.initialize(handleStrike).catch(err => {
                console.error("Measurement initialization failed", err);
                setIsMeasuring(false);
            });
        }
    };

    return (
        <div className="max-w-xl w-full mx-auto glass-card p-6 md:p-12 text-center bg-white border-slate-100 shadow-xl min-h-[500px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-8"
                >
                    <div className="relative mx-auto w-48 h-48 mb-10 flex items-center justify-center">
                        <ManjiraVisual 
                            type={currentStep.id === 'closed' ? 'CLOSED' : 'OPEN'} 
                            isStriking={capturedValues.length > 0 && isMeasuring}
                        />
                    </div>

                    <div>
                        <h2 className="text-4xl font-black font-heading italic uppercase tracking-tighter text-slate-800 mb-4">{currentStep.title}</h2>
                        <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-sm mx-auto">{currentStep.description}</p>
                    </div>

                    {currentStep.id === 'latency' && (
                        <div className="flex flex-col items-center gap-6">
                            <input 
                                type="range" 
                                min="0" 
                                max="200" 
                                step="10"
                                value={calibration.inputLatency}
                                onChange={(e) => updateCalibration({ inputLatency: parseInt(e.target.value) })}
                                className="w-full max-w-sm accent-saffron"
                            />
                            <div className="text-3xl font-black font-heading text-saffron">{calibration.inputLatency}ms</div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Adjust this if hits feel late</p>
                        </div>
                    )}

                    {isMeasuring && currentStep.id === 'noise' && (
                        <div className="flex flex-col items-center gap-6">
                            <div className="text-6xl font-black font-heading text-saffron italic">
                                {noiseCountdown}
                            </div>
                            
                            {/* Live Volume Feedback */}
                            <div className="w-full max-w-xs flex flex-col items-center gap-2">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                                    Current Environment Noise
                                </div>
                                <div className="flex items-end gap-[2px] h-12 w-full justify-center">
                                    {[...Array(20)].map((_, i) => {
                                        const threshold = i / 20;
                                        const isActive = liveVolume * 5 > threshold; // amplify visually
                                        return (
                                            <motion.div
                                                key={i}
                                                initial={false}
                                                animate={{
                                                    height: isActive ? `${Math.max(10, (liveVolume * 5) * 100)}%` : '10%',
                                                    backgroundColor: isActive ? (liveVolume * 5 > 0.5 ? '#ef4444' : '#fb923c') : '#e2e8f0'
                                                }}
                                                className="w-1 rounded-t-sm transition-all duration-75"
                                            />
                                        )
                                    })}
                                </div>
                            </div>
                            
                            <div className="w-full max-w-xs h-2 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: "100%" }}
                                    animate={{ width: "0%" }}
                                    transition={{ duration: 7, ease: "linear" }}
                                    className="h-full bg-saffron"
                                />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Averaging spectral noise...</p>
                        </div>
                    )}

                    {isMeasuring && (currentStep.id === 'open' || currentStep.id === 'closed') && (
                        <div className="flex flex-col items-center gap-6">
                            <div className="flex justify-center gap-3">
                                {[...Array(5)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ scale: 1 }}
                                        animate={{ 
                                            scale: i < capturedValues.length ? [1, 1.2, 1] : 1,
                                            backgroundColor: i < capturedValues.length ? (currentStep.id === 'open' ? '#fb923c' : '#10b981') : '#f1f5f9'
                                        }}
                                        className="w-4 h-4 rounded-full"
                                    />
                                ))}
                            </div>
                            
                            {/* Strike Intensity Feedback */}
                            {lastStrikeIntensity !== null && capturedValues.length > 0 && (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Strike Intensity</div>
                                    <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner flex items-center">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, lastStrikeIntensity * 100)}%` }}
                                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                            className={cn(
                                                "h-full rounded-full",
                                                currentStep.id === 'open' ? "bg-gradient-to-r from-orange-400 to-saffron" : "bg-gradient-to-r from-emerald-400 to-emerald-500"
                                            )}
                                        />
                                    </div>
                                    <div className={cn(
                                        "text-xs font-bold",
                                        lastStrikeIntensity > 0.05 ? "text-emerald-500" : "text-amber-500"
                                    )}>
                                        {lastStrikeIntensity > 0.05 ? "Good striking force" : "Try striking a bit harder"}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-center gap-3 mb-12">
                        {steps.map((s, idx) => (
                            <div 
                                key={s.id} 
                                className={cn(
                                    "h-2 rounded-full transition-all duration-500",
                                    idx === currentStepIdx ? "w-10 bg-saffron shadow-sm" : "w-4 bg-slate-100"
                                )}
                            />
                        ))}
                    </div>

                    <button
                        onClick={['start', 'latency'].includes(currentStep.id) ? next : runMeasurement}
                        disabled={isMeasuring && currentStep.id !== 'noise'}
                        className="w-full py-5 bg-gradient-to-r from-saffron to-amber-sacred text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-orange-100 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        {isMeasuring ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {currentStep.id === 'noise' ? 'Measuring Silence...' : `Strike ${capturedValues.length + 1} of 5`}
                            </div>
                        ) : (
                            <>
                                {['start', 'latency'].includes(currentStep.id) ? (currentStep.id === 'start' ? 'Start Initiation' : 'Next') : 'Begin Capture'}
                                <ChevronRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                    
                    <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.3em] pt-4">
                        {isMeasuring ? "Tuning spectral fields..." : "Lesson 2: Sound Calibration"}
                    </p>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
