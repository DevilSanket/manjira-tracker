import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface LogoProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className, size = 'md' }) => {
    const dimensions = {
        sm: 'w-8 h-8',
        md: 'w-12 h-12',
        lg: 'w-20 h-20'
    };

    return (
        <div className={cn("relative flex items-center justify-center", dimensions[size], className)}>
            {/* Connecting Thread */}
            <motion.div 
                animate={{ 
                    scaleX: [1, 1.1, 1],
                    opacity: [0.3, 0.6, 0.3]
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute w-full h-[2px] bg-amber-sacred/40 rounded-full"
            />
            
            {/* Manjira Cymbals */}
            <div className="flex justify-between w-full relative z-10 px-1">
                <motion.div
                    animate={{ rotate: [-5, 5, -5] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="w-[45%] aspect-square bg-gradient-to-tr from-saffron to-amber-sacred rounded-full shadow-lg shadow-orange-200 flex items-center justify-center border-2 border-white/20"
                >
                    <div className="w-[30%] h-[30%] bg-white/30 rounded-full border border-white/10" />
                </motion.div>
                
                <motion.div
                    animate={{ rotate: [5, -5, 5] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="w-[45%] aspect-square bg-gradient-to-tr from-amber-sacred to-saffron rounded-full shadow-lg shadow-orange-200 flex items-center justify-center border-2 border-white/20"
                >
                    <div className="w-[30%] h-[30%] bg-white/30 rounded-full border border-white/10" />
                </motion.div>
            </div>
            
            {/* Inner Glow */}
            <div className="absolute inset-0 bg-saffron/20 blur-xl rounded-full -z-10 animate-pulse" />
        </div>
    );
};
