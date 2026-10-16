import React from 'react';
import { motion } from 'motion/react';
import { ManjiraVisual } from '../ManjiraVisual';
import { Music, Zap, Waves, Volume2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { manjiraSynth } from '../../services/audioSynth';

export const StrikeDictionary: React.FC<{ variant?: 'sidebar' | 'full' }> = ({ variant = 'full' }) => {
    return (
        <div className={cn(
            "grid gap-8",
            variant === 'full' ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
        )}>
            {/* Open Strike Card */}
            <motion.div 
                whileHover={{ y: -5 }}
                className="glass-card p-8 bg-white border-saffron/30 overflow-hidden relative group shadow-2xl backdrop-blur-3xl"
            >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Music className="w-24 h-24 text-saffron" />
                </div>
                
                <div className="flex flex-col items-center text-center">
                    <div className="mb-8 flex justify-between items-center w-full">
                        <div className="flex flex-col items-start text-left">
                            <h3 className="text-3xl font-black font-heading italic text-black tracking-tighter">
                                MURDA <span className="text-saffron">STRIKE</span>
                            </h3>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">"मुर्दा" (Resonant Bell Ring)</p>
                        </div>
                    </div>
                    
                    <div className="w-full aspect-square mb-6 rounded-2xl overflow-hidden border border-saffron/10 bg-black/5">
                        <img src="/open_strike.gif" className="w-full h-full object-contain" alt="Murda Strike Demo" />
                    </div>

                    <motion.button
                        onClick={() => manjiraSynth.play('OPEN')}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full mb-6 py-4 bg-saffron text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-saffron/20 border border-white/20"
                    >
                        <Volume2 className="w-5 h-5" /> Hear Murda Sound
                    </motion.button>
 
                    <div className="space-y-4 text-left w-full bg-white/50 p-6 rounded-2xl border border-saffron/10 backdrop-blur-md shadow-inner">
                        <div className="flex gap-4 items-start">
                            <Zap className="w-5 h-5 text-saffron shrink-0 mt-1" />
                            <div>
                                <p className="text-xs font-black text-black mb-1 uppercase tracking-wider">How to play</p>
                                <p className="text-sm text-slate-700 font-medium">Strike the edges gently and <span className="text-saffron font-bold">let them vibrate freely</span>. Do not press them together after the hit.</p>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <Waves className="w-5 h-5 text-saffron shrink-0 mt-1" />
                            <div>
                                <p className="text-xs font-black text-black mb-1 uppercase tracking-wider">The Sound</p>
                                <p className="text-sm text-slate-700 font-medium">Bright, ringing, and long-lasting resonance (Murda). Like a temple bell echoing across the temple hall.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Tardi (Closed Strike) Card */}
            <motion.div 
                whileHover={{ y: -5 }}
                className="glass-card p-8 bg-white border-emerald-500/20 overflow-hidden relative group shadow-2xl backdrop-blur-3xl"
            >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-emerald-600">
                    <Music className="w-24 h-24" />
                </div>

                <div className="flex flex-col items-center text-center">
                    <div className="mb-8 flex justify-between items-center w-full">
                        <div className="flex flex-col items-start text-left">
                            <h3 className="text-3xl font-black font-heading italic text-black tracking-tighter">
                                TARDI <span className="text-emerald-600">STRIKE</span>
                            </h3>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">"तर्डी" (Damped Rhythmic Snap)</p>
                        </div>
                    </div>

                    <div className="w-full aspect-square mb-6 rounded-2xl overflow-hidden border border-emerald-500/10 bg-black/5">
                        <img src="/close_strike.gif" className="w-full h-full object-contain" alt="Tardi Strike Demo" />
                    </div>

                    <motion.button
                        onClick={() => manjiraSynth.play('CLOSED')}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full mb-6 py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 border border-white/20"
                    >
                        <Volume2 className="w-5 h-5" /> Hear Tardi Sound
                    </motion.button>

                    <div className="space-y-4 text-left w-full bg-white/50 p-6 rounded-2xl border border-emerald-500/10 backdrop-blur-md shadow-inner">
                        <div className="flex gap-4 items-start">
                            <Zap className="w-5 h-5 text-emerald-600 shrink-0 mt-1" />
                            <div>
                                <p className="text-xs font-black text-black mb-1 uppercase tracking-wider">How to play (Correct Grip)</p>
                                <p className="text-sm text-slate-700 font-medium">Hold the metal rims firmly with fingers wrapped around to mute vibrations. Strike flat and <span className="text-emerald-600 font-bold">maintain damping contact</span> for a crisp, muted clack.</p>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <Waves className="w-5 h-5 text-emerald-600 shrink-0 mt-1" />
                            <div>
                                <p className="text-xs font-black text-black mb-1 uppercase tracking-wider">The Sound</p>
                                <p className="text-sm text-slate-700 font-medium">Short, dry, and rhythmic "clack" (Tardi). Provides the foundational heartbeat for Warkari bhajans and kirtans.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
