import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatMs = (ms: number) => `${ms.toFixed(0)}ms`;

export const getTimingColor = (verdict: string) => {
  switch (verdict) {
    case 'PERFECT': return 'text-amber-400';
    case 'NEAR': return 'text-orange-300';
    default: return 'text-gray-400';
  }
};
