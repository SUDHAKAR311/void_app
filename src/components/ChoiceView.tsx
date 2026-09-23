/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { VoidLogo } from './VoidLogo';
import { 
  ArrowUp, 
  ArrowDown, 
  Zap, 
  User, 
  Users 
} from 'lucide-react';
import { motion } from 'motion/react';
import { DistributionMode } from '../types';

interface ChoiceViewProps {
  onSelectSend: (mode?: DistributionMode) => void;
  onSelectReceive: () => void;
  onOpenFeatures?: () => void;
  onOpenSpeedGuide?: () => void;
}

export const ChoiceView: React.FC<ChoiceViewProps> = ({
  onSelectSend,
  onSelectReceive,
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto flex flex-col items-center text-center"
    >
      {/* Brand Identity & Headline */}
      <div className="mb-6 sm:mb-8 flex flex-col items-center">
        <div className="mb-4">
          <VoidLogo size={64} />
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
          <span>Direct &amp; Multi-Recipient Ephemeral Transfers</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-neutral-900 dark:text-white font-mono lowercase">
          void<span className="text-teal-500 dark:text-teal-400">.</span>
        </h1>

        <p className="mt-3 text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto font-sans leading-relaxed">
          Send single or multiple files and text directly to one peer or broadcast to any number of people. Zero server storage, end-to-end encrypted.
        </p>
      </div>

      {/* Mode Selection Row: Direct P2P vs Person to Many Buttons */}
      <div className="w-full max-w-2xl mb-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          id="choice-p2p-btn"
          onClick={() => onSelectSend('p2p')}
          className="w-full sm:w-1/2 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-teal-500/80 dark:hover:border-teal-500/80 shadow-sm hover:shadow-md transition-all text-left flex items-center gap-3.5 cursor-pointer group"
        >
          <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 group-hover:scale-105 transition-transform shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-1.5">
              <span>Person to Person</span>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold px-1.5 py-0.2 rounded bg-teal-500/10">1-to-1</span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
              Private transfer directly to a single recipient
            </p>
          </div>
        </button>

        <button
          id="choice-broadcast-btn"
          onClick={() => onSelectSend('broadcast')}
          className="w-full sm:w-1/2 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-teal-500/80 dark:hover:border-teal-500/80 shadow-sm hover:shadow-md transition-all text-left flex items-center gap-3.5 cursor-pointer group"
        >
          <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 group-hover:scale-105 transition-transform shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-1.5">
              <span>Person to Many</span>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold px-1.5 py-0.2 rounded bg-teal-500/10">Broadcast</span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
              Simultaneous transfer for multiple recipients
            </p>
          </div>
        </button>
      </div>

      {/* Primary Action Cards: PUSH TO VOID & PULL FROM VOID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full max-w-2xl">
        {/* Send: Push to Void */}
        <button
          id="hero-send-btn"
          onClick={() => onSelectSend()}
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
              Send one or multiple files, videos, or text to one peer or broadcast to multiple users.
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
          className="group relative p-8 sm:p-9 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-emerald-500/80 dark:hover:border-emerald-500/80 shadow-md hover:shadow-xl hover:shadow-emerald-500/10 hover:scale-[1.02] transition-all duration-300 text-left flex flex-col justify-between overflow-hidden cursor-pointer"
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
              Receive files or text directly onto your device instantly by entering the 6-digit code or scanning QR.
            </p>
          </div>

          <div className="mt-6 flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            <span>Pull from Void</span>
            <span className="transition-transform group-hover:translate-x-1 font-bold">→</span>
          </div>
        </button>
      </div>
    </motion.div>
  );
};
