import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAppStore } from "../../store/useAppStore";
import {
  Play,
  Settings,
  Timer,
  Zap,
  Trophy,
  RefreshCcw,
  Maximize,
  Minimize,
  ChevronLeft,
  Music,
  Clock,
  Target,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { CalibrationWizard } from "../calibration/CalibrationWizard";
import { SessionDashboard } from "./SessionDashboard";
import { WaveformOverlay } from "./WaveformOverlay";
import { TrainingLedger } from "../../lib/rhythm";
import { ambienceService } from "../../services/ambienceService";
import confetti from "canvas-confetti";

type TrainingScreen = "SETUP" | "CALIBRATE" | "TRAINING" | "RESULT";

const SPEEDS = [
  { label: "Slow", bpm: 60, icon: Clock },
  { label: "Medium", bpm: 90, icon: Music },
  { label: "Fast", bpm: 120, icon: Zap },
  { label: "Extreme", bpm: 150, icon: Zap },
];

const PATTERNS = [
  {
    label: "Roopak Taal (7 Beats)",
    desc: "Tin Tin Na Dhin Na Dhin Na",
    pattern: [
      "CLOSED",
      "NONE",
      "OPEN",
      "CLOSED",
      "OPEN",
      "CLOSED",
      "OPEN",
    ] as StrikeType[],
  },
  {
    label: "Keherwa (8 Beats)",
    desc: "Classic Bhajan Variation",
    pattern: [
      "CLOSED",
      "OPEN",
      "CLOSED",
      "NONE",
      "CLOSED",
      "OPEN",
      "CLOSED",
      "NONE",
    ] as StrikeType[],
  },
  {
    label: "Basic 4-Beat",
    desc: "Continuous striking",
    pattern: ["CLOSED", "OPEN", "CLOSED", "OPEN"] as StrikeType[],
  },
  {
    label: "Alternate Beats",
    desc: "Play on 1 and 3",
    pattern: ["CLOSED", "NONE", "OPEN", "NONE"] as StrikeType[],
  },
];

type StrikeType = "OPEN" | "CLOSED" | "NONE";

interface PulseNote {
  id: number;
  type: StrikeType;
  beatAbsolute: number;
}

export const RhythmTraining: React.FC = () => {
  const {
    setRecording,
    setMetronomeActive,
    setBpm,
    setTimeSignature,
    lastStrike,
    accuracy,
    combo,
    sessionStats,
    evaluateStrike,
    resetGameplay,
    metronomeStartMs,
    calibration,
    audioStatus,
  } = useAppStore();

  const [screen, setScreen] = useState<TrainingScreen>("SETUP");
  const [selectedBpm, setSelectedBpm] = useState(90);
  const [selectedPatternIndex, setSelectedPatternIndex] = useState(0);
  const [beatsRemaining, setBeatsRemaining] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [score, setScore] = useState(0);
  const [upcomingNotes, setUpcomingNotes] = useState<PulseNote[]>([]);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [hitFeedback, setHitFeedback] = useState<{
    id: string;
    type: "PERFECT" | "GOOD" | "MISS";
    beatAbsolute: number;
  } | null>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const ledger = useRef<TrainingLedger | null>(null);
  const ended = useRef(false);
  const requestRef = useRef<number>(0);
  const lastProcessedStrikeId = useRef<string | null>(null);

  const [totalBeats, setTotalBeats] = useState(64);

  const TOTAL_MEASURES = 8;

  const toggleFullscreen = async () => {
    if (!arenaRef.current) return;
    try {
      if (isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false);
        return;
      }
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
      setIsFullscreen(!isFullscreen);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement)
        setIsFullscreen(false);
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", escape);
    };
  }, [isFullscreen]);

  // Main Game Loop
  useEffect(() => {
    const animate = () => {
      if (screen !== "TRAINING") return;

      if (metronomeStartMs === null || ended.current) return;
      const now = performance.now();
      const missed =
        ledger.current?.expire(
          now - 100 - calibration.inputLatency,
          metronomeStartMs,
        ) ?? [];
      if (missed.length) useAppStore.getState().addMissedNotes(missed.length);
      const elapsedSeconds = (now - metronomeStartMs) / 1000;
      const beatsElapsed = (elapsedSeconds * selectedBpm) / 60;
      setCurrentBeat(beatsElapsed);

      const remaining = Math.max(
        0,
        totalBeats - Math.max(0, Math.floor(beatsElapsed)),
      );
      setBeatsRemaining(remaining);

      if (remaining <= 0) {
        finishTraining();
        return;
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    if (screen === "TRAINING" && metronomeStartMs !== null) {
      requestRef.current = requestAnimationFrame(animate);
    }

    return () => cancelAnimationFrame(requestRef.current);
  }, [
    screen,
    selectedBpm,
    totalBeats,
    metronomeStartMs,
    calibration.inputLatency,
  ]);

  // Points and Evaluation logic - Track by Strike ID
  useEffect(() => {
    if (
      screen === "TRAINING" &&
      lastStrike &&
      lastStrike.id !== lastProcessedStrikeId.current
    ) {
      lastProcessedStrikeId.current = lastStrike.id;

      if (metronomeStartMs === null || !ledger.current) return;
      const result = ledger.current.hit(
        lastStrike.timestamp,
        metronomeStartMs,
        lastStrike.label,
      );
      evaluateStrike(result.correct);
      if (result.correct)
        setScore((s) => s + (result.verdict === "PERFECT" ? 100 : 50));
      setHitFeedback({
        id: lastStrike.id,
        type: result.correct
          ? result.verdict === "PERFECT"
            ? "PERFECT"
            : "GOOD"
          : "MISS",
        beatAbsolute: result.beat,
      });
    }
  }, [lastStrike, screen, metronomeStartMs]);

  const startTraining = () => {
    if (!isFullscreen) void toggleFullscreen();
    ended.current = false;
    ambienceService.start();

    const selectedPattern = PATTERNS[selectedPatternIndex].pattern;
    const currentTotalBeats = TOTAL_MEASURES * selectedPattern.length;

    setBpm(selectedBpm);
    setTimeSignature(selectedPattern.length);
    setTotalBeats(currentTotalBeats);
    setBeatsRemaining(currentTotalBeats);
    setScore(0);
    resetGameplay();
    lastProcessedStrikeId.current = null;

    // Generate upcoming notes for the whole session
    const notes: PulseNote[] = [];
    for (let i = 0; i < currentTotalBeats; i++) {
      const type = selectedPattern[i % selectedPattern.length];
      notes.push({ id: i, type, beatAbsolute: i });
    }
    setUpcomingNotes(notes);

    ledger.current = new TrainingLedger(
      notes.map((note) => note.type),
      selectedBpm,
    );
    setCurrentBeat(0);
    setScreen("TRAINING");
    setRecording(true);
    setMetronomeActive(true);
  };

  useEffect(
    () => () => {
      ended.current = true;
      useAppStore.getState().setRecording(false);
      useAppStore.getState().setMetronomeActive(false);
      ambienceService.stop();
    },
    [],
  );
  useEffect(() => {
    if (audioStatus === "error" && screen === "TRAINING") {
      ended.current = true;
      setRecording(false);
      setMetronomeActive(false);
      setScreen("SETUP");
    }
  }, [audioStatus, screen]);
  const finishTraining = () => {
    if (ended.current) return;
    ended.current = true;
    useAppStore
      .getState()
      .saveSession(`${PATTERNS[selectedPatternIndex].label} rhythm practice`);
    setRecording(false);
    setMetronomeActive(false);
    setScreen("RESULT");
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#fb923c", "#f59e0b", "#FFFFFF"],
    });
  };

  return (
    <div
      ref={arenaRef}
      className={cn(
        "legacy-practice w-full transition-all duration-700",
        isFullscreen
          ? "fixed inset-0 z-[100] bg-stone-50 flex items-center justify-center"
          : "relative",
      )}
    >
      <AnimatePresence mode="wait">
        {screen === "SETUP" && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl mx-auto w-full space-y-8 p-4"
          >
            <div className="absolute top-8 right-8 z-50">
              <button
                onClick={toggleFullscreen}
                className="glass-card bg-white/40 border-amber-900/10 p-4 hover:bg-white/60 transition-all group rounded-2xl shadow-xl"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize className="w-6 h-6 text-saffron group-hover:scale-110 transition-transform" />
                ) : (
                  <Maximize className="w-6 h-6 text-saffron group-hover:scale-110 transition-transform" />
                )}
              </button>
            </div>

            <div className="text-center space-y-4 mb-12">
              <h2 className="text-5xl font-black font-heading italic uppercase tracking-tighter text-saffron">
                Rhythm Practice
              </h2>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-[0.4em]">
                Master the fundamental beat patterns
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Speed Selection */}
              <div className="glass-card p-8 bg-white/80 border-amber-900/10 shadow-2xl backdrop-blur-xl rounded-3xl">
                <div className="flex items-center gap-3 mb-8">
                  <Zap className="text-saffron w-5 h-5" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Select Speed
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {SPEEDS.map((s) => (
                    <button
                      key={s.bpm}
                      onClick={() => setSelectedBpm(s.bpm)}
                      className={cn(
                        "p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group",
                        selectedBpm === s.bpm
                          ? "bg-saffron border-saffron text-white shadow-lg shadow-orange-500/20"
                          : "bg-white border-slate-200 text-slate-500 hover:bg-orange-50 hover:border-orange-200 hover:text-slate-700",
                      )}
                    >
                      <s.icon
                        className={cn(
                          "w-6 h-6",
                          selectedBpm === s.bpm
                            ? "text-white"
                            : "text-slate-400",
                        )}
                      />
                      <span className="text-sm font-black uppercase tracking-tighter italic">
                        {s.label}
                      </span>
                      <span className="text-[10px] font-bold opacity-60">
                        {s.bpm} BPM
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pattern Selection */}
              <div className="glass-card p-8 bg-white/80 border-amber-900/10 shadow-2xl backdrop-blur-xl rounded-3xl">
                <div className="flex items-center gap-3 mb-8">
                  <Target className="text-saffron w-5 h-5" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Select Pattern
                  </h3>
                </div>
                <div className="space-y-4">
                  {PATTERNS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPatternIndex(idx)}
                      className={cn(
                        "w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between group",
                        selectedPatternIndex === idx
                          ? "bg-amber-sacred border-amber-sacred text-white shadow-lg shadow-amber-500/20"
                          : "bg-white border-slate-200 text-slate-500 hover:bg-amber-50 hover:border-amber-200 hover:text-slate-700",
                      )}
                    >
                      <div className="flex flex-col items-start pr-4 text-left">
                        <span className="text-sm font-black uppercase tracking-widest italic">
                          {p.label}
                        </span>
                        <span className="text-[10px] font-medium opacity-70">
                          {p.desc}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {p.pattern.map((strike, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-3 h-3 rounded-full",
                              strike === "OPEN"
                                ? selectedPatternIndex === idx
                                  ? "bg-white"
                                  : "bg-orange-400"
                                : strike === "CLOSED"
                                  ? selectedPatternIndex === idx
                                    ? "bg-white/80"
                                    : "bg-blue-400"
                                  : selectedPatternIndex === idx
                                    ? "bg-white/20"
                                    : "bg-slate-200",
                            )}
                          />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-8">
              <button
                onClick={startTraining}
                className="w-full py-4 md:py-6 bg-gradient-to-r from-saffron to-amber-600 text-white rounded-[2rem] font-black text-xs md:text-sm uppercase tracking-[0.2em] md:tracking-[0.4em] italic shadow-2xl shadow-orange-200 flex items-center justify-center gap-2 md:gap-4 hover:scale-[1.02] active:scale-95 transition-all group"
              >
                <Play className="w-6 h-6 fill-white group-hover:rotate-12 transition-transform" />{" "}
                START TRAINING
              </button>
            </div>
          </motion.div>
        )}

        {screen === "TRAINING" && (
          <motion.div
            key="training"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
              "relative w-full overflow-hidden shadow-2xl bg-stone-50 transition-all",
              isFullscreen
                ? "h-full w-full rounded-none border-0"
                : "max-w-[1600px] mx-auto aspect-[3/4] sm:aspect-[4/3] sm:aspect-[16/9] md:aspect-[21/8] min-h-[550px] sm:min-h-0 rounded-2xl md:rounded-[3rem] border-4 md:border-8 border-amber-900/10",
            )}
          >
            {/* Background */}
            <div className="absolute inset-0">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover opacity-30 mix-blend-multiply"
              >
                <source src="/pune-bg.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-white/60" />
            </div>

            {/* Vitthal Centerpiece */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-24 pointer-events-none">
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 50 }}
                animate={{
                  scale: isFullscreen ? 1.1 : 1,
                  opacity: 0.9,
                  y: isFullscreen ? 20 : 0,
                }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="relative group"
              >
                <div
                  className={cn(
                    "absolute inset-0 bg-saffron/20 blur-[120px] rounded-full animate-pulse",
                    isFullscreen ? "scale-180" : "scale-150",
                  )}
                />
                <img
                  src="/vitthal_centerpiece.png"
                  alt="Vitthal Mauli"
                  className={cn(
                    "object-contain drop-shadow-[0_40px_80px_rgba(0,0,0,0.6)] relative z-10 transition-all duration-700",
                    isFullscreen ? "h-[85vh]" : "h-48 sm:h-80 md:h-[650px]",
                  )}
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-12 bg-black/10 blur-2xl rounded-[100%] translate-y-12" />
              </motion.div>
            </div>

            {/* Animated Diya Voice Flow */}
            <div className="absolute bottom-[200px] md:bottom-[240px] left-1/2 -translate-x-1/2 z-40 pointer-events-none flex items-center justify-center">
              <motion.div
                key={lastStrike?.id || "idle"}
                initial={false}
                animate={{
                  scale: lastStrike
                    ? lastStrike.label === "OPEN"
                      ? [1, 1.4, 1]
                      : [1, 1.1, 1]
                    : 1,
                  y: lastStrike
                    ? lastStrike.label === "CLOSED"
                      ? [0, -25, 0]
                      : [0, 5, 0]
                    : 0,
                  rotate: lastStrike
                    ? lastStrike.label === "OPEN"
                      ? [0, -8, 8, 0]
                      : [0, 5, -5, 0]
                    : 0,
                  filter: lastStrike
                    ? lastStrike.timingVerdict === "PERFECT"
                      ? "brightness(1.8)"
                      : "brightness(1.5)"
                    : "brightness(1)",
                }}
                transition={{ duration: 0.4, type: "tween", ease: "backOut" }}
                className="relative flex flex-col items-center"
              >
                {/* Glow Effect */}
                <motion.div
                  animate={{
                    opacity: lastStrike
                      ? lastStrike.label === "OPEN"
                        ? [0.4, 1, 0.4]
                        : [0.4, 0.8, 0.4]
                      : [0.3, 0.5, 0.3],
                    scale: lastStrike
                      ? lastStrike.label === "OPEN"
                        ? [1, 2.5, 1]
                        : [1, 1.5, 1]
                      : [1, 1.1, 1],
                    backgroundColor:
                      lastStrike?.timingVerdict === "PERFECT"
                        ? "#10b981"
                        : lastStrike?.timingVerdict === "NEAR"
                          ? "#eab308"
                          : lastStrike?.label === "CLOSED"
                            ? "#3b82f6"
                            : "#f97316",
                  }}
                  transition={{
                    duration: lastStrike ? 0.4 : 60 / selectedBpm,
                    repeat: lastStrike ? 0 : Infinity,
                  }}
                  className="absolute -top-8 w-20 h-20 blur-xl rounded-full mix-blend-screen"
                />

                {/* Diya Icon/Representation */}
                <div className="relative">
                  {/* Outer Aura */}
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{
                      duration: 60 / selectedBpm,
                      repeat: Infinity,
                    }}
                    className={cn(
                      "absolute inset-0 -m-4 rounded-full blur-md bg-gradient-to-t",
                      lastStrike?.timingVerdict === "PERFECT"
                        ? "from-emerald-500/30 to-emerald-300/30"
                        : lastStrike?.timingVerdict === "NEAR"
                          ? "from-yellow-500/30 to-yellow-300/30"
                          : lastStrike?.label === "CLOSED"
                            ? "from-blue-500/30 to-blue-300/30"
                            : "from-orange-500/30 to-yellow-300/30",
                    )}
                  />

                  {/* Flame */}
                  <motion.div
                    animate={{
                      scaleY: lastStrike
                        ? lastStrike.label === "OPEN"
                          ? [1, 1.5, 1]
                          : [1, 0.7, 1]
                        : [1, 1.2, 0.9, 1.1, 1],
                      scaleX: lastStrike
                        ? lastStrike.label === "OPEN"
                          ? [1, 1.3, 1]
                          : [1, 0.6, 1]
                        : [1, 1.05, 0.95, 1.05, 1],
                      opacity: [0.8, 1, 0.9, 1, 0.8],
                    }}
                    transition={
                      lastStrike
                        ? { duration: 0.3 }
                        : { repeat: Infinity, duration: 60 / selectedBpm }
                    }
                    className={cn(
                      "w-4 h-8 rounded-full blur-[1px] mx-auto mb-[-6px] relative z-20 shadow-[0_0_15px_rgba(255,255,255,0.8)] transition-colors duration-300",
                      lastStrike?.timingVerdict === "PERFECT"
                        ? "bg-gradient-to-t from-emerald-600 via-emerald-300 to-white"
                        : lastStrike?.timingVerdict === "NEAR"
                          ? "bg-gradient-to-t from-yellow-600 via-yellow-400 to-white"
                          : lastStrike?.label === "CLOSED"
                            ? "bg-gradient-to-t from-blue-600 via-blue-300 to-cyan-100"
                            : "bg-gradient-to-t from-orange-600 via-yellow-400 to-yellow-100",
                    )}
                  />
                  {/* Inner Flame Core */}
                  <motion.div className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-4 bg-white rounded-full blur-[1px] z-30 opacity-80" />

                  {/* Bowl */}
                  <div className="relative z-10 w-16 h-7">
                    <div className="absolute inset-0 bg-gradient-to-b from-amber-700 to-amber-950 rounded-b-full border-t-[1.5px] border-amber-400/80 shadow-lg overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-400/20" />
                      <div className="absolute inset-x-2 top-2 bottom-1 bg-amber-900/60 rounded-b-full blur-[1px]" />
                    </div>
                  </div>

                  {/* Base Reflection */}
                  <motion.div
                    animate={{ opacity: [0.3, 0.5, 0.3] }}
                    transition={{
                      repeat: Infinity,
                      duration: 60 / selectedBpm,
                    }}
                    className="w-12 h-2 bg-black/40 rounded-full mx-auto mt-2 blur-md"
                  />
                </div>
                <span
                  className={cn(
                    "mt-4 text-[8px] font-black tracking-[0.4em] uppercase transition-colors duration-300",
                    lastStrike?.timingVerdict === "PERFECT"
                      ? "text-emerald-500"
                      : lastStrike?.timingVerdict === "NEAR"
                        ? "text-yellow-600"
                        : lastStrike?.label === "CLOSED"
                          ? "text-blue-500"
                          : lastStrike?.label === "OPEN"
                            ? "text-orange-500"
                            : "text-slate-400",
                  )}
                >
                  {lastStrike ? lastStrike.timingVerdict : "Energy Core"}
                </span>
              </motion.div>
            </div>

            {/* HUD Top */}
            <div className="absolute top-0 left-0 right-0 p-4 md:p-12 flex justify-between items-start z-30">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-saffron animate-ping" />
                  <h2 className="text-xl md:text-4xl font-black font-heading italic text-slate-800 tracking-widest uppercase">
                    विठ्ठल <span className="text-saffron">RHYTHM</span>
                  </h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="px-4 py-2 bg-white/80 rounded-xl backdrop-blur-md border border-amber-900/10 flex items-center gap-3 shadow-sm">
                    <Zap className="w-4 h-4 text-saffron" />
                    <span className="text-xs font-black text-slate-700">
                      {selectedBpm} BPM
                    </span>
                  </div>
                  <div className="px-4 py-2 bg-white/80 rounded-xl backdrop-blur-md border border-amber-900/10 flex items-center gap-3 shadow-sm">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-black text-slate-700">
                      {beatsRemaining} BEATS LEFT
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={finishTraining}
                  className="glass-card bg-white/80 px-4 py-3 text-slate-700 text-xs font-black uppercase shadow-sm"
                >
                  Finish
                </button>
                <div className="glass-card bg-white border-amber-900/10 px-6 py-4 flex flex-col items-center min-w-[120px] shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    SCORE
                  </span>
                  <span className="text-2xl md:text-4xl font-black font-heading text-saffron italic leading-none">
                    {score.toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFullscreen();
                  }}
                  className="glass-card bg-white/80 border-amber-900/10 p-5 hover:bg-white transition-all group rounded-2xl relative z-[100] shadow-md"
                  title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize className="w-8 h-8 text-saffron group-hover:scale-110 transition-transform" />
                  ) : (
                    <Maximize className="w-8 h-8 text-saffron group-hover:scale-110 transition-transform" />
                  )}
                </button>
              </div>
            </div>

            {/* Waveform Diagnostics Overlay */}
            <div className="absolute right-4 md:right-12 bottom-32 md:bottom-40 z-50 scale-75 md:scale-100 origin-bottom-right">
              <WaveformOverlay
                expectedType={
                  upcomingNotes.length > 0
                    ? upcomingNotes.reduce(
                        (prev, curr) =>
                          Math.abs(curr.beatAbsolute - currentBeat) <
                          Math.abs(prev.beatAbsolute - currentBeat)
                            ? curr
                            : prev,
                        upcomingNotes[0],
                      )?.type
                    : undefined
                }
                lastStrike={lastStrike}
              />
            </div>

            {/* Dynamic Measure Display */}
            <div className="absolute inset-x-0 bottom-8 md:bottom-12 flex items-center justify-center gap-2 md:gap-6 z-30 pointer-events-none flex-wrap px-4">
              {[...Array(PATTERNS[selectedPatternIndex].pattern.length)].map(
                (_, beatIndex) => {
                  const plen = PATTERNS[selectedPatternIndex].pattern.length;
                  const measureStartBeat =
                    Math.floor(currentBeat / plen) * plen;
                  const beatAbsolute = measureStartBeat + beatIndex;
                  const note = upcomingNotes.find(
                    (n) => n.beatAbsolute === beatAbsolute,
                  );
                  const type = note?.type || "NONE";
                  const isActive = Math.floor(currentBeat) % plen === beatIndex;
                  // Add a little lookahead so it transitions smoothly
                  const isUpcoming =
                    beatAbsolute - currentBeat > 0 &&
                    beatAbsolute - currentBeat <= 1;
                  const feedback =
                    hitFeedback?.beatAbsolute === beatAbsolute
                      ? hitFeedback
                      : null;

                  return (
                    <div
                      key={beatIndex}
                      className="flex flex-col items-center gap-3"
                    >
                      <div
                        className={cn(
                          "rounded-2xl md:rounded-3xl border-4 flex flex-col items-center justify-center transition-all duration-300 backdrop-blur-md relative overflow-hidden",
                          PATTERNS[selectedPatternIndex].pattern.length >= 7
                            ? "w-16 h-16 md:w-24 md:h-24"
                            : "w-20 h-20 md:w-32 md:h-32",
                          isActive
                            ? "border-saffron scale-110 shadow-[0_0_40px_rgba(245,158,11,0.3)] bg-white"
                            : "border-amber-900/10 scale-100 bg-white/40",
                          type === "OPEN" && !isActive ? "bg-orange-50/80" : "",
                          type === "CLOSED" && !isActive ? "bg-blue-50/80" : "",
                        )}
                      >
                        {type !== "NONE" && (
                          <div className="absolute inset-0">
                            <img
                              src={
                                type === "OPEN"
                                  ? "/open_strike.gif"
                                  : "/close_strike.gif"
                              }
                              className={cn(
                                "w-full h-full object-cover transition-all duration-300",
                                isActive
                                  ? "opacity-100 scale-110"
                                  : isUpcoming
                                    ? "opacity-70 grayscale"
                                    : "opacity-30 grayscale",
                              )}
                              alt={
                                type === "OPEN"
                                  ? "Murda strike"
                                  : "Tardi strike"
                              }
                            />
                            <div className="absolute inset-0 bg-white/40" />
                          </div>
                        )}

                        {type === "NONE" && (
                          <div
                            className={cn(
                              "font-black transition-all",
                              isActive
                                ? "text-saffron text-5xl"
                                : "text-amber-900/20 text-4xl",
                            )}
                          >
                            -
                          </div>
                        )}

                        {/* Type Label */}
                        {type !== "NONE" && (
                          <div
                            className={cn(
                              "absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full backdrop-blur-md shadow-sm text-[8px] md:text-[10px] font-black uppercase tracking-widest border transition-all",
                              isActive
                                ? "bg-amber-500 border-amber-300 text-white"
                                : "bg-white/80 border-amber-900/10 text-slate-500",
                            )}
                          >
                            {type === "OPEN" ? "Murda" : "Tardi"}
                          </div>
                        )}

                        {/* Fractional Fill indicator for Active Beat */}
                        {isActive && (
                          <motion.div
                            className="absolute bottom-0 left-0 right-0 bg-saffron/20 mix-blend-multiply"
                            style={{ height: `${(currentBeat % 1) * 100}%` }}
                          />
                        )}

                        <AnimatePresence>
                          {feedback?.type === "PERFECT" && (
                            <motion.div
                              key={`feedback-perf-${feedback.id}`}
                              initial={{
                                opacity: 1,
                                scale: 1,
                                backgroundColor: "rgba(255, 255, 255, 0.9)",
                              }}
                              animate={{
                                opacity: 0,
                                scale: 1.2,
                                backgroundColor: "rgba(16, 185, 129, 0)",
                              }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                              className="absolute inset-0 z-50 mix-blend-overlay"
                            />
                          )}
                          {feedback?.type === "GOOD" && (
                            <motion.div
                              key={`feedback-good-${feedback.id}`}
                              initial={{ opacity: 0.5, scale: 1 }}
                              animate={{ opacity: 0, scale: 1.1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                              className="absolute inset-0 z-50 bg-saffron/40 mix-blend-overlay"
                            />
                          )}
                          {feedback?.type === "MISS" && (
                            <motion.div
                              key={`feedback-miss-${feedback.id}`}
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ duration: 0.3 }}
                              className="absolute inset-0 z-50 flex items-center justify-center bg-red-900/10 backdrop-blur-[2px]"
                            >
                              <X
                                className="w-10 h-10 md:w-16 md:h-16 text-red-500/80 drop-shadow-sm"
                                strokeWidth={3}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "text-[10px] md:text-xs font-black uppercase tracking-[0.3em] transition-colors mt-2",
                            isActive
                              ? "text-saffron drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                              : "text-slate-400",
                          )}
                        >
                          BEAT {beatIndex + 1}
                        </span>
                      </div>
                    </div>
                  );
                },
              )}
            </div>

            {/* Progress Bar (Bottom) */}
            <div className="absolute bottom-0 left-0 right-0 h-1 md:h-1.5 bg-amber-900/5 z-40">
              <motion.div
                className="h-full bg-gradient-to-r from-saffron via-amber-sacred to-orange-600 shadow-[0_0_20px_rgba(251,146,60,0.5)]"
                animate={{
                  width: `${(1 - beatsRemaining / totalBeats) * 100}%`,
                }}
                transition={{ ease: "linear" }}
              />
            </div>

            {/* Recent Strike Feedback Overlay */}
            <div className="absolute inset-x-0 bottom-40 flex flex-col items-center justify-center pointer-events-none z-50">
              <AnimatePresence mode="popLayout">
                {lastStrike && (
                  <motion.div
                    key={lastStrike.id}
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1.2, y: -20 }}
                    exit={{ opacity: 0, scale: 1.5, y: -40 }}
                    className={cn(
                      "text-4xl md:text-7xl font-black font-heading italic uppercase tracking-tighter drop-shadow-md",
                      lastStrike.timingVerdict === "PERFECT"
                        ? "text-emerald-500"
                        : lastStrike.timingVerdict === "NEAR"
                          ? "text-saffron"
                          : "text-slate-400",
                    )}
                  >
                    {lastStrike.timingVerdict === "PERFECT"
                      ? "SHUBHAN!"
                      : lastStrike.timingVerdict === "NEAR"
                        ? "GOOD!"
                        : "TRY!"}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {screen === "RESULT" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "relative w-full overflow-hidden shadow-2xl bg-stone-50 transition-all flex flex-col items-center justify-center pt-8 pb-32",
              isFullscreen
                ? "h-full w-full rounded-none border-0"
                : "max-w-[1600px] mx-auto aspect-[3/4] sm:aspect-[4/3] sm:aspect-[16/9] md:aspect-[21/8] min-h-[550px] sm:min-h-0 rounded-2xl md:rounded-[3rem] border-4 md:border-8 border-amber-900/10",
            )}
          >
            {/* Background */}
            <div className="absolute inset-0 z-0 pointer-events-none">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover opacity-40 mix-blend-multiply"
              >
                <source src="/pune-bg.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-stone-100/60" />
            </div>

            <div className="relative z-10 w-full h-full overflow-y-auto flex flex-col items-center justify-start p-4 md:p-8">
              <div className="absolute top-4 right-4 md:top-8 md:right-8 z-50">
                <button
                  onClick={toggleFullscreen}
                  className="glass-card bg-white/40 border-amber-900/10 p-4 hover:bg-white/60 transition-all group rounded-2xl shadow-xl"
                  title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize className="w-6 h-6 text-saffron group-hover:scale-110 transition-transform" />
                  ) : (
                    <Maximize className="w-6 h-6 text-saffron group-hover:scale-110 transition-transform" />
                  )}
                </button>
              </div>
              <SessionDashboard
                stats={sessionStats}
                accuracy={
                  sessionStats.correctType + sessionStats.incorrectType
                    ? (100 * sessionStats.correctType) /
                      (sessionStats.correctType + sessionStats.incorrectType)
                    : 0
                }
                combo={useAppStore.getState().bestEvaluationCombo}
                title="Rhythm Practice Complete"
                onRestart={startTraining}
                onHome={() => setScreen("SETUP")}
                isFullscreen={isFullscreen}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
