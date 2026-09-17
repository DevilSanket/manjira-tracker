import React, { useMemo, useEffect, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { StrikeEvent } from '../../store/useAppStore';

interface WaveformOverlayProps {
    expectedType?: 'OPEN' | 'CLOSED' | 'NONE';
    lastStrike: StrikeEvent | null;
}

export const WaveformOverlay: React.FC<WaveformOverlayProps> = ({ expectedType, lastStrike }) => {
    const [key, setKey] = useState(0);

    // Whenever lastStrike changes, trigger a re-render/re-animation of actual trace
    useEffect(() => {
        if (lastStrike) {
            setKey(prev => prev + 1);
        }
    }, [lastStrike]);

    const chartData = useMemo(() => {
        let data = [];
        const expDecay = expectedType === 'OPEN' ? 2 : 12;
        const actDecay = lastStrike ? (lastStrike.label === 'OPEN' ? 2 : 12) : 0;
        const variance = lastStrike && lastStrike.timingVerdict !== 'PERFECT' ? 0.3 : 0.1;
        
        for (let i = 0; i <= 60; i++) {
            const xText = i / 60;
            
            let expectedVal = 0;
            if (expectedType && expectedType !== 'NONE') {
                expectedVal = Math.exp(-expDecay * xText);
            }
            
            let actualVal = 0;
            if (lastStrike) {
                // Add noise
                const noise = 1 + (Math.random() * 0.4 - 0.2) * variance;
                actualVal = Math.exp(-actDecay * xText) * noise;
            }
            
            data.push({
                time: xText,
                expected: expectedVal * 100,
                actual: actualVal * 100
            });
        }
        return data;
    }, [expectedType, lastStrike, key]); // add key so it updates data slightly when re-triggered

    const isMatch = lastStrike && expectedType === lastStrike.label;

    return (
        <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none transition-opacity duration-300" style={{ opacity: expectedType && expectedType !== 'NONE' ? 1 : 0.4 }}>
            <span className="text-[10px] font-black uppercase tracking-widest text-white/50 bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
                Strike Diagnostics
            </span>
            <div className="relative w-[280px] sm:w-[320px] h-[100px] sm:h-[120px] bg-black/60 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden shadow-2xl pt-4">
                
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={expectedType === 'OPEN' ? '#f97316' : '#3b82f6'} stopOpacity={0.6}/>
                                <stop offset="95%" stopColor={expectedType === 'OPEN' ? '#f97316' : '#3b82f6'} stopOpacity={0.0}/>
                            </linearGradient>
                            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={lastStrike?.label === 'OPEN' ? '#facc15' : '#10b981'} stopOpacity={0.8}/>
                                <stop offset="95%" stopColor={lastStrike?.label === 'OPEN' ? '#facc15' : '#10b981'} stopOpacity={0.1}/>
                            </linearGradient>
                        </defs>
                        
                        <Area 
                            type="monotone" 
                            dataKey="expected" 
                            stroke={expectedType === 'OPEN' ? '#f97316' : '#3b82f6'} 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorExpected)" 
                            isAnimationActive={false}
                        />
                        
                        {lastStrike && (
                            <Area 
                                key={`actual-${key}`}
                                type="monotone" 
                                dataKey="actual" 
                                stroke={lastStrike.label === 'OPEN' ? '#facc15' : '#10b981'} 
                                strokeWidth={2}
                                fillOpacity={1} 
                                fill="url(#colorActual)" 
                                isAnimationActive={true}
                                animationDuration={400}
                            />
                        )}
                    </AreaChart>
                </ResponsiveContainer>

                {/* Tags in corners indicating meaning */}
                <div className="absolute top-2 left-2 flex gap-2">
                    <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${expectedType === 'OPEN' ? 'bg-orange-500' : 'bg-blue-500'} opacity-60`} />
                        <span className="text-[8px] font-mono text-white/60">Expected: {expectedType}</span>
                    </div>
                </div>
                {lastStrike && (
                    <motion.div 
                        key={`tag-${key}`}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute bottom-2 right-2 flex items-center gap-1"
                    >
                        <div className={`w-2 h-2 rounded-full ${isMatch ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: lastStrike?.label === 'OPEN' ? '#facc15' : '#10b981'}} />
                        <span className="text-[8px] font-mono text-white/90">
                            Actual: {lastStrike.label}
                        </span>
                    </motion.div>
                )}
            </div>
        </div>
    );
};
