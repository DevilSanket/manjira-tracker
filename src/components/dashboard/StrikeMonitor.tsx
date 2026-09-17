import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../../store/useAppStore';
import { Music, CheckCircle2, AlertCircle, Circle, CircleDot } from 'lucide-react';
import { formatMs, cn } from '../../lib/utils';
import { ManjiraVisual } from '../ManjiraVisual';

export const StrikeMonitor: React.FC = () => {
    const { lastStrike, accuracy, amplitudeHistory } = useAppStore();

    const calculateConsistency = () => {
        if (amplitudeHistory.length < 2) return 100;
        const mean = amplitudeHistory.reduce((a, b) => a + b, 0) / amplitudeHistory.length;
        const variance = amplitudeHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amplitudeHistory.length;
        const stdDev = Math.sqrt(variance);
        // Consistency is 1 minus coefficient of variation, capped between 0 and 100
        const consistency = Math.max(0, Math.min(100, (1 - (stdDev / (mean || 1))) * 100));
        return consistency;
    };

    const consistency = calculateConsistency();

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Main Verdict Card */}
            <div className="col-span-1 md:col-span-2 glass-card p-6 md:p-10 flex flex-col md:flex-row items-center justify-between overflow-hidden relative border-slate-100 bg-white gap-6 md:gap-0">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
                    <ManjiraVisual 
                        type={lastStrike?.label === 'CLOSED' ? 'CLOSED' : 'OPEN'} 
                        isStriking={!!lastStrike && Date.now() - lastStrike.timestamp < 300}
                        className="scale-150"
                    />
                </div>

                <div className="z-10 bg-white/40 backdrop-blur-sm p-4 rounded-2xl w-full md:w-auto text-center md:text-left">
                    <h3 className="text-[10px] font-black text-amber-sacred mb-4 md:mb-6 uppercase tracking-[0.4em]">Spirit Strike</h3>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={lastStrike?.id || 'none'}
                            initial={{ scale: 0.8, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 1.2, opacity: 0, y: -20 }}
                            className="flex flex-col gap-2 items-center md:items-start"
                        >
                            <div className="flex items-center gap-4 md:gap-6 justify-center md:justify-start">
                                {lastStrike?.label === 'OPEN' && <Circle className="w-12 h-12 md:w-16 md:h-16 text-saffron stroke-[3]" />}
                                {lastStrike?.label === 'CLOSED' && <CircleDot className="w-12 h-12 md:w-16 md:h-16 text-blue-500 stroke-[3]" />}
                                <span className={cn(
                                    "text-6xl md:text-8xl font-black font-heading italic tracking-tighter",
                                    lastStrike?.label === 'OPEN' 
                                      ? "text-saffron drop-shadow-[0_4px_12px_rgba(251,146,60,0.3)]" 
                                      : lastStrike?.label === 'CLOSED'
                                      ? "text-blue-500 drop-shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
                                      : "text-slate-300"
                                )}>
                                    {lastStrike?.label || 'HEAR'}
                                </span>
                            </div>
                            
                            {lastStrike && (
                                <div className="flex items-center gap-3">
                                    <span className="text-lg md:text-xl font-bold font-heading text-slate-400 uppercase tracking-widest italic">
                                        {(lastStrike.confidence * 100).toFixed(0)}% Clear
                                    </span>
                                    <div className="h-2 w-24 md:w-32 bg-slate-100 rounded-full overflow-hidden">
                                        <motion.div 
                                            className={cn(
                                                "h-full rounded-full",
                                                lastStrike.confidence > 0.8 ? "bg-emerald-400" : lastStrike.confidence > 0.5 ? "bg-amber-400" : "bg-red-400"
                                            )}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${lastStrike.confidence * 100}%` }}
                                            transition={{ type: "spring", bounce: 0.4 }}
                                        />
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="text-center md:text-right z-10 space-y-4 md:space-y-6 w-full md:w-auto">
                    <div>
                        <div className="text-[10px] text-slate-300 uppercase tracking-widest font-bold mb-2">Devotion Timing</div>
                        <motion.div 
                            key={lastStrike?.id || 'delta'}
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className={cn(
                                "text-4xl font-mono font-black",
                                !lastStrike ? 'text-slate-300' :
                                lastStrike.timingVerdict === 'PERFECT' ? 'text-emerald-500' : 
                                lastStrike.timingVerdict === 'NEAR' ? 'text-amber-500' : 'text-red-500'
                            )}
                        >
                            {lastStrike ? formatMs(lastStrike.timingDeltaMs) : '+0ms'}
                        </motion.div>
                    </div>
                    
                    <motion.div 
                        key={lastStrike?.id || 'timing'}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={cn(
                            "inline-flex items-center px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest border shadow-sm transition-colors",
                            !lastStrike ? 'bg-slate-50 text-slate-400 border-slate-200' :
                            lastStrike.timingVerdict === 'PERFECT' 
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-emerald-100' 
                              : lastStrike.timingVerdict === 'NEAR'
                              ? 'bg-amber-50 text-amber-600 border-amber-200 shadow-amber-100'
                              : 'bg-red-50 text-red-600 border-red-200 shadow-red-100'
                        )}
                    >
                        {lastStrike?.timingVerdict || 'READY'}
                        {lastStrike?.timingVerdict === 'PERFECT' && <CheckCircle2 className="w-4 h-4 ml-2" />}
                        {(lastStrike?.timingVerdict === 'NEAR' || lastStrike?.timingVerdict === 'MISS') && <AlertCircle className="w-4 h-4 ml-2" />}
                    </motion.div>

                    {lastStrike && (
                        <div className="mt-4">
                            <div className="text-[8px] text-slate-300 uppercase font-black mb-1">Energy Pulse</div>
                            <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden ml-auto">
                                <motion.div 
                                    className="h-full bg-saffron"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, lastStrike.peakRms * 500)}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Background flourish */}
                {lastStrike?.label === 'OPEN' && (
                    <motion.div 
                        key={`bg-open-${lastStrike.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-gradient-to-r from-saffron/10 to-transparent transition-colors"
                    />
                )}
                {lastStrike?.label === 'CLOSED' && (
                    <motion.div 
                        key={`bg-closed-${lastStrike.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent transition-colors"
                    />
                )}
            </div>

            {/* Stats Dashboard */}
            <div className="glass-card p-6 md:p-10 flex flex-col justify-between bg-gradient-to-br from-white to-slate-50/50 border-slate-100">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-bold mb-2">Consistency</div>
                        <div className="text-7xl font-black font-heading text-slate-800 tracking-tighter italic">{consistency.toFixed(0)}<span className="text-2xl not-italic ml-1">%</span></div>
                    </div>
                    <div className="p-4 rounded-[1.5rem] bg-saffron/10 text-saffron border border-saffron/20 shadow-inner">
                        <Music className="w-8 h-8" />
                    </div>
                </div>
                
                <div className="mt-10">
                    <div className="flex justify-between text-[11px] font-black uppercase tracking-widest mb-3">
                        <span className="text-slate-400">Total Accuracy</span>
                        <span className="text-saffron">{accuracy.toFixed(1)}%</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
                        <motion.div 
                            className="h-full rounded-full bg-gradient-to-r from-saffron to-amber-sacred shadow-sm"
                            initial={{ width: 0 }}
                            animate={{ width: `${accuracy}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
