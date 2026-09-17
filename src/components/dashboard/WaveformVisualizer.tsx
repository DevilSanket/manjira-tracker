import React, { useEffect, useRef, useState } from 'react';
import { audioManager } from '../../features/audio/AudioManager';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../lib/utils';

export const WaveformVisualizer: React.FC<{ dark?: boolean }> = ({ dark }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const { amplitudeHistory } = useAppStore();
    const [targetAmplitude, setTargetAmplitude] = useState(0.4); // Normalized baseline
    
    // Dynamically adjust the "Sacred Band" based on recent successful strikes
    useEffect(() => {
        if (amplitudeHistory.length > 0) {
            const mean = amplitudeHistory.reduce((a, b) => a + b, 0) / amplitudeHistory.length;
            setTargetAmplitude(Math.max(0.2, Math.min(0.8, mean * 1.5))); 
        }
    }, [amplitudeHistory]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        if(!ctx) return;

        const render = () => {
            const analyser = audioManager.getAnalyser();
            if(!analyser) {
                animationRef.current = requestAnimationFrame(render);
                return;
            }

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteTimeDomainData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const midY = canvas.height / 2;
            const targetYOffset = targetAmplitude * (canvas.height / 2);
            const tolerance = 40; 

            // 1. Draw "Consistency Zones" (Subtle in Dark mode)
            if (dark) {
                // Sacred Zone Glow
                const gradient = ctx.createLinearGradient(0, midY - targetYOffset - tolerance, 0, midY - targetYOffset + tolerance);
                gradient.addColorStop(0, 'rgba(16, 185, 129, 0)');
                gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.05)');
                gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(0, midY - targetYOffset - tolerance, canvas.width, tolerance * 2);
                ctx.fillRect(0, midY + targetYOffset - tolerance, canvas.width, tolerance * 2);
            } else {
                ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
                ctx.fillRect(0, midY - targetYOffset - tolerance, canvas.width, tolerance * 2);
                ctx.fillRect(0, midY + targetYOffset - tolerance, canvas.width, tolerance * 2);
            }

            // Boundary Lines
            ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(34, 197, 94, 0.2)';
            ctx.setLineDash([5, 15]);
            ctx.beginPath();
            ctx.moveTo(0, midY - targetYOffset); ctx.lineTo(canvas.width, midY - targetYOffset);
            ctx.moveTo(0, midY + targetYOffset); ctx.lineTo(canvas.width, midY + targetYOffset);
            ctx.stroke();
            ctx.setLineDash([]);

            // Label for the band (only in light mode)
            if (!dark) {
                ctx.font = 'bold 10px font-heading';
                ctx.fillStyle = '#059669';
                ctx.fillText('CONSISTENCY BAND', 40, midY - targetYOffset - 15);
            }

            // 2. Draw Real-time Waveform (Oscilloscope Style)
            ctx.lineWidth = dark ? 1.5 : 3;
            
            let maxPeak = 0;
            for(let i=0; i<bufferLength; i++) {
                const v = Math.abs(dataArray[i]/128.0 - 1);
                if(v > maxPeak) maxPeak = v;
            }
            
            const currentPeakY = maxPeak * (canvas.height/2);
            const isConsistent = Math.abs(currentPeakY - targetYOffset) < tolerance;
            const hasSignal = maxPeak > 0.01;
            
            if (hasSignal) {
                ctx.strokeStyle = isConsistent ? '#10b981' : '#f43f5e';
                ctx.shadowBlur = dark ? 10 : 20;
            } else {
                ctx.strokeStyle = dark ? 'rgba(255,255,255,0.1)' : '#cbd5e1';
                ctx.shadowBlur = 0;
            }
            
            ctx.shadowColor = ctx.strokeStyle as string;

            ctx.beginPath();
            const sliceWidth = canvas.width / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * canvas.height) / 2;

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);

                x += sliceWidth;
            }

            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();

            // Additional accent glow for peaks
            if (hasSignal) {
                ctx.globalAlpha = 0.2;
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }

            animationRef.current = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animationRef.current);
    }, [targetAmplitude, dark]);

    return (
        <div className={cn(
            "relative w-full h-full overflow-hidden",
            dark ? "bg-transparent" : "glass-card border-slate-100 bg-white p-8 h-64"
        )}>
            {!dark && (
                <div className="absolute top-8 left-10 flex items-center gap-2 z-10">
                    <span className="text-[10px] font-black text-amber-sacred uppercase tracking-[0.4em] opacity-80">
                        Waveform Envelope
                    </span>
                    <span className="w-2 h-2 rounded-full bg-saffron animate-ping"></span>
                </div>
            )}
            
            <canvas 
                ref={canvasRef} 
                className="w-full h-full relative z-0" 
                width={1000} 
                height={300}
            />

            {!dark && (
                <>
                    <div className="absolute bottom-8 left-10 flex gap-4 text-[9px] font-black uppercase tracking-widest items-center">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-slate-400">Consistent</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-slate-400">Divergent</span>
                        </div>
                    </div>

                    <div className="absolute bottom-8 right-10 flex gap-8 text-[9px] font-mono font-black text-slate-300 uppercase tracking-widest">
                        <span>Target: {(targetAmplitude * 100).toFixed(0)}%</span>
                        <span>Stability Monitor</span>
                    </div>
                </>
            )}
        </div>
    );
};
