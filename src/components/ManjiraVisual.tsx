import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface ManjiraVisualProps {
    type: 'OPEN' | 'CLOSED';
    isStriking: boolean;
    className?: string;
}

export const ManjiraVisual: React.FC<ManjiraVisualProps> = ({ type, isStriking, className }) => {
    return (
        <div className={cn("relative w-48 h-48 flex items-center justify-center", className)}>
            {/* Background Glow */}
            <motion.div
                animate={{
                    scale: isStriking ? [1, 1.5, 1] : 1,
                    opacity: isStriking ? [0.2, 0.5, 0.2] : 0.1
                }}
                className={cn(
                    "absolute inset-0 rounded-full blur-3xl",
                    type === 'OPEN' ? "bg-saffron" : "bg-amber-sacred"
                )}
            />

            {/* Connecting Cord */}
            <motion.div
                animate={{
                    scaleX: type === 'OPEN' ? (isStriking ? [1, 1.2, 1] : 1.1) : (isStriking ? [1, 0.8, 1] : 0.9),
                    opacity: [0.4, 0.6, 0.4]
                }}
                className="absolute w-full h-1 bg-amber-900/40 rounded-full"
            />

            {/* Left Cymbal */}
            <motion.div
                animate={isStriking ? {
                    x: type === 'OPEN' ? [-20, -60, -20] : [-20, 0, -20],
                    rotate: type === 'OPEN' ? [0, -15, 0] : [0, 5, 0]
                } : { x: -20 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
                className="absolute left-4 w-16 h-16"
            >
                <div className="w-full h-full bg-gradient-to-tr from-amber-700 via-saffron to-amber-200 rounded-full shadow-lg border border-white/20" />
                <div className="absolute inset-[35%] bg-amber-900/20 rounded-full border border-white/10" />
            </motion.div>

            {/* Right Cymbal */}
            <motion.div
                animate={isStriking ? {
                    x: type === 'OPEN' ? [20, 60, 20] : [20, 0, 20],
                    rotate: type === 'OPEN' ? [0, 15, 0] : [0, -5, 0]
                } : { x: 20 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
                className="absolute right-4 w-16 h-16"
            >
                <div className="w-full h-full bg-gradient-to-tl from-amber-700 via-saffron to-amber-200 rounded-full shadow-lg border border-white/20" />
                <div className="absolute inset-[35%] bg-amber-900/20 rounded-full border border-white/10" />
            </motion.div>

            {/* Shockwave for Open Strike */}
            {type === 'OPEN' && isStriking && (
                <motion.div
                    initial={{ scale: 0.5, opacity: 1 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-0 border-4 border-saffron rounded-full"
                />
            )}
        </div>
    );
};
