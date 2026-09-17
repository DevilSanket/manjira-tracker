import React, { useState } from 'react';
import { useAudioLifecycle } from './hooks/useAudioLifecycle';
import { useAppStore } from './store/useAppStore';
import { WaveformVisualizer } from './components/dashboard/WaveformVisualizer';
import { StrikeMonitor } from './components/dashboard/StrikeMonitor';
import { CalibrationWizard } from './components/calibration/CalibrationWizard';
import { BasicLessons } from './components/game/BasicLessons';
import { RhythmTraining } from './components/game/RhythmTraining';
import { LayoutDashboard, Target, Settings, Music2, BellRing as Ring, User, Activity, Volume2, VolumeX } from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { Logo } from './components/Logo';
import { LiveStudio } from './components/dashboard/LiveStudio';
import { ambienceService } from './services/ambienceService';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'lessons' | 'calibrate'>('dashboard');
  const [bgVolume, setBgVolume] = useState(0.15);
  const [showVolume, setShowVolume] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const isDesktop = typeof window !== 'undefined' && Boolean((window as any).electron?.isDesktop);

  const { isRecording, setRecording, isMetronomeActive, bpm, calibration, theme, updateTheme } = useAppStore();
  useAudioLifecycle();

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);


  // Theme auto-decay
  React.useEffect(() => {
    if (theme.intensity > 0) {
      const timer = setInterval(() => {
        updateTheme(Math.max(0, theme.intensity - 0.05));
      }, 50);
      return () => clearInterval(timer);
    }
  }, [theme.intensity, updateTheme]);

  // Sync calibration samples to audioManager for ML classification
  React.useEffect(() => {
    if (calibration.openSamples.length > 0 && calibration.closedSamples.length > 0) {
      import('./features/audio/AudioManager').then(({ audioManager }) => {
        audioManager.setCalibrationSamples(calibration.openSamples, calibration.closedSamples);
        audioManager.setLoudnessThresholds(calibration.minStrikePeak, 1.0);
      });
    }
  }, [calibration]);
  
  // Global gesture listener for Tone.js
  React.useEffect(() => {
    const handleGesture = async () => {
      const { start } = await import('tone');
      await start();
      ambienceService.start();
      console.log("Global gesture: Tone.js started/resumed and Ambience active");
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
    window.addEventListener('click', handleGesture);
    window.addEventListener('keydown', handleGesture);
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, []);
  
  // Pre-warm audio synth for dictionary buttons
  React.useEffect(() => {
    import('./services/audioSynth').then(({ manjiraSynth }) => {
      manjiraSynth.prewarm();
    });
  }, []);

  return (
    <div 
      className="min-h-screen flex flex-col font-sans select-none relative overflow-hidden text-slate-900 transition-colors duration-500"
      style={{ 
        backgroundColor: theme.intensity > 0.5 ? `${theme.primary}05` : '#ffffff'
      }}
    >
      {/* Background Motifs */}
      <div className="bg-blobs">
        <motion.div 
          animate={{ 
            scale: 1 + theme.intensity,
            opacity: 0.08 + theme.intensity * 0.1,
            backgroundColor: theme.primary
          }}
          className="blob-1" 
        />
        <motion.div 
          animate={{ 
            scale: 1 + theme.intensity * 0.5,
            opacity: 0.06 + theme.intensity * 0.05,
            backgroundColor: theme.secondary
          }}
          className="blob-2" 
        />
      </div>

      {/* Sacred Top Bar */}
      <header className="h-16 md:h-20 px-4 md:px-8 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-2 md:gap-3">
          <Logo size="md" />
          <div>
            <h1 className="text-lg md:text-2xl font-black font-heading uppercase tracking-tighter leading-none text-slate-800 flex items-center gap-3">
              MANJIRA <span className="text-saffron">TRACKER</span>
              {isMetronomeActive && (
                <div className="relative flex items-center justify-center">
                  <motion.div 
                    animate={{ 
                      scale: [1, 2],
                      opacity: [0.5, 0]
                    }}
                    transition={{ 
                      duration: 60/bpm, 
                      repeat: Infinity, 
                      ease: "easeOut" 
                    }}
                    className="absolute w-4 h-4 rounded-full bg-saffron"
                  />
                  <div className="w-2 h-2 rounded-full bg-saffron shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                </div>
              )}
            </h1>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-1 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200">
          <TabButton 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            icon={LayoutDashboard} 
            label="Live Studio" 
          />
          <TabButton 
            active={activeTab === 'lessons'} 
            onClick={() => setActiveTab('lessons')} 
            icon={Music2} 
            label="Basic Lessons" 
          />
          <TabButton 
            active={activeTab === 'calibrate'} 
            onClick={() => setActiveTab('calibrate')} 
            icon={Activity} 
            label="Rhythm Practice" 
          />
        </nav>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="relative">
            <button 
              onClick={() => setShowVolume(!showVolume)}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
              title="Background Music Volume"
            >
              {bgVolume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <AnimatePresence>
              {showVolume && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  className="absolute right-0 top-full mt-2 bg-white/90 backdrop-blur-xl border border-slate-200 p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-3 w-10 min-w-[120px] origin-top-right z-50 text-slate-700"
                >
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ambience</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value={bgVolume}
                    className="w-full accent-saffron"
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setBgVolume(v);
                      ambienceService.setVolume(v);
                      if (v > 0) ambienceService.start();
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-2xl shadow-xs">
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center text-saffron">
              <User className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold leading-tight text-slate-800">
                {isDesktop ? "Desktop Riyaz" : "Web Studio"}
              </p>
              <div className="flex items-center gap-1">
                <div className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-emerald-500" : "bg-amber-500")} />
                <p className={cn(
                  "text-[8px] uppercase tracking-widest font-black",
                  isOnline ? "text-emerald-600" : "text-amber-600"
                )}>
                  {isDesktop ? "Offline App" : (isOnline ? "Online Mode" : "Offline Cache")}
                </p>
              </div>
            </div>
          </div>



          <button 
            onClick={() => {
              setRecording(!isRecording);
              ambienceService.start();
            }}
            className={cn(
              "px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl",
              isRecording 
                ? "bg-red-50 text-red-600 border border-red-200 shadow-red-100" 
                : "bg-gradient-to-r from-saffron to-amber-600 text-white shadow-orange-200 hover:scale-105 active:scale-95"
            )}
          >
            <div className={cn("w-1.5 h-1.5 md:w-2 md:h-2 rounded-full", isRecording ? "bg-red-500 animate-pulse" : "bg-white")} />
            <span className="hidden sm:inline">{isRecording ? "Listening..." : "START PLAYING"}</span>
            <span className="sm:hidden">{isRecording ? "..." : "START"}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-10 max-w-7xl mx-auto w-full relative z-10 pb-24 lg:pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="h-full"
          >
            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-4xl font-black font-heading italic uppercase tracking-tighter text-slate-800">Live Studio</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em] mt-2">See your Manjira strikes come to life!</p>
                    </div>
                </div>
                <LiveStudio />
              </div>
            )}

            {activeTab === 'lessons' && (
              <div className="space-y-8 text-center pt-8">
                <div className="mb-12">
                     <h2 className="text-5xl font-black font-heading italic uppercase tracking-tighter text-saffron">Basic Lessons</h2>
                     <p className="text-slate-400 text-sm font-bold uppercase tracking-[0.4em] mt-3">The Journey of Rhythm Begins Here</p>
                </div>
                <BasicLessons />
              </div>
            )}

            {activeTab === 'calibrate' && (
              <div className="w-full">
                <RhythmTraining />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer / Status */}
      <footer className="h-12 px-4 md:px-8 flex items-center justify-between text-[10px] text-slate-400 font-mono uppercase tracking-[0.4em] bg-white border-t border-slate-100 relative z-20 overflow-hidden">
        <div className="flex items-center gap-3 md:gap-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
            <span className="text-amber-sacred font-bold">Academy Session</span>
            <span className="h-3 w-px bg-slate-200 shrink-0"></span>
            <span>Latency: 4.2ms</span>
            <span className="h-3 w-px bg-slate-200 shrink-0"></span>
            <span className="text-saffron/60">Audio Engine: Ultra Low</span>
        </div>
        <div className="hidden sm:flex gap-4 shrink-0">
            <span className="text-saffron font-bold">MANJIRA ENGINE 2.4</span>
            <span className="opacity-30">© 2024 DEVOTIONAL ARTS</span>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-3xl p-1.5 flex items-center gap-1 z-[60] w-[calc(100%-2rem)] max-w-sm">
        <TabButton 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')} 
          icon={LayoutDashboard} 
          label="Studio" 
          isMobile
        />
        <TabButton 
          active={activeTab === 'lessons'} 
          onClick={() => setActiveTab('lessons')} 
          icon={Music2} 
          label="Lessons" 
          isMobile
        />
        <TabButton 
          active={activeTab === 'calibrate'} 
          onClick={() => setActiveTab('calibrate')} 
          icon={Activity} 
          label="Rhythm" 
          isMobile
        />
      </nav>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, isMobile }: { active: boolean, onClick: () => void, icon: any, label: string, isMobile?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] md:text-xs uppercase tracking-widest transition-all",
        isMobile ? "flex-1 py-3" : "px-6 py-3",
        active 
          ? "bg-white text-saffron shadow-md border border-slate-200" 
          : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
      )}
    >
      <Icon className={cn(isMobile ? "w-3.5 h-3.5" : "w-4 h-4")} />
      <span>{label}</span>
    </button>
  );
}

