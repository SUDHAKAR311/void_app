/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ShieldAlert, ShieldX, Clock, Check, Lock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SecurityModalProps {
  isOpen: boolean;
  type: 'warning' | 'lockout';
  title?: string;
  message: string;
  remainingAttempts?: number;
  remainingSeconds?: number;
  onClose: () => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  isOpen,
  type,
  title,
  message,
  remainingSeconds = 0,
  onClose,
}) => {
  const isLock = type === 'lockout';
  const [currentSeconds, setCurrentSeconds] = useState(remainingSeconds);

  // Keep local seconds synced and ticking every second when modal is open
  useEffect(() => {
    setCurrentSeconds(remainingSeconds);
  }, [remainingSeconds]);

  useEffect(() => {
    if (!isOpen || !isLock || currentSeconds <= 0) return;
    const timer = setInterval(() => {
      setCurrentSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, isLock, currentSeconds]);

  if (!isOpen) return null;

  const formatLockTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const defaultTitle = isLock
    ? 'Security Cooldown Active'
    : 'Verification Notice';

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 shadow-2xl p-6 sm:p-7 text-neutral-900 dark:text-neutral-100 overflow-hidden"
        >
          {/* Subtle Top Accent Border */}
          <div 
            className={`absolute top-0 left-0 right-0 h-1 ${
              isLock 
                ? 'bg-rose-500' 
                : 'bg-neutral-800 dark:bg-neutral-300'
            }`} 
          />

          {/* Header */}
          <div className="flex items-start gap-3.5 mb-4">
            <div
              className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                isLock
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700'
              }`}
            >
              {isLock ? <Lock className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    isLock 
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                      : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                  }`}
                >
                  {isLock ? 'Anti-Brute Force Protection' : 'Security Alert'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold font-sans tracking-tight text-neutral-900 dark:text-white mt-1">
                {title || defaultTitle}
              </h3>
            </div>
          </div>

          {/* Body Message */}
          <div className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed font-sans">
            <p>{message}</p>
          </div>

          {/* Dynamic Cooldown Countdown Display for Lockout */}
          {isLock && (
            <div className="mt-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                  <span className="text-xs font-mono font-medium text-neutral-600 dark:text-neutral-400">
                    Required Wait Time
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-500">
                  <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0 animate-spin" />
                  <span>Cooldown active</span>
                </div>
              </div>

              <div className="mt-2.5 flex items-baseline justify-between border-t border-neutral-200/60 dark:border-neutral-800/60 pt-2.5">
                <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-neutral-900 dark:text-white">
                  {formatLockTime(currentSeconds)}
                </div>
                <div className="text-xs font-mono text-rose-600 dark:text-rose-400 font-medium">
                  {currentSeconds.toLocaleString()} seconds left
                </div>
              </div>

              <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400 font-sans leading-normal">
                Verification requests from this client are paused to maintain ephemeral void privacy. You may attempt again once the timer concludes.
              </p>
            </div>
          )}

          {/* Warning context guidance note if not locked */}
          {!isLock && (
            <div className="mt-3.5 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200/80 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 font-sans leading-relaxed">
              Please double-check the 6-digit code on the sender screen before trying again. Repeated failed attempts will initiate a temporary cooldown window.
            </div>
          )}

          {/* Confirm Action Button */}
          <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <button
              id="security-modal-got-it-btn"
              type="button"
              onClick={onClose}
              className="w-full py-2.5 sm:py-3 px-4 rounded-xl text-xs font-sans font-semibold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400"
            >
              <Check className="w-4 h-4" />
              <span>Got it</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
