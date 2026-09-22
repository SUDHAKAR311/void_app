/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { VoidLogo } from './VoidLogo';
import { ArrowUp, ArrowDown, ShieldCheck, Zap, HardDrive, Trash2, Gauge } from 'lucide-react';
import { motion } from 'motion/react';

interface ChoiceViewProps {
  onSelectSend: () => void;
  onSelectReceive: () => void;
  onOpenFeatures: () => void;
  onOpenSpeedGuide?: () => void;
}

export const ChoiceView: React.FC<ChoiceViewProps> = ({
  onSelectSend,
  onSelectReceive,
  onOpenFeatures,
  onOpenSpeedGuide,
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto flex flex-col items-center text-center"
    >
      {/* Brand Identity & Single-Line Clear Headline */}
      <div className="mb-8 sm:mb-12 flex flex-col items-center">
        <div className="mb-4">
          <VoidLogo size={64} />
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
          <span>Direct Device-to-Device Transfers</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-neutral-900 dark:text-white font-mono lowercase">
          void<span className="text-teal-500 dark:text-teal-400">.</span>
        </h1>

        <p className="mt-3 text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto font-sans leading-relaxed">
          Send files and text directly between any two devices. Fast, completely encrypted, and zero server storage.
        </p>
      </div>

      {/* Primary Action Cards: PUSH TO VOID & PULL FROM VOID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full max-w-2xl">
        {/* Send: Push to Void */}
        <button
          id="hero-send-btn"
          onClick={onSelectSend}
          className="group relative p-8 sm:p-9 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-teal-500/80 dark:hover:border-teal-500/80 shadow-md hover:shadow-xl hover:shadow-teal-500/10 hover:scale-[1.02] transition-all duration-300 text-left flex flex-col justify-between overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-bl-full pointer-events-none group-hover:bg-teal-500/10 transition-colors" />

          <div className="p-4 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 w-fit mb-6 group-hover:scale-110 transition-transform">
            <ArrowUp className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-neutral-900 dark:text-white uppercase mb-2">
              Push to Void
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed font-sans">
              Send files, videos, or clipboard text directly to another device using a temporary 6-digit code.
            </p>
          </div>

          <div className="mt-6 flex items-center gap-1.5 text-xs font-mono font-semibold text-teal-600 dark:text-teal-400">
            <span>Push to Void</span>
            <span className="transition-transform group-hover:translate-x-1 font-bold">→</span>
          </div>
        </button>

        {/* Receive: Pull from Void */}
        <button
          id="hero-receive-btn"
          onClick={onSelectReceive}
          className="group relative p-8 sm:p-9 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-teal-500/80 dark:hover:border-teal-500/80 shadow-md hover:shadow-xl hover:shadow-teal-500/10 hover:scale-[1.02] transition-all duration-300 text-left flex flex-col justify-between overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />

          <div className="p-4 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 w-fit mb-6 group-hover:scale-110 transition-transform">
            <ArrowDown className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-neutral-900 dark:text-white uppercase mb-2">
              Pull from Void
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed font-sans">
              Receive files or text directly onto your device instantly by entering the sender's 6-digit code.
            </p>
          </div>

          <div className="mt-6 flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            <span>Pull from Void</span>
            <span className="transition-transform group-hover:translate-x-1 font-bold">→</span>
          </div>
        </button>
      </div>

      {/* Professional Features Bar */}
      <div className="mt-12 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-xs font-mono text-neutral-500 dark:text-neutral-400">
        {onOpenSpeedGuide && (
          <button
            id="choice-speed-guide-btn"
            onClick={onOpenSpeedGuide}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/20 transition-colors cursor-pointer font-semibold"
          >
            <Gauge className="w-3.5 h-3.5 text-amber-500" />
            <span>Speed &amp; Network Guide</span>
          </button>
        )}

        <button
          onClick={onOpenFeatures}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-teal-500/40 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
          <span>End-to-End Encrypted</span>
        </button>

        <button
          onClick={onOpenFeatures}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-teal-500/40 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 text-teal-500" />
          <span>Direct Peer-to-Peer</span>
        </button>

        <button
          onClick={onOpenFeatures}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-teal-500/40 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
        >
          <HardDrive className="w-3.5 h-3.5 text-teal-500" />
          <span>Any File Size</span>
        </button>

        <button
          onClick={onOpenFeatures}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-teal-500/40 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5 text-teal-500" />
          <span>Zero Server Storage</span>
        </button>
      </div>
    </motion.div>
  );
};
