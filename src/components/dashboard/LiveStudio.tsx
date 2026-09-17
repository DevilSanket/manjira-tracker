import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WaveformVisualizer } from './WaveformVisualizer';
import { ManjiraVisual } from '../ManjiraVisual';
import { useAppStore } from '../../store/useAppStore';
import { audioManager } from '../../features/audio/AudioManager';
import { pakhawajSynth, TAAL_PRESETS, TaalDefinition } from '../../services/pakhawajSynth';
import { manjiraSynth } from '../../services/audioSynth';
import { serialManager } from '../../services/serialManager';
import { 
    Activity, Zap, Info, Waves, Target, Percent, RefreshCw, X, Music, 
    Volume2, Flame, CheckCircle2, AlertCircle, Clock, 
    Sliders, Sparkles, ChevronRight, RotateCcw, Mic, Usb, Cpu, AlertTriangle
} from 'lucide-react';
import { cn, formatMs } from '../../lib/utils';
import { CalibrationWizard } from '../calibration/CalibrationWizard';

export const LiveStudio: React.FC = () => {
    const { 
        lastStrike, 
        amplitudeHistory, 
        combo, 
        accuracy, 
        sessionStats, 
        resetGameplay,
        isRecording, 
        isMetronomeActive, 
        setMetronomeActive, 
        bpm, 
        setBpm, 
        timeSignature, 
        setTimeSignature,
        availableAudioDevices,
        selectedAudioDeviceId,
        isClipping,
        serialConnected,
        serialPortName,
        inputMode,
        setInputMode
    } = useAppStore();

    const [livePeak, setLivePeak] = useState(0);
    const [currentBeat, setCurrentBeat] = useState(0);
    const [showCalibration, setShowCalibration] = useState(false);
    const [auditioning, setAuditioning] = useState<'OPEN' | 'CLOSED' | null>(null);
    const [tapTimes, setTapTimes] = useState<number[]>([]);
    const [serialConnecting, setSerialConnecting] = useState(false);

    // Initial audio device enumeration
    useEffect(() => {
        audioManager.refreshAvailableDevices();
    }, []);

    // Get active Taal definition
    const activeTaal: TaalDefinition = TAAL_PRESETS[timeSignature] || TAAL_PRESETS[8];


    // Live Peak Monitoring from audio analyser
    useEffect(() => {
        let frame: number;
        const update = () => {
            const analyser = audioManager.getAnalyser();
            if (analyser) {
                const data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteTimeDomainData(data);
                let max = 0;
                for (let i = 0; i < data.length; i++) {
                    const val = Math.abs(data[i] / 128.0 - 1);
                    if (val > max) max = val;
                }
                setLivePeak(prev => Math.max(max, prev * 0.92));
            }
            frame = requestAnimationFrame(update);
        };
        frame = requestAnimationFrame(update);
        return () => cancelAnimationFrame(frame);
    }, []);

    // Sync current beat with Tone.js Pakhawaj schedule
    useEffect(() => {
        const unsub = pakhawajSynth.addBeatListener((beatIndex) => {
            setCurrentBeat(beatIndex);
        });
        return unsub;
    }, []);

    // Tap Tempo Handler
    const handleTapTempo = () => {
        const now = performance.now();
        const recent = tapTimes.filter(t => now - t < 3000);
        const newTaps = [...recent, now];
        setTapTimes(newTaps);

        if (newTaps.length >= 2) {
            const intervals: number[] = [];
            for (let i = 1; i < newTaps.length; i++) {
                intervals.push(newTaps[i] - newTaps[i - 1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const calculatedBpm = Math.round(60000 / avgInterval);
            const clamped = Math.max(40, Math.min(220, calculatedBpm));
            setBpm(clamped);
            pakhawajSynth.setBpm(clamped);
        }
    };

    // Calculate dynamic consistency
    const calculateConsistency = () => {
        if (amplitudeHistory.length < 2) return 100;
        const mean = amplitudeHistory.reduce((a, b) => a + b, 0) / amplitudeHistory.length;
        const variance = amplitudeHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amplitudeHistory.length;
        const stdDev = Math.sqrt(variance);
        return Math.max(0, Math.min(100, (1 - (stdDev / (mean || 1))) * 100));
    };
    const consistency = calculateConsistency();

    // Contextual Technique Coach Tip
    const getTechniqueTip = () => {
        if (!isRecording) {
            return "Microphone is idle. Click 'START PLAYING' in the top bar to enable audio tracking.";
        }
        if (!lastStrike) {
            return "Strike your Manjira! Play loosely on the rim for Open (Ghanti) or clamp centers together for Closed (Chapti).";
        }
        if (isMetronomeActive) {
            if (lastStrike.timingDeltaMs < -40) {
                return `Rushing ahead of the beat by ${Math.abs(lastStrike.timingDeltaMs)}ms. Relax your wrists and align with the Pakhawaj pulse.`;
            }
            if (lastStrike.timingDeltaMs > 40) {
                return `Dragging behind the beat by ${lastStrike.timingDeltaMs}ms. Anticipate the upcoming beat slightly earlier.`;
            }
            if (lastStrike.timingVerdict === 'PERFECT') {
                return "Spot-on micro-timing! Locked right into the rhythm pocket.";
            }
        }
        if (lastStrike.label === 'OPEN') {
            if (lastStrike.decayRatio < 0.25) {
                return "Dampening too quickly. Let the outer rims vibrate freely to sustain that rich bell shimmer.";
            }
            if (lastStrike.confidence > 0.85) {
                return "Glorious open resonance! Clean harmonic chime.";
            }
            return "Glance the edges at a slight angle for maximum open sustain.";
        } else {
            if (lastStrike.decayRatio > 0.4) {
                return "Press surfaces together firmly right after impact to choke the ring.";
            }
            if (lastStrike.confidence > 0.85) {
                return "Superb snap! Tight, dry clap for precision rhythm.";
            }
            return "Keep contact flat and firm to silence lingering overtones.";
        }
    };

    // Audition sound handler
    const playAudition = async (type: 'OPEN' | 'CLOSED') => {
        setAuditioning(type);
        await manjiraSynth.play(type);
        setTimeout(() => setAuditioning(null), 600);
    };

    // Normalized timing offset for slider (-150ms to +150ms mapped to 0% - 100%)
    const timingDelta = lastStrike ? lastStrike.timingDeltaMs : 0;
    const clampedDelta = Math.max(-150, Math.min(150, timingDelta));
    const timingPointerPercent = 50 + (clampedDelta / 150) * 50;

    if (showCalibration) {
        return (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4">
                <button 
                    onClick={() => setShowCalibration(false)}
                    className="absolute top-8 right-8 p-3 bg-white/10 border border-white/10 rounded-2xl shadow-xl hover:bg-white/20 transition-all z-50"
                >
                    <X className="w-6 h-6 text-white" />
                </button>
                <div className="w-full max-w-xl">
                    <CalibrationWizard onComplete={() => setShowCalibration(false)} />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* =========================================================================
                1. RHYTHM & TAAL CONTROL BAR
               ========================================================================= */}
            <div className="glass-card bg-white/90 border-slate-200/80 p-4 md:p-5 rounded-[2rem] shadow-lg flex flex-wrap items-center justify-between gap-4">
                {/* Taal Selector */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1 hidden sm:inline">
                        Taal:
                    </span>
                    {Object.values(TAAL_PRESETS).map((taal) => {
                        const isSelected = activeTaal.id === taal.id;
                        return (
                            <button
                                key={taal.id}
                                onClick={() => {
                                    setTimeSignature(taal.beats);
                                    if (isMetronomeActive) {
                                        pakhawajSynth.start(bpm, taal.beats);
                                    }
                                }}
                                className={cn(
                                    "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0",
                                    isSelected
                                        ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                )}
                            >
                                <span>{taal.name}</span>
                                <span className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded-md font-mono",
                                    isSelected ? "bg-white/20 text-saffron" : "bg-slate-200 text-slate-500"
                                )}>
                                    {taal.beats}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Tempo & Pakhawaj Controls */}
                <div className="flex items-center gap-3 ml-auto">
                    {/* BPM Adjuster */}
                    <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                        <button
                            onClick={() => {
                                const next = Math.max(40, bpm - 5);
                                setBpm(next);
                                pakhawajSynth.setBpm(next);
                            }}
                            className="w-7 h-7 flex items-center justify-center font-black text-slate-600 hover:bg-white rounded-lg transition-colors"
                            title="-5 BPM"
                        >
                            -
                        </button>
                        <div className="px-2.5 text-center">
                            <span className="font-mono font-black text-xs text-slate-800">{bpm}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">BPM</span>
                        </div>
                        <button
                            onClick={() => {
                                const next = Math.min(220, bpm + 5);
                                setBpm(next);
                                pakhawajSynth.setBpm(next);
                            }}
                            className="w-7 h-7 flex items-center justify-center font-black text-slate-600 hover:bg-white rounded-lg transition-colors"
                            title="+5 BPM"
                        >
                            +
                        </button>
                    </div>

                    {/* Tap Tempo */}
                    <button
                        onClick={handleTapTempo}
                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                        title="Tap rhythmically to match tempo"
                    >
                        Tap
                    </button>

                    {/* Pakhawaj Toggle */}
                    <button
                        onClick={() => setMetronomeActive(!isMetronomeActive)}
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm",
                            isMetronomeActive
                                ? "bg-saffron text-white shadow-saffron/30 animate-pulse"
                                : "bg-slate-900 text-white hover:bg-slate-800"
                        )}
                    >
                        <Music className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">{isMetronomeActive ? "Pakhawaj Active" : "Play Pakhawaj"}</span>
                        <span className="md:hidden">Pakhawaj</span>
                    </button>

                    {/* Recalibrate Trigger */}
                    <button
                        onClick={() => setShowCalibration(true)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                        title="Calibrate Mic & Strike Thresholds"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* =========================================================================
                HARDWARE & TRANSDUCER INGESTION BAR
               ========================================================================= */}
            <div className="w-full flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 text-xs text-slate-300 shadow-md">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        <Cpu className="w-3.5 h-3.5 text-saffron" />
                        <span>Transducer Ingestion</span>
                    </div>

                    {/* Audio Input Device Selector */}
                    <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700">
                        <Mic className="w-3 h-3 text-slate-400" />
                        <select
                            value={selectedAudioDeviceId}
                            onChange={(e) => audioManager.switchAudioDevice(e.target.value)}
                            className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer max-w-[200px] truncate"
                            title="Select Audio Interface / Transducer"
                        >
                            <option value="" className="bg-slate-900 text-slate-200">Default Input / Transducer</option>
                            {availableAudioDevices.map((d) => (
                                <option key={d.deviceId} value={d.deviceId} className="bg-slate-900 text-slate-200">
                                    {d.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Texas Instruments (TI) Serial Connect */}
                    {serialManager.isSupported() && (
                        <button
                            onClick={async () => {
                                if (serialConnected) {
                                    await serialManager.disconnect();
                                } else {
                                    setSerialConnecting(true);
                                    try {
                                        await serialManager.connect();
                                    } catch (e) {
                                        // cancelled or error
                                    } finally {
                                        setSerialConnecting(false);
                                    }
                                }
                            }}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold text-[11px] transition-all border",
                                serialConnected
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                            )}
                            title="Connect Texas Instruments board via USB COM"
                        >
                            <Usb className={cn("w-3 h-3", serialConnected ? "text-emerald-400" : "text-slate-400")} />
                            <span>{serialConnected ? (serialPortName || "TI Board Active") : (serialConnecting ? "Connecting..." : "Connect TI USB")}</span>
                        </button>
                    )}
                </div>

                {/* Transducer Health & Clipping Monitor */}
                <div className="flex items-center gap-3 ml-auto">
                    {isClipping ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 animate-pulse font-bold text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                            <span>Signal Clipping - Reduce Gain!</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="font-medium text-slate-300">Contact Transducer Ready</span>
                        </div>
                    )}
                </div>
            </div>

            {/* =========================================================================
                2. UNIFIED HERO PERFORMANCE STAGE
               ========================================================================= */}
            <div className="w-full relative glass-card bg-slate-950 overflow-hidden border border-slate-800 p-6 md:p-8 rounded-[2.5rem] shadow-2xl group flex flex-col justify-between min-h-[540px] md:min-h-[600px]">

                {/* Background Grid & Atmospheric Lighting */}
                <div 
                    className="absolute inset-0 z-0 pointer-events-none opacity-20"
                    style={{ 
                        backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff15 1px, transparent 0)', 
                        backgroundSize: '40px 40px' 
                    }} 
                />
                
                {/* Ambient Center Glow */}
                <div className={cn(
                    "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[100px] pointer-events-none transition-colors duration-700",
                    lastStrike?.label === 'OPEN' ? "bg-saffron/15" : 
                    lastStrike?.label === 'CLOSED' ? "bg-emerald-500/15" : "bg-white/5"
                )} />

                {/* Oscilloscope Waveform Canvas */}
                <div className="absolute inset-0 pt-16 z-10 pointer-events-none opacity-80">
                    <WaveformVisualizer dark />
                </div>

                {/* Top Diagnostics & Flame Streak */}
                <div className="relative z-20 flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl backdrop-blur-md">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">
                                {isRecording ? "Transducer Active" : "Mic Idle"}
                            </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider hidden sm:inline">
                            48kHz DSP • Low Latency
                        </span>
                    </div>

                    {/* Live Rhythm Streak */}
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "flex items-center gap-1.5 px-4 py-1.5 rounded-full border backdrop-blur-md transition-all",
                            combo > 0 
                                ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]" 
                                : "bg-white/5 border-white/10 text-slate-400"
                        )}>
                            <Flame className={cn("w-4 h-4", combo > 0 ? "text-amber-400 animate-bounce" : "text-slate-500")} />
                            <span className="text-xs font-black uppercase tracking-wider">
                                {combo > 0 ? `${combo} In Rhythm` : "Streak: 0"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Center Stage: Interactive Manjira & Strike Classification */}
                <div className="relative z-20 flex flex-col items-center justify-center my-auto py-6">
                    {/* Clashing Cymbals Visual */}
                    <div className="relative flex items-center justify-center mb-2">
                        <ManjiraVisual 
                            type={lastStrike?.label === 'CLOSED' ? 'CLOSED' : 'OPEN'} 
                            isStriking={!!lastStrike && Date.now() - lastStrike.timestamp < 350}
                            className="scale-110 md:scale-125"
                        />
                    </div>

                    {/* Animated Strike Type Verdict */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={lastStrike?.id || 'idle'}
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 1.1, y: -10 }}
                            className="flex flex-col items-center text-center mt-2"
                        >
                            <h2 className={cn(
                                "text-5xl md:text-7xl font-black font-heading italic tracking-tighter drop-shadow-xl",
                                !lastStrike && "text-slate-600",
                                lastStrike?.label === 'OPEN' && "text-saffron drop-shadow-[0_0_30px_rgba(251,146,60,0.4)]",
                                lastStrike?.label === 'CLOSED' && "text-emerald-400 drop-shadow-[0_0_30px_rgba(52,211,153,0.4)]"
                            )}>
                                {lastStrike ? `${lastStrike.label} STRIKE` : (isRecording ? "LISTENING..." : "READY TO PLAY")}
                            </h2>

                            <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400 mt-1">
                                {lastStrike?.label === 'OPEN' ? '"Ghanti" — Resonant Bell Ring' :
                                 lastStrike?.label === 'CLOSED' ? '"Chapti" — Damped Rhythmic Snap' :
                                 'Play your cymbals to see real-time classification'}
                            </p>

                            {/* Confidence & Intensity Pills */}
                            {lastStrike && (
                                <div className="flex items-center gap-3 mt-4 bg-white/5 border border-white/10 rounded-full px-5 py-2 backdrop-blur-md">
                                    <div className="flex items-center gap-2 pr-3 border-r border-white/10">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full",
                                            lastStrike.label === 'OPEN' ? "bg-saffron" : "bg-emerald-400"
                                        )} />
                                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                                            Clarity: <span className="text-white">{(lastStrike.confidence * 100).toFixed(0)}%</span>
                                        </span>
                                    </div>
                                    {lastStrike.peakFreq ? (
                                        <div className="flex items-center gap-1.5 pr-3 border-r border-white/10 hidden sm:flex">
                                            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                                                Resonance: <strong className="text-amber-300">{lastStrike.peakFreq}Hz</strong>
                                            </span>
                                        </div>
                                    ) : null}
                                    <div className="flex items-center gap-2">
                                        <Zap className={cn(
                                            "w-3.5 h-3.5",
                                            lastStrike.label === 'OPEN' ? "text-saffron" : "text-emerald-400"
                                        )} />
                                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                                            Peak: <span className="text-white">{(lastStrike.peakRms * 100).toFixed(1)}</span>
                                        </span>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Bottom Stage: Live Matra Beat Ribbon */}
                <div className="relative z-20 w-full bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl backdrop-blur-xl">
                    <div className="flex items-center justify-between mb-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span>{activeTaal.name} ({activeTaal.division})</span>
                        <span>Beat {isMetronomeActive ? currentBeat + 1 : '-'} of {activeTaal.beats}</span>
                    </div>

                    {/* Matra Slots */}
                    <div className="grid grid-flow-col auto-cols-fr gap-1.5 md:gap-2 w-full">
                        {Array.from({ length: activeTaal.beats }).map((_, idx) => {
                            const isCurrent = isMetronomeActive && currentBeat === idx;
                            const vibhag = activeTaal.vibhags.find(v => v.startBeat === idx);
                            const isSam = vibhag?.type === 'sam';
                            const isKhali = vibhag?.type === 'khali';
                            const bol = activeTaal.bols[idx] || '';

                            return (
                                <motion.div
                                    key={`matra-${idx}`}
                                    animate={{
                                        scale: isCurrent ? 1.08 : 1,
                                        borderColor: isCurrent ? '#fb923c' : isSam ? '#f59e0b40' : '#334155'
                                    }}
                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-colors relative overflow-hidden",
                                        isCurrent 
                                            ? "bg-saffron text-slate-950 font-black shadow-[0_0_15px_rgba(251,146,60,0.5)]" 
                                            : isSam
                                            ? "bg-amber-500/10 text-amber-200 border-amber-500/30"
                                            : isKhali
                                            ? "bg-blue-500/10 text-blue-300 border-blue-500/20"
                                            : "bg-white/5 text-slate-300 border-white/5"
                                    )}
                                >
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] md:text-xs font-mono font-black">{idx + 1}</span>
                                        {isSam && (
                                            <span className={cn(
                                                "text-[8px] font-black uppercase px-1 rounded",
                                                isCurrent ? "bg-black text-saffron" : "bg-amber-500/30 text-amber-300"
                                            )}>
                                                Sam
                                            </span>
                                        )}
                                        {isKhali && (
                                            <span className={cn(
                                                "text-[8px] font-black uppercase px-1 rounded",
                                                isCurrent ? "bg-black text-blue-300" : "bg-blue-500/30 text-blue-300"
                                            )}>
                                                0
                                            </span>
                                        )}
                                    </div>
                                    <span className={cn(
                                        "text-[9px] md:text-[11px] font-bold mt-0.5 truncate max-w-full",
                                        isCurrent ? "text-slate-950" : "text-slate-400"
                                    )}>
                                        {bol}
                                    </span>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* =========================================================================
                3. TELEMETRY & REFERENCE DUAL CONSOLE
               ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Timing & Technique Precision Console */}
                <div className="glass-card bg-white border-slate-200/80 p-6 md:p-8 rounded-[2rem] shadow-xl flex flex-col justify-between space-y-6">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-50 text-saffron border border-amber-100">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-wide">
                                        Micro-Timing & Precision
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Beat Pocket Alignment
                                    </p>
                                </div>
                            </div>

                            {/* Verdict Pill */}
                            <span className={cn(
                                "px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border",
                                !lastStrike ? "bg-slate-50 text-slate-400 border-slate-200" :
                                lastStrike.timingVerdict === 'PERFECT' ? "bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm" :
                                lastStrike.timingVerdict === 'NEAR' ? "bg-amber-50 text-amber-600 border-amber-200" :
                                "bg-rose-50 text-rose-600 border-rose-200"
                            )}>
                                {lastStrike?.timingVerdict || "READY"}
                            </span>
                        </div>

                        {/* Early / On-Beat / Late Balance Slider */}
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 my-4">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                                <span className="text-amber-600">Early (-150ms)</span>
                                <span className="text-slate-800 font-bold">On-Beat (0ms)</span>
                                <span className="text-blue-600">Late (+150ms)</span>
                            </div>

                            {/* Slider Track */}
                            <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden flex items-center">
                                {/* Center Zero Mark */}
                                <div className="absolute left-1/2 -translate-x-1/2 w-1 h-full bg-slate-400 z-10" />
                                {/* Pointer */}
                                <motion.div 
                                    className={cn(
                                        "absolute top-0 bottom-0 w-4 -ml-2 rounded-full shadow-md z-20",
                                        !lastStrike ? "bg-slate-400" :
                                        lastStrike.timingVerdict === 'PERFECT' ? "bg-emerald-500 ring-2 ring-emerald-200" :
                                        lastStrike.timingVerdict === 'NEAR' ? "bg-amber-500 ring-2 ring-amber-200" :
                                        "bg-rose-500 ring-2 ring-rose-200"
                                    )}
                                    animate={{ left: `${timingPointerPercent}%` }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                />
                            </div>

                            <div className="flex justify-between items-center mt-2 text-xs font-mono font-bold text-slate-500">
                                <span>Offset: <strong className="text-slate-800">{lastStrike ? formatMs(lastStrike.timingDeltaMs) : "0ms"}</strong></span>
                                <span>Consistency: <strong className="text-slate-800">{consistency.toFixed(0)}%</strong></span>
                            </div>
                        </div>

                        {/* Dynamic Technique Coach Tip */}
                        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex gap-3 items-start">
                            <Sparkles className="w-5 h-5 text-saffron shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 mb-0.5">
                                    Technique Coach
                                </h4>
                                <p className="text-xs font-medium text-amber-800 leading-relaxed">
                                    {getTechniqueTip()}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Amplitude History Sparkline */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Strike Dynamics History ({amplitudeHistory.length})
                            </span>
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                                Live Tracking
                            </span>
                        </div>
                        <div className="h-16 flex items-end gap-1 w-full border-b border-slate-200 pb-1">
                            {amplitudeHistory.length === 0 ? (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400 uppercase tracking-wider border border-dashed border-slate-200 rounded-xl">
                                    Awaiting strikes...
                                </div>
                            ) : (
                                amplitudeHistory.slice(-30).map((amp, idx) => {
                                    const h = Math.min(100, (amp / 0.8) * 100);
                                    return (
                                        <motion.div 
                                            key={`amp-${idx}`}
                                            initial={{ scaleY: 0 }}
                                            animate={{ scaleY: 1 }}
                                            className="flex-1 bg-gradient-to-t from-saffron/40 to-saffron rounded-t-sm origin-bottom"
                                            style={{ height: `${Math.max(4, h)}%` }}
                                        />
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Sound Check & Quick Reference Console */}
                <div className="glass-card bg-white border-slate-200/80 p-6 md:p-8 rounded-[2rem] shadow-xl flex flex-col justify-between space-y-6">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                                    <Volume2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-wide">
                                        Sound Check & Reference
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Audition Authentic Samples
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={resetGameplay}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                title="Reset Session Stats"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Interactive Sound Audition Buttons */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
                            {/* Open Strike Pad */}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => playAudition('OPEN')}
                                className={cn(
                                    "p-4 rounded-2xl border text-left flex flex-col justify-between transition-all shadow-sm",
                                    auditioning === 'OPEN'
                                        ? "bg-saffron text-white border-saffron shadow-lg shadow-saffron/20"
                                        : "bg-amber-50/50 hover:bg-amber-50 text-slate-800 border-amber-200/80"
                                )}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-saffron">
                                        Bell Tone
                                    </span>
                                    <Volume2 className={cn("w-4 h-4", auditioning === 'OPEN' ? "animate-pulse" : "text-saffron")} />
                                </div>
                                <h4 className="text-lg font-black font-heading italic tracking-tight mb-1">
                                    Hear "Ghanti" (Open)
                                </h4>
                                <p className="text-xs text-slate-500 font-medium">
                                    Strike rim edge gently and let ring freely.
                                </p>
                            </motion.button>

                            {/* Closed Strike Pad */}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => playAudition('CLOSED')}
                                className={cn(
                                    "p-4 rounded-2xl border text-left flex flex-col justify-between transition-all shadow-sm",
                                    auditioning === 'CLOSED'
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/20"
                                        : "bg-emerald-50/50 hover:bg-emerald-50 text-slate-800 border-emerald-200/80"
                                )}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                        Snap Tone
                                    </span>
                                    <Volume2 className={cn("w-4 h-4", auditioning === 'CLOSED' ? "animate-pulse" : "text-emerald-600")} />
                                </div>
                                <h4 className="text-lg font-black font-heading italic tracking-tight mb-1">
                                    Hear "Chapti" (Closed)
                                </h4>
                                <p className="text-xs text-slate-500 font-medium">
                                    Slap flat centers and damp immediately.
                                </p>
                            </motion.button>
                        </div>
                    </div>

                    {/* Session Telemetry Scoreboard */}
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                            Session Riyaz Summary
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-xs">
                                <div className="text-2xl font-black font-heading italic text-slate-800">
                                    {sessionStats.perfect + sessionStats.near + sessionStats.miss}
                                </div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total Hits</div>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-xs">
                                <div className="text-2xl font-black font-heading italic text-emerald-600">
                                    {sessionStats.perfect}
                                </div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Perfect</div>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-xs">
                                <div className="text-2xl font-black font-heading italic text-saffron">
                                    {accuracy.toFixed(0)}%
                                </div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Accuracy</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
