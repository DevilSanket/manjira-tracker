import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../../store/useAppStore';
import { LESSONS, Lesson } from '../../features/lesson/lessonData';
import { Play, Pause, RefreshCcw, Star, Trophy, ArrowRight, Lock, CheckCircle2, Music, Volume2, Headphones, Maximize, Minimize, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SessionDashboard } from './SessionDashboard';
import { StrikeDictionary } from '../dashboard/StrikeDictionary';
import confetti from 'canvas-confetti';
import * as Tone from 'tone';

import { manjiraSynth } from '../../services/audioSynth';
import { audioManager } from '../../features/audio/AudioManager';
import { ambienceService } from '../../services/ambienceService';

type JourneyStep = 
    | { id: string; type: 'INTRO'; strike: 'OPEN' | 'CLOSED'; title: string; desc: string }
    | { id: string; type: 'PRACTICE'; lessonId: string }
    | { id: string; type: 'EAR_TRAINING'; goal: number };

const JOURNEY_STEPS: JourneyStep[] = [
    { id: 'intro_open', type: 'INTRO', strike: 'OPEN', title: 'Open Strike', desc: 'The resonant ringing sound. Let the Manjira sing freely.' },
    { id: 'practice_open', type: 'PRACTICE', lessonId: 'lesson_1' },
    { id: 'intro_closed', type: 'INTRO', strike: 'CLOSED', title: 'Closed Strike', desc: 'The sharp dampened sound. Press them together quickly.' },
    { id: 'practice_closed', type: 'PRACTICE', lessonId: 'lesson_2' },
    { id: 'intro_alternate', type: 'INTRO', strike: 'OPEN', title: 'Alternate Strike', desc: 'Flow between open and closed strikes. Trust the rhythm of alternation.' },
    { id: 'practice_alternate', type: 'PRACTICE', lessonId: 'lesson_3' },
    { id: 'ear_training', type: 'EAR_TRAINING', goal: 10 }
];

export const BasicLessons: React.FC = () => {
    const { 
        isRecording, setRecording, 
        isMetronomeActive, setMetronomeActive,
        bpm, setBpm,
        lastStrike, accuracy, combo,
        sessionStats, evaluateStrike,
        completedLessonIds, completeLesson,
        resetGameplay 
    } = useAppStore();

    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'RESULT' | 'PROMPTING' | 'INTRO'>('IDLE');
    const [noteIndex, setNoteIndex] = useState(0);
    const noteIndexRef = useRef(0);
    const [score, setScore] = useState(0);
    const [bestCombo, setBestCombo] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'CORRECT' | 'WRONG'; id: number; verdict?: string; points?: number } | null>(null);
    const arenaRef = useRef<HTMLDivElement>(null);
    const lastProcessedStrikeId = useRef<string | null>(null);
    const hasAttemptedInitialFullscreen = useRef(false);

    useEffect(() => {
        const attemptFullscreen = async () => {
            if (!hasAttemptedInitialFullscreen.current && !document.fullscreenElement && arenaRef.current) {
                hasAttemptedInitialFullscreen.current = true;
                // Add a small delay to ensure the DOM is ready and the click gesture is still valid
                setTimeout(async () => {
                    try {
                        const element = arenaRef.current;
                        if (element && element.requestFullscreen) {
                            await element.requestFullscreen();
                        } else if (element && (element as any).webkitRequestFullscreen) {
                            await (element as any).webkitRequestFullscreen();
                        }
                    } catch (err) {
                        console.log("Initial fullscreen request deferred or blocked:", err);
                        // We don't force isFullscreen here to avoid UI mismatch if blocked
                    }
                }, 100);
            }
        };
        attemptFullscreen();
    }, []);

    const activeStep = JOURNEY_STEPS[currentStepIndex];
    const activeLesson = activeStep.type === 'PRACTICE' ? LESSONS.find(l => l.id === activeStep.lessonId) : null;

    const getMaxScore = () => {
        if (activeStep.type === 'EAR_TRAINING') return activeStep.goal * 200;
        if (!activeLesson) return 0;
        return activeLesson.sequence.length * 100;
    };

    const toggleFullscreen = async () => {
        if (!arenaRef.current) return;

        try {
            if (!document.fullscreenElement) {
                const element = arenaRef.current;
                if (element.requestFullscreen) {
                    await element.requestFullscreen();
                } else if ((element as any).webkitRequestFullscreen) {
                    await (element as any).webkitRequestFullscreen();
                } else if ((element as any).msRequestFullscreen) {
                    await (element as any).msRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if ((document as any).webkitExitFullscreen) {
                    await (document as any).webkitExitFullscreen();
                } else if ((document as any).msExitFullscreen) {
                    await (document as any).msExitFullscreen();
                }
            }
        } catch (err) {
            console.error("Fullscreen error:", err);
            // Fallback: Toggle state manually if browser blocks it (simulated fullscreen)
            setIsFullscreen(!isFullscreen);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Ear Training State
    const [earPrompt, setEarPrompt] = useState<'OPEN' | 'CLOSED' | null>(null);
    const [earProgress, setEarProgress] = useState(0);
    const [hitHistory, setHitHistory] = useState<('CORRECT' | 'WRONG' | null)[]>([]);

    useEffect(() => {
        if (feedback) {
            const timer = setTimeout(() => setFeedback(null), 1000);
            return () => clearTimeout(timer);
        }
    }, [feedback]);

    const playPromptSound = async (type: 'OPEN' | 'CLOSED') => {
        await manjiraSynth.play(type);
    };

    const startEarTrainingLevel = async () => {
        await Tone.start();
        // Pre-initialize microphone on user gesture to avoid permission issues
        audioManager.initialize(() => {}).catch(err => {
            console.warn("Pre-initialization failed:", err);
        });

        setGameState('PROMPTING');
        setRecording(false);
        lastProcessedStrikeId.current = null;
        const types: ('OPEN' | 'CLOSED')[] = ['OPEN', 'CLOSED'];
        const nextPrompt = types[Math.floor(Math.random() * types.length)];
        setEarPrompt(nextPrompt);
        
        setTimeout(() => {
            playPromptSound(nextPrompt);
            // Move setRecording outside of double-nested timeout if possible, 
            // or ensure it reacts correctly
            setTimeout(() => {
                setGameState('PLAYING');
                setRecording(true);
            }, 1000);
        }, 500);
    };

    const startStepWithIndex = async (idx: number) => {
        const step = JOURNEY_STEPS[idx];
        ambienceService.start();
        
        // Auto-fullscreen on starting a lesson as requested
        if (!document.fullscreenElement && arenaRef.current) {
            try {
                const element = arenaRef.current;
                if (element.requestFullscreen) {
                    await element.requestFullscreen();
                } else if ((element as any).webkitRequestFullscreen) {
                    await (element as any).webkitRequestFullscreen();
                }
                setIsFullscreen(true);
            } catch (err) {
                console.error("Fullscreen request failed:", err);
                setIsFullscreen(true); // Fallback to simulated fullscreen if browser blocks real one
            }
        }

        if (step.type === 'INTRO') {
            setGameState('INTRO');
            setRecording(false);
            setMetronomeActive(false);
            if (step.id === 'intro_alternate') {
                setTimeout(async () => {
                    await manjiraSynth.play('OPEN');
                    setTimeout(() => manjiraSynth.play('CLOSED'), 800);
                }, 1000);
            } else {
                setTimeout(() => playPromptSound(step.strike), 1000);
            }
        } else if (step.type === 'PRACTICE') {
            const lesson = LESSONS.find(l => l.id === step.lessonId);
            if (lesson) {
                setBpm(lesson.bpm);
                setGameState('PLAYING');
                setRecording(true);
                setMetronomeActive(true);
                resetGameplay();
                lastProcessedStrikeId.current = null;
                setNoteIndex(0);
                noteIndexRef.current = 0;
                setScore(0);
                setHitHistory(new Array(lesson.sequence.length).fill(null));
            }
        } else if (step.type === 'EAR_TRAINING') {
            setEarProgress(0);
            setScore(0);
            setHitHistory([]);
            startEarTrainingLevel();
        }
    };

    const startCurrentStep = async () => {
        await startStepWithIndex(currentStepIndex);
    };

    const nextStep = (autoStart = false) => {
        if (currentStepIndex < JOURNEY_STEPS.length - 1) {
            const nextIdx = currentStepIndex + 1;
            setCurrentStepIndex(nextIdx);
            if (autoStart) {
                startStepWithIndex(nextIdx);
            } else {
                setGameState('IDLE');
            }
        } else {
            // Journey complete
            setGameState('IDLE');
            setCurrentStepIndex(0);
        }
    };

    const stopStep = () => {
        setGameState('RESULT');
        setRecording(false);
        setMetronomeActive(false);
        
        let isSuccess = false;

        if (activeStep.type === 'PRACTICE') {
            const lesson = LESSONS.find(l => l.id === activeStep.lessonId);
            const total = sessionStats.correctType + sessionStats.incorrectType;
            const typeAcc = total > 0 ? (sessionStats.correctType / total) * 100 : 0;
            if (lesson && typeAcc >= lesson.passAccuracy) {
                completeLesson(lesson.id);
                isSuccess = true;
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#fb923c', '#f59e0b', '#FFFFFF']
                });
            }
        }
        
        if (isSuccess && currentStepIndex < JOURNEY_STEPS.length - 1) {
            setTimeout(() => {
                nextStep(false);
            }, 3000);
        }
    };

    // Note processing logic
    useEffect(() => {
        if (gameState !== 'PLAYING' || !lastStrike || lastStrike.id === lastProcessedStrikeId.current) return;
        lastProcessedStrikeId.current = lastStrike.id;
        
        if (activeStep.type === 'PRACTICE') {
            const currentIdx = noteIndexRef.current;
            const expected = activeLesson?.sequence[currentIdx];
            if (!expected) return;

            // In basic lessons, we only care about the type of strike, not the timing.
            const isCorrectType = lastStrike.label === expected;
            evaluateStrike(isCorrectType);
            
            if (isCorrectType) {
                // Give full points for correct type in basic lessons
                const points = 100;
                setScore(s => s + points);
                
                // Show feedback text and points
                setFeedback({ type: 'CORRECT', id: Date.now(), verdict: 'CORRECT', points });
                
                setBestCombo(prev => Math.max(prev, combo + 1));
                setHitHistory(prev => {
                    const next = [...prev];
                    next[currentIdx] = 'CORRECT';
                    return next;
                });
            } else {
                setFeedback({ type: 'WRONG', id: Date.now(), verdict: 'INCORRECT', points: 0 });
                setHitHistory(prev => {
                    const next = [...prev];
                    next[currentIdx] = 'WRONG';
                    return next;
                });
            }

            const nextIndex = currentIdx + 1;
            noteIndexRef.current = nextIndex;
            setNoteIndex(nextIndex);

            if (activeLesson && nextIndex >= activeLesson.sequence.length) {
                stopStep();
            }
        } else if (activeStep.type === 'EAR_TRAINING') {
            // Ear Training logic
            const isCorrectType = lastStrike.label === earPrompt;
            evaluateStrike(isCorrectType);
            
            setHitHistory(prev => [...prev, isCorrectType ? 'CORRECT' : 'WRONG']);

            const nextProg = earProgress + 1;
            setEarProgress(nextProg);

            if (isCorrectType) {
                setScore(s => s + 200);
                setFeedback({ type: 'CORRECT', id: Date.now() });
            } else {
                setScore(s => Math.max(0, s - 50));
                setFeedback({ type: 'WRONG', id: Date.now() });
            }

            if (nextProg >= activeStep.goal) {
                confetti({
                    particleCount: 80,
                    spread: 50,
                    colors: ['#fb923c', '#FFFFFF']
                });
                setGameState('RESULT');
                setRecording(false);
                
                if (currentStepIndex < JOURNEY_STEPS.length - 1) {
                    setTimeout(() => {
                        nextStep(false);
                    }, 3000);
                }
            } else {
                startEarTrainingLevel();
            }
        }
    }, [lastStrike]);

    const isPassedResult = (() => {
        if (activeStep.type === 'EAR_TRAINING') return true;
        if (activeStep.type === 'PRACTICE') {
            const lesson = LESSONS.find(l => l.id === activeStep.lessonId);
            const total = sessionStats.correctType + sessionStats.incorrectType;
            const typeAcc = total > 0 ? (sessionStats.correctType / total) * 100 : 0;
            return lesson && typeAcc >= lesson.passAccuracy;
        }
        return false;
    })();

    return (
        <div className="space-y-8">
            <div 
                ref={arenaRef}
                className={cn(
                    "relative transition-all duration-700",
                    isFullscreen ? "fixed inset-0 z-[100] bg-orange-50 flex items-center justify-center p-0" : "w-full"
                )}
            >
                <AnimatePresence mode="wait">

                {gameState === 'IDLE' && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className={cn(
                            "relative overflow-hidden w-full flex items-center justify-center py-10 px-4 md:py-20 flex-col",
                            isFullscreen ? "h-screen" : "min-h-[800px]"
                        )}
                    >
                        {/* Background Presence */}
                        <div className="absolute inset-0 z-0">
                            <img src="/ear_training_bg.png" className="w-full h-full object-cover opacity-30" alt="Background" />
                            <div className="absolute inset-0 bg-gradient-to-t from-orange-50 via-white/80 to-orange-50" />
                        </div>

                        <div className="relative z-10 max-w-4xl mx-auto space-y-12 text-center">
                            <div className="space-y-4">
                                <span className="text-saffron font-black text-sm uppercase tracking-[0.4em]">Step {currentStepIndex + 1} of {JOURNEY_STEPS.length}</span>
                                <h1 className="text-5xl md:text-8xl font-black font-heading italic text-slate-900 tracking-tighter uppercase leading-none drop-shadow-sm">
                                    Journey to <span className="text-saffron text-glow">Mastery</span>
                                </h1>
                            </div>

                            <div className="glass-card bg-white/80 border-saffron/10 p-12 backdrop-blur-2xl rounded-[3rem] shadow-2xl max-w-3xl mx-auto">
                                <h2 className="text-3xl md:text-4xl font-bold font-heading text-slate-800 mb-6 uppercase italic tracking-tight">
                                    {activeStep.type === 'INTRO' ? activeStep.title : 
                                     activeStep.type === 'PRACTICE' ? activeLesson?.name : 'Ear Training'}
                                </h2>
                                <p className="text-slate-600 text-lg md:text-xl mb-8 max-w-xl mx-auto leading-relaxed">
                                    {activeStep.type === 'INTRO' ? activeStep.desc : 
                                     activeStep.type === 'PRACTICE' ? activeLesson?.description : 'Identify the sounds purely by listening.'}
                                </p>
                                
                                <button
                                    onClick={startCurrentStep}
                                    className="px-8 py-5 md:px-16 md:py-8 bg-saffron hover:bg-amber-600 text-black font-black text-xs md:text-base uppercase tracking-[0.3em] md:tracking-[0.5em] rounded-full transition-all shadow-[0_0_50px_rgba(251,146,60,0.4)] flex items-center justify-center gap-2 md:gap-4 mx-auto scale-100 md:scale-110 hover:scale-[1.15] active:scale-95"
                                >
                                    {activeStep.type === 'INTRO' ? 'START LESSON' : 'START PRACTICE'} <ArrowRight className="w-6 h-6 md:w-8 md:h-8" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {gameState === 'INTRO' && activeStep.type === 'INTRO' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                            "relative flex items-center justify-center overflow-hidden bg-orange-50 w-full cursor-default group/screen",
                            isFullscreen ? "h-screen" : "min-h-screen"
                        )}
                    >
                        <div className="absolute inset-0 opacity-40">
                            <img src="/vitthal_centerpiece.png" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-b from-orange-100/50 via-transparent to-orange-100/50" />
                        </div>
                        
                        <div className="relative z-10 max-w-2xl w-full text-center space-y-12">
                            <div className="space-y-4">
                                <h2 className="text-4xl md:text-6xl font-black font-heading text-slate-900 italic uppercase tracking-tighter">
                                    Learning the <span className="text-saffron">{activeStep.title}</span>
                                </h2>
                                <p className="text-slate-500 text-lg uppercase tracking-widest font-black opacity-80">Study the motion, listen to the resonance</p>
                            </div>

                            {activeStep.id === 'intro_alternate' ? (
                                <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                                    <div className="relative aspect-square rounded-[2rem] overflow-hidden border-4 border-saffron/10 shadow-xl group">
                                        <img src="/open_strike.gif" className="w-full h-full object-cover" alt="Open Strike" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent flex items-end justify-center pb-4">
                                            <div className="bg-saffron text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Open</div>
                                        </div>
                                    </div>
                                    <div className="relative aspect-square rounded-[2rem] overflow-hidden border-4 border-saffron/10 shadow-xl group">
                                        <img src="/close_strike.gif" className="w-full h-full object-cover" alt="Closed Strike" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent flex items-end justify-center pb-4">
                                            <div className="bg-saffron text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Closed</div>
                                        </div>
                                    </div>
                                    <div className="col-span-2 flex justify-center mt-4">
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                await manjiraSynth.play('OPEN');
                                                setTimeout(() => manjiraSynth.play('CLOSED'), 600);
                                            }}
                                            className="px-8 py-3 rounded-full bg-saffron text-white flex items-center gap-3 shadow-xl font-black text-xs uppercase tracking-widest"
                                        >
                                            <Volume2 className="w-5 h-5" />
                                            Hear Both | दोनों सुनें
                                        </motion.button>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative aspect-square max-w-sm mx-auto rounded-[3rem] overflow-hidden border-8 border-saffron/10 shadow-2xl group">
                                    <img 
                                        src={activeStep.strike === 'OPEN' ? "/open_strike.gif" : "/close_strike.gif"} 
                                        className="w-full h-full object-cover" 
                                        alt="Strike Guide" 
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent flex items-end justify-center pb-8">
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                playPromptSound(activeStep.strike);
                                            }}
                                            className="w-16 h-16 rounded-full bg-saffron text-white flex items-center justify-center shadow-xl"
                                        >
                                            <Volume2 className="w-8 h-8" />
                                        </motion.button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-8">
                                <p className="text-slate-800 text-xl font-medium leading-relaxed italic">
                                    "{activeStep.desc}"
                                </p>

                                <div className="flex flex-col items-center gap-4">
                                    <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Follow the on-screen guide</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {(gameState === 'PLAYING' || gameState === 'PROMPTING') && (
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0 }} 
                        animate={{ scale: 1, opacity: 1 }}
                        className={cn(
                            "relative overflow-hidden shadow-2xl bg-orange-50 transition-all flex flex-col",
                            isFullscreen ? "h-screen w-screen rounded-none border-0" : "w-full max-w-[1600px] mx-auto aspect-[16/9] min-h-[600px] rounded-2xl md:rounded-[3rem] border-4 md:border-8 border-saffron/10"
                        )}
                    >
                        {/* Full Screen Background */}
                        <div className="absolute inset-0">
                            <video 
                                autoPlay 
                                loop 
                                muted 
                                playsInline
                                className="w-full h-full object-cover opacity-80"
                            >
                                <source src="/pune-bg.mp4" type="video/mp4" />
                            </video>
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
                        </div>

                        {/* Majestic Vitthal Background Presence */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pt-24 pointer-events-none">
                            <motion.div 
                                initial={{ scale: 0.8, opacity: 0, y: 50 }}
                                animate={{ 
                                    scale: isFullscreen ? 1.4 : 1.2, 
                                    opacity: 1, 
                                    y: isFullscreen ? 50 : 30 
                                }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className="relative group"
                            >
                                <div className={cn(
                                    "absolute inset-0 bg-saffron/20 blur-[120px] rounded-full animate-pulse",
                                    isFullscreen ? "scale-250" : "scale-180"
                                )} />
                                <motion.img 
                                    src="/vitthal_centerpiece.png" 
                                    alt="Vitthal Mauli"
                                    animate={feedback ? {
                                        scale: [1, 1.05, 1],
                                        filter: feedback.type === 'CORRECT' ? ['brightness(1)', 'brightness(1.5) drop-shadow(0 0 20px rgba(16,185,129,0.8))', 'brightness(1)'] : ['brightness(1)', 'brightness(0.8) sepia(1) hue-rotate(-50deg) saturate(3)', 'brightness(1)']
                                    } : {
                                        scale: 1,
                                        filter: 'brightness(1)'
                                    }}
                                    transition={{ duration: 0.5 }}
                                    className={cn(
                                        "object-contain drop-shadow-[0_40px_80px_rgba(0,0,0,0.6)] relative z-10 transition-all duration-700",
                                        isFullscreen ? "h-[85vh]" : "h-64 sm:h-96 md:h-[750px]"
                                    )}
                                    referrerPolicy="no-referrer"
                                />
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-12 bg-black/40 blur-2xl rounded-[100%] translate-y-12" />
                            </motion.div>
                        </div>

                        <div className="relative h-full flex flex-col z-20">
                            {/* NEW HUD HUD */}
                            <div className="p-8 flex justify-between items-start">
                                {/* Left Side: Stat Cards */}
                                <div className="flex flex-col gap-4">
                                    <motion.div 
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        className="glass-card bg-white/90 border-saffron/20 p-4 backdrop-blur-xl rounded-2xl flex items-center gap-4 min-w-[140px] shadow-2xl"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                            <div className="text-orange-500 animate-pulse text-xl">🔥</div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-slate-500 font-bold text-[8px] uppercase tracking-widest">COMBO</span>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-slate-900 font-black font-heading italic text-2xl leading-none">{combo.toString().padStart(2, '0')}</span>
                                                {combo > 5 && (
                                                    <span className="text-amber-500 font-black text-sm italic">x{combo > 15 ? 4 : 2}</span>
                                                )}
                                            </div>
                                            <span className="text-amber-600/80 text-[8px] font-bold uppercase tracking-widest">कॉम्बो</span>
                                        </div>
                                    </motion.div>

                                    <motion.div 
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.1 }}
                                        className="glass-card bg-white/90 border-saffron/20 p-4 backdrop-blur-xl rounded-2xl flex items-center gap-4 min-w-[140px] shadow-2xl"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-amber-sacred/20 flex items-center justify-center">
                                            <Star className="w-6 h-6 text-saffron fill-saffron" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-slate-500 font-bold text-[8px] uppercase tracking-widest">BEST</span>
                                            <span className="text-slate-900 font-black font-heading italic text-2xl leading-none">{bestCombo.toString().padStart(2, '0')}</span>
                                            <span className="text-amber-600/80 text-[8px] font-bold uppercase tracking-widest">सर्वश्रेष्ठ</span>
                                        </div>
                                    </motion.div>
                                </div>

                                {/* Right Side: HUD */}
                                <div className="flex flex-col items-end gap-4">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFullscreen();
                                        }}
                                        className="glass-card bg-white/90 border-saffron/40 p-5 hover:bg-saffron hover:text-white transition-all group shadow-2xl backdrop-blur-md rounded-2xl relative z-[100]"
                                        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                                    >
                                        {isFullscreen ? (
                                            <Minimize className="w-8 h-8 text-saffron group-hover:text-white transition-transform group-hover:scale-110" />
                                        ) : (
                                            <Maximize className="w-8 h-8 text-saffron group-hover:text-white transition-transform group-hover:scale-110" />
                                        )}
                                    </button>
                                    
                                    <motion.div 
                                        initial={{ x: 20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className="glass-card bg-white/90 border-saffron/20 p-4 backdrop-blur-xl rounded-2xl flex items-center justify-end gap-3 min-w-[120px] shadow-2xl md:hidden"
                                    >
                                        <div className="flex flex-col items-end">
                                            <span className="text-slate-500 font-bold text-[8px] uppercase tracking-widest">SCORE</span>
                                            <span className="text-emerald-500 font-black font-heading italic text-2xl leading-none">{score}</span>
                                        </div>
                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                            <Trophy className="w-4 h-4 text-emerald-500" />
                                        </div>
                                    </motion.div>
                                </div>
                            </div>

                            {/* Floating Score Sidepanel REMOVED in favor of dashboard */}

                            <div className="flex-1 flex flex-col items-center justify-center">
                                {/* The PRACTICE and EAR TRAINING central visualization have been moved down to the Dashboard area so Vitthal image is fully visible */}
                            </div>

                            {/* MAJESTIC BOTTOM PANEL */}
                            <div className="relative z-50">
                                {/* Arched Golden Dashboard */}
                                <div className="max-w-7xl mx-auto px-4 pb-2">
                                    <div className="relative h-64 md:h-72 w-full bg-transparent flex flex-col items-center justify-center pt-8 overflow-hidden">
                                        {/* Golden Arched Border */}
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[110%] h-[120%] border-[12px] border-amber-sacred/5 rounded-[100%] pointer-events-none" />
                                        
                                        <div className="relative z-10 w-full flex items-center justify-between px-4 md:px-8 h-full pb-8 gap-4 md:gap-6">
                                            {/* LEFT: Score Section */}
                                            <div className="glass-card bg-white/90 border-saffron/20 p-4 backdrop-blur-xl rounded-3xl shadow-xl flex flex-col items-center justify-center w-32 md:w-48 lg:w-64 space-y-2 h-4/5 hidden md:flex shrink-0">
                                                <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">YOUR SCORE</span>
                                                <div className="flex flex-col items-center leading-none">
                                                    <span className="text-5xl lg:text-7xl font-black font-heading italic text-slate-900 tabular-nums">
                                                        {score} <span className="text-2xl lg:text-4xl text-slate-400">/ {getMaxScore()}</span>
                                                    </span>
                                                    <span className="text-emerald-600 font-black text-xl md:text-2xl font-heading italic">Points</span>
                                                    <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest mt-1">आपके अंक</span>
                                                </div>
                                            </div>

                                            {/* CENTER: Main Controls */}
                                            <div className="flex-1 flex flex-col items-center justify-center h-4/5 pt-6 w-full min-w-0">
                                                {activeStep.type === 'PRACTICE' && (
                                                    <div className="flex justify-center relative w-full h-[160px] md:h-[200px] overflow-hidden rounded-3xl bg-slate-900/5 backdrop-blur-xl border border-white/50 shadow-inner max-w-2xl mx-auto">
                                                        {/* Timeline Line */}
                                                        <div className="absolute left-0 right-0 top-1/2 h-1 bg-black/10 -translate-y-1/2" />
                                                        
                                                        {/* Target Marker */}
                                                        <div className="absolute top-1/2 -translate-y-1/2 left-[30%] w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-black/10 bg-white/20 -translate-x-1/2 z-10 backdrop-blur-sm overflow-hidden pointer-events-none">
                                                            <AnimatePresence>
                                                                {feedback && (
                                                                    <motion.div
                                                                        key={`flash-${feedback.id}`}
                                                                        initial={{ opacity: 0.8, scale: 0.5 }}
                                                                        animate={{ opacity: 0, scale: 1.5 }}
                                                                        exit={{ opacity: 0 }}
                                                                        transition={{ duration: 0.5, ease: 'easeOut' }}
                                                                        className={cn(
                                                                            "absolute inset-0 rounded-full mix-blend-overlay",
                                                                            feedback.type === 'CORRECT' ? "bg-emerald-500" : "bg-red-500"
                                                                        )}
                                                                    />
                                                                )}
                                                            </AnimatePresence>
                                                        </div>

                                                        <div className="absolute inset-0 z-20">
                                                            <AnimatePresence>
                                                                {activeLesson?.sequence.map((strike, idx) => {
                                                                    if (idx < noteIndex - 1 || idx > noteIndex + 5) return null;
                                                                    
                                                                    const isCurrent = idx === noteIndex;
                                                                    const isJustPast = idx === noteIndex - 1 && feedback;
                                                                    const isPast = idx < noteIndex - (feedback ? 1 : 0);
                                                                    const offset = idx - noteIndex;

                                                                    let currentScale = isCurrent ? 1 : 0.8;
                                                                    let currentOpacity = isPast ? 0 : offset > 4 ? 0 : 1;
                                                                    let currentBorder = strike === 'OPEN' ? "border-orange-400 text-orange-400" : "border-blue-400 text-blue-400";

                                                                    if (isJustPast) {
                                                                        currentScale = 1.3;
                                                                        currentOpacity = 0;
                                                                        currentBorder = feedback.type === 'CORRECT' ? "border-emerald-500 text-emerald-500" : "border-red-500 text-red-500";
                                                                    }

                                                                    return (
                                                                        <motion.div
                                                                            key={idx}
                                                                            initial={{ left: '100%', opacity: 0 }}
                                                                            animate={{ 
                                                                                left: `calc(30% + ${offset * 140}px)`, 
                                                                                x: '-50%',
                                                                                opacity: currentOpacity,
                                                                                scale: currentScale,
                                                                                filter: isCurrent ? "blur(0px)" : "blur(2px)"
                                                                            }}
                                                                            exit={{ opacity: 0, scale: 0.5 }}
                                                                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                                                            className={cn(
                                                                                "absolute top-1/2 -translate-y-1/2 w-24 h-24 md:w-32 md:h-32 rounded-[2rem] border-[6px] flex flex-col items-center justify-center font-black transition-colors bg-white shadow-xl",
                                                                                currentBorder
                                                                            )}
                                                                        >
                                                                            {/* Approach Ring for Current */}
                                                                            {isCurrent && isRecording && (
                                                                                <motion.div 
                                                                                    key={`ring-${idx}`}
                                                                                    animate={{ 
                                                                                        scale: [2, 1],
                                                                                        borderWidth: ["2px", "4px"],
                                                                                        opacity: [0, 1]
                                                                                    }}
                                                                                    transition={{ 
                                                                                        duration: 60 / bpm, 
                                                                                        ease: 'linear',
                                                                                        repeat: Infinity
                                                                                    }}
                                                                                    className={cn(
                                                                                        "absolute inset-0 rounded-[2rem] border-4 pointer-events-none",
                                                                                        strike === 'OPEN' ? "border-orange-500" : "border-blue-500"
                                                                                    )}
                                                                                />
                                                                            )}

                                                                            <div className="w-10 h-10 md:w-14 md:h-14 mb-1 z-10">
                                                                                <img 
                                                                                    src={strike === 'OPEN' ? "/open_strike.gif" : "/close_strike.gif"} 
                                                                                    className="w-full h-full object-contain mix-blend-multiply drop-shadow-sm opacity-90"
                                                                                    alt={strike}
                                                                                />
                                                                            </div>
                                                                            <span className="text-xl md:text-2xl font-black font-heading italic uppercase tracking-tighter z-10 leading-none">
                                                                                {strike}
                                                                            </span>
                                                                            <span className="text-[8px] uppercase tracking-widest font-black opacity-60 mt-1 z-10 line-clamp-1">
                                                                                {strike === 'OPEN' ? 'खुला' : 'बंद'}
                                                                            </span>
                                                                        </motion.div>
                                                                    );
                                                                })}
                                                            </AnimatePresence>
                                                        </div>
                                                        {feedback && (
                                                            <motion.div
                                                                key={feedback.id}
                                                                initial={{ opacity: 0, scale: 0.5, y: -20 }}
                                                                animate={{ opacity: 1, scale: 1.2, y: -60 }}
                                                                exit={{ opacity: 0 }}
                                                                className="absolute left-[30%] -translate-x-1/2 -top-12 flex flex-col items-center justify-center pointer-events-none z-50 whitespace-nowrap"
                                                            >
                                                                <span className={cn(
                                                                    "text-2xl font-black font-heading italic uppercase tracking-tighter drop-shadow-[0_2px_10px_white]",
                                                                    feedback.type === 'CORRECT' ? 
                                                                        'text-emerald-500' : 
                                                                        "text-red-500"
                                                                )}>
                                                                    {feedback.verdict || (feedback.type === 'CORRECT' ? 'CORRECT' : 'INCORRECT')}
                                                                </span>
                                                                {feedback.points ? (
                                                                    <span className="text-xs font-black text-amber-500 mt-1 bg-white/90 shadow-sm border border-amber-100 px-2 py-0.5 rounded-full">
                                                                        +{feedback.points}
                                                                    </span>
                                                                ) : null}
                                                            </motion.div>
                                                        )}
                                                    </div>
                                                )}
                                                {activeStep.type === 'EAR_TRAINING' && (
                                                    <>
                                                        <div className="flex flex-col items-center">
                                                            <div className="flex flex-col items-center relative mb-8">
                                                                <motion.button
                                                                    whileHover={{ scale: 1.1 }}
                                                                    whileTap={{ scale: 0.95 }}
                                                                    onClick={() => startEarTrainingLevel()}
                                                                    className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.5)] flex items-center justify-center group border-[8px] border-white/40 backdrop-blur-md relative overflow-hidden"
                                                                >
                                                                    <Play className="w-12 h-12 md:w-16 md:h-16 text-white ml-2 fill-white group-hover:scale-110 transition-transform drop-shadow-md" />
                                                                    <AnimatePresence>
                                                                        {feedback && (
                                                                            <motion.div
                                                                                key={`flash-ear-${feedback.id}`}
                                                                                initial={{ opacity: 0.8 }}
                                                                                animate={{ opacity: 0 }}
                                                                                exit={{ opacity: 0 }}
                                                                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                                                                className={cn(
                                                                                    "absolute inset-0 z-10",
                                                                                    feedback.type === 'CORRECT' ? "bg-white" : "bg-red-500"
                                                                                )}
                                                                            />
                                                                        )}
                                                                    </AnimatePresence>
                                                                </motion.button>
                                                            </div>

                                                            <div className="text-slate-600 font-black text-xs md:text-sm uppercase tracking-widest text-center px-4 bg-white/50 py-3 rounded-2xl backdrop-blur-sm border border-slate-200/50 shadow-sm max-w-sm">
                                                                Listen to the sound and press play to hear the sound!
                                                                <span className="block text-[10px] mt-1 opacity-60">आवाज सुनें और इसे पहचानने के लिए प्ले दबाएं!</span>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* RIGHT: Recent Strikes */}
                                            <div className="glass-card bg-white/90 border-saffron/20 p-4 backdrop-blur-xl rounded-3xl shadow-xl w-32 md:w-48 lg:w-64 flex flex-col items-center justify-center space-y-4 h-4/5 hidden md:flex shrink-0">
                                                <div className="text-center">
                                                    <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">RECENT STRIKES</span>
                                                    <p className="text-[10px] opacity-60">हाल के प्रहार</p>
                                                </div>
                                                
                                                <div className={cn(
                                                    "grid gap-1.5 md:gap-2",
                                                    hitHistory.slice(-20).length > 10 ? "grid-cols-5 md:grid-cols-4 lg:grid-cols-5" : "grid-cols-5"
                                                )}>
                                                    {hitHistory.slice(-20).map((hit, i) => (
                                                        <div key={i} className={cn(
                                                            "w-3 h-3 md:w-4 md:h-4 lg:w-5 lg:h-5 rounded-full border-2 shadow-inner",
                                                            hit === 'CORRECT' ? "bg-emerald-500 border-emerald-300" :
                                                            hit === 'WRONG' ? "bg-red-500 border-red-300" :
                                                            "bg-slate-200 border-slate-100"
                                                        )} />
                                                    ))}
                                                </div>

                                                <div className="flex gap-4 text-[8px] font-black uppercase tracking-widest mt-2">
                                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> CORRECT</div>
                                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /> INCORRECT</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

             {gameState === 'RESULT' && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                        "absolute inset-0 overflow-y-auto z-[110]",
                        isFullscreen ? "bg-stone-50" : "bg-white/80"
                    )}
                >
                    {isFullscreen && (
                        <div className="fixed inset-0 z-0 pointer-events-none">
                            <video 
                                autoPlay 
                                loop 
                                muted 
                                playsInline
                                className="w-full h-full object-cover opacity-20"
                            >
                                <source src="/pune-bg.mp4" type="video/mp4" />
                            </video>
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" />
                        </div>
                    )}
                    <div className="relative z-10 flex flex-col items-center justify-start min-h-full p-4 md:p-8 space-y-12 pb-32 pt-8">
                        {isPassedResult && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5, y: -20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
                                className="glass-card bg-emerald-500/10 border border-emerald-500/30 p-4 md:p-6 rounded-3xl backdrop-blur-xl shadow-[0_0_80px_rgba(16,185,129,0.3)] flex flex-col items-center mb-4 z-20 w-full max-w-2xl px-6 md:px-12"
                            >
                                <motion.div 
                                    animate={{ 
                                        boxShadow: ['0 0 20px rgba(16,185,129,0.4)', '0 0 60px rgba(16,185,129,0.8)', '0 0 20px rgba(16,185,129,0.4)']
                                    }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-4"
                                >
                                    <Trophy className="w-8 h-8" />
                                </motion.div>
                                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-emerald-600 drop-shadow-sm text-center">Lesson Complete</h2>
                                <p className="text-emerald-700/80 text-xs md:text-sm font-bold mt-2 uppercase tracking-[0.2em] text-center">Great Job!</p>
                            </motion.div>
                        )}
                        <div className={cn("w-full transition-all duration-500", isPassedResult ? "opacity-100" : "opacity-100")}>
                            <SessionDashboard 
                                stats={sessionStats}
                                accuracy={sessionStats.correctType + sessionStats.incorrectType > 0 ? (sessionStats.correctType / (sessionStats.correctType + sessionStats.incorrectType)) * 100 : 0}
                                combo={combo}
                                title={activeStep.type === 'PRACTICE' ? activeLesson?.name : "Ear Training Complete"}
                                hideTiming={true}
                                onRestart={startCurrentStep}
                                onHome={nextStep}
                                isFullscreen={isFullscreen}
                                homeLabel={currentStepIndex < JOURNEY_STEPS.length - 1 ? "NEXT STEP" : "BACK TO MENU"}
                                hideButtons={true}
                            />
                        </div>

                        {activeStep.type === 'EAR_TRAINING' && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="w-full max-w-4xl mx-auto space-y-6"
                            >
                                <div className="text-center mb-8">
                                    <h3 className="text-3xl md:text-4xl font-black font-heading italic uppercase tracking-tighter text-slate-800">
                                        Journey <span className="text-saffron">Summary</span>
                                    </h3>
                                    <p className="text-xs md:text-sm font-black tracking-widest text-slate-400 mt-2 uppercase">All basic techniques unlocked</p>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Top Row: Open and Closed */}
                                    <div className="glass-card bg-white/70 border-orange-400/30 p-8 flex flex-col items-center justify-center rounded-[2rem] shadow-sm gap-2 relative overflow-hidden group hover:scale-[1.02] transition-transform">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 blur-[2px] pointer-events-none group-hover:blur-none group-hover:opacity-20 transition-all">
                                            <img src="/open_strike.gif" className="w-32 h-32 object-cover mix-blend-multiply" alt="" />
                                        </div>
                                        <div className="flex items-center gap-2 mb-4 z-10 w-full justify-between">
                                            <div className="text-emerald-500 bg-emerald-50 p-2.5 rounded-xl shadow-inner">
                                                <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8" />
                                            </div>
                                            <span className="text-[10px] md:text-xs font-black text-slate-400 bg-white/80 px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">Completed</span>
                                        </div>
                                        <div className="z-10 w-full text-left">
                                            <div className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-orange-500 mb-1">Open Strike</div>
                                            <p className="text-xs md:text-sm text-slate-500 font-medium">Mastered the resonant open ring</p>
                                        </div>
                                    </div>

                                    <div className="glass-card bg-white/70 border-blue-400/30 p-8 flex flex-col items-center justify-center rounded-[2rem] shadow-sm gap-2 relative overflow-hidden group hover:scale-[1.02] transition-transform">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 blur-[2px] pointer-events-none group-hover:blur-none group-hover:opacity-20 transition-all">
                                            <img src="/close_strike.gif" className="w-32 h-32 object-cover mix-blend-multiply" alt="" />
                                        </div>
                                        <div className="flex items-center gap-2 mb-4 z-10 w-full justify-between">
                                            <div className="text-emerald-500 bg-emerald-50 p-2.5 rounded-xl shadow-inner">
                                                <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8" />
                                            </div>
                                            <span className="text-[10px] md:text-xs font-black text-slate-400 bg-white/80 px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">Completed</span>
                                        </div>
                                        <div className="z-10 w-full text-left">
                                            <div className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-blue-500 mb-1">Closed Strike</div>
                                            <p className="text-xs md:text-sm text-slate-500 font-medium">Mastered the dampened sharp sound</p>
                                        </div>
                                    </div>

                                    {/* Second Row: Alternate and Ear Training */}
                                    <div className="glass-card bg-white/70 border-purple-400/30 p-8 flex flex-col items-center justify-center rounded-[2rem] shadow-sm gap-2 relative overflow-hidden group hover:scale-[1.02] transition-transform">
                                        <div className="flex items-center gap-2 mb-4 w-full justify-between">
                                            <div className="text-emerald-500 bg-emerald-50 p-2.5 rounded-xl shadow-inner">
                                                <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8" />
                                            </div>
                                            <span className="text-[10px] md:text-xs font-black text-slate-400 bg-white/80 px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">Completed</span>
                                        </div>
                                        <div className="w-full text-left">
                                            <div className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-purple-500 mb-1">Alternate Strike</div>
                                            <p className="text-xs md:text-sm text-slate-500 font-medium">Combined basic strokes in rhythm</p>
                                        </div>
                                    </div>

                                    <div className="glass-card bg-white/70 border-emerald-400/30 p-8 flex flex-col items-center justify-center rounded-[2rem] shadow-sm gap-2 relative overflow-hidden group hover:scale-[1.02] transition-transform">
                                        <div className="flex items-center gap-2 mb-4 w-full justify-between">
                                            <div className="text-emerald-500 bg-emerald-50 p-2.5 rounded-xl shadow-inner">
                                                <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8" />
                                            </div>
                                            <span className="text-[10px] md:text-xs font-black text-slate-400 bg-white/80 px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">Completed</span>
                                        </div>
                                        <div className="w-full text-left">
                                            <div className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-emerald-500 mb-1">Ear Training</div>
                                            <p className="text-xs md:text-sm text-slate-500 font-medium">Trained to hear the variations</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            )}

            </AnimatePresence>

            {/* Unified Fixed Footer Navigation */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 flex items-center justify-between z-[150] pointer-events-none">
                {/* Left: Back */}
                <div className="pointer-events-auto w-1/3 flex justify-start">
                    {currentStepIndex > 0 || gameState !== 'IDLE' ? (
                        <button onClick={() => {
                            if (gameState === 'IDLE') {
                                setCurrentStepIndex(c => Math.max(0, c - 1));
                            } else {
                                setGameState('IDLE');
                            }
                        }} className="px-4 py-3 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 hover:bg-white text-slate-700 font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 hover:scale-105 active:scale-95">
                            <ArrowRight className="w-4 h-4 md:w-5 md:h-5 rotate-180" /> <span className="hidden sm:inline">BACK</span><span className="sm:hidden">BACK</span>
                        </button>
                    ) : (
                        <div />
                    )}
                </div>

                {/* Center: Progress Dots */}
                <div className="pointer-events-auto hidden md:flex items-center justify-center gap-3 w-1/3">
                    {JOURNEY_STEPS.map((_, idx) => (
                        <div 
                            key={idx}
                            className={cn(
                                "w-3 h-3 rounded-full transition-all duration-500 shadow-sm",
                                idx === currentStepIndex ? "bg-saffron scale-125 shadow-[0_0_12px_rgba(251,146,60,0.6)]" : 
                                idx < currentStepIndex ? "bg-emerald-500/80" : "bg-black/10 backdrop-blur-md border border-white/40"
                            )}
                        />
                    ))}
                </div>

                {/* Right: Next / Start Actions */}
                <div className="pointer-events-auto w-1/3 flex justify-end gap-3">
                    {gameState === 'IDLE' && (
                        <button onClick={startCurrentStep} className="px-6 py-3 bg-saffron border border-saffron hover:bg-amber-500 text-black font-black text-[10px] md:text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-saffron/30 flex items-center gap-2 hover:scale-105 active:scale-95">
                            START PRACTICE <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                    )}
                    {gameState === 'INTRO' && (
                        <button onClick={() => nextStep(true)} className="px-6 py-3 bg-emerald-500 border border-emerald-400 hover:bg-emerald-400 text-white font-black text-[10px] md:text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-emerald-500/30 flex items-center gap-2 hover:scale-105 active:scale-95 animate-pulse">
                            READY TO PLAY <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                    )}
                    {gameState === 'PLAYING' && (
                        <button onClick={stopStep} className="px-6 py-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-black text-[10px] md:text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-slate-900/40 flex items-center gap-2 hover:scale-105 active:scale-95">
                            FINISH <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                    )}
                    {gameState === 'RESULT' && (
                        <>
                            <button onClick={startCurrentStep} className="px-4 py-3 bg-white/80 border border-slate-200 hover:bg-white text-slate-700 font-black text-[10px] md:text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg flex items-center gap-2 hover:scale-105 active:scale-95">
                                <RotateCcw className="w-4 h-4 md:w-5 md:h-5" /> <span className="hidden sm:inline">RETRY</span>
                            </button>
                            <button onClick={() => nextStep(false)} className="px-6 py-3 bg-emerald-500 border border-emerald-400 hover:bg-emerald-400 text-white font-black text-[10px] md:text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-emerald-500/30 flex items-center gap-2 hover:scale-105 active:scale-95">
                                {currentStepIndex < JOURNEY_STEPS.length - 1 ? "NEXT STEP" : "MENU"} <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                        </>
                    )}
                </div>
            </div>
            </div>
        </div>
    );
};
