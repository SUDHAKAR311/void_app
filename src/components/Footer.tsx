/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  ShieldCheck, 
  Zap, 
  HardDrive, 
  ServerOff, 
  Sparkles 
} from 'lucide-react';

interface FooterProps {
  onOpenFeatures?: () => void;
  onOpenSpeedGuide?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ 
  onOpenFeatures,
}) => {
  return (
    <footer className="w-full mt-auto pt-8 pb-6 border-t border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-950/40 backdrop-blur-xs text-xs font-mono select-none">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-6">
        {/* Core Architecture Badges Row (Clean, Professional, No Speed Guide) */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 shadow-xs cursor-default">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-500 shrink-0" />
            <span className="font-medium text-[11px] sm:text-xs">AES-256-GCM Encrypted</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 shadow-xs cursor-default">
            <Zap className="w-3.5 h-3.5 text-teal-500 shrink-0" />
            <span className="font-medium text-[11px] sm:text-xs">Person to Many Broadcast</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 shadow-xs cursor-default">
            <HardDrive className="w-3.5 h-3.5 text-teal-500 shrink-0" />
            <span className="font-medium text-[11px] sm:text-xs">Multi-File Support</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 shadow-xs cursor-default">
            <ServerOff className="w-3.5 h-3.5 text-teal-500 shrink-0" />
            <span className="font-medium text-[11px] sm:text-xs">Zero Server Storage</span>
          </div>
        </div>

        {/* Bottom Metadata & System Status */}
        <div className="w-full pt-4 border-t border-neutral-200/60 dark:border-neutral-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-neutral-500 dark:text-neutral-400 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-neutral-800 dark:text-neutral-200 tracking-wide">void</span>
            <span className="text-neutral-300 dark:text-neutral-700">•</span>
            <span>Ephemeral WebRTC &amp; High-Speed Broadcast</span>
          </div>

          <div className="flex items-center gap-4 text-neutral-400 dark:text-neutral-500">
            <span>RAM Only • Zero Disks</span>
            <span className="text-neutral-300 dark:text-neutral-700">•</span>
            {onOpenFeatures && (
              <button
                id="footer-open-features-btn"
                onClick={onOpenFeatures}
                className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline cursor-pointer font-medium"
              >
                <Sparkles className="w-3 h-3" />
                <span>Architecture Details</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
