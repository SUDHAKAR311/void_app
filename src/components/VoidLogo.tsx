/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface VoidLogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}

export const VoidLogo: React.FC<VoidLogoProps> = ({ 
  className = '', 
  size = 36,
  showWordmark = false
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div 
        className="relative flex items-center justify-center shrink-0 transition-transform hover:scale-105 duration-300"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_0_12px_rgba(20,184,166,0.35)]"
        >
          <defs>
            {/* Primary gradient: cyber teal to electric cyan */}
            <linearGradient id="voidGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="50%" stopColor="#0d9488" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>

            {/* Counter-orbital gradient */}
            <linearGradient id="voidGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#0f766e" />
            </linearGradient>

            {/* Singularity core glow */}
            <radialGradient id="voidCoreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#5eead4" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#0d9488" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#042f2e" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Outer Dimensional Event Horizon - Left Ring */}
          <path
            d="M 50 14 C 28 14 12 30 12 50 C 12 70 28 86 50 86 C 58 86 65 83 71 78 C 65 74 58 72 50 72 C 38 72 26 62 26 50 C 26 38 38 28 50 28 C 58 28 65 26 71 22 C 65 17 58 14 50 14 Z"
            fill="url(#voidGradient1)"
          />

          {/* Symmetrical Quantum Return - Right Ring with Phase Shift */}
          <path
            d="M 50 86 C 72 86 88 70 88 50 C 88 30 72 14 50 14 C 42 14 35 17 29 22 C 35 26 42 28 50 28 C 62 28 74 38 74 50 C 74 62 62 72 50 72 C 42 72 35 74 29 78 C 35 83 42 86 50 86 Z"
            fill="url(#voidGradient2)"
            opacity="0.85"
          />

          {/* Central Singularity Aperture (The Void) */}
          <circle
            cx="50"
            cy="50"
            r="16"
            className="fill-neutral-950 dark:fill-[#08080a]"
            stroke="url(#voidGradient1)"
            strokeWidth="2.5"
          />

          {/* Pulsing Quantum Origin Point */}
          <circle
            cx="50"
            cy="50"
            r="6"
            fill="url(#voidCoreGlow)"
          />
          <circle
            cx="50"
            cy="50"
            r="3"
            fill="#5eead4"
          />
        </svg>
      </div>

      {showWordmark && (
        <div className="flex flex-col">
          <span className="font-mono text-lg font-bold tracking-wider text-neutral-900 dark:text-white leading-none">
            void<span className="text-teal-500">.</span>
          </span>
          <span className="text-[10px] tracking-widest uppercase font-mono text-neutral-400 dark:text-neutral-500">
            transfer
          </span>
        </div>
      )}
    </div>
  );
};
