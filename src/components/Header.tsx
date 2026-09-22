/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { VoidLogo } from './VoidLogo';
import { Sparkles, Sun, Moon, Gauge } from 'lucide-react';

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenFeatures: () => void;
  onOpenSpeedGuide?: () => void;
  isConnected: boolean;
  onResetToHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isDark,
  onToggleTheme,
  onOpenFeatures,
  onOpenSpeedGuide,
  isConnected,
  onResetToHome,
}) => {
  return (
    <header className="w-full border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand & Slogan */}
        <div className="flex items-center gap-3">
          <button
            id="header-brand-logo-btn"
            onClick={onResetToHome}
            className="flex items-center gap-2 text-left cursor-pointer focus:outline-none"
            title="Return to void home"
          >
            <VoidLogo size={32} />
          </button>
          <div className="hidden sm:flex items-center">
            <span className="text-neutral-300 dark:text-neutral-700 mx-2">/</span>
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 tracking-wide">
              No trace left behind
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Connection Status Dot */}
          <div
            id="network-status-indicator"
            className="hidden xs:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border border-neutral-200 dark:border-neutral-800 bg-neutral-100/60 dark:bg-neutral-900/60 text-neutral-600 dark:text-neutral-400"
            title={isConnected ? 'Signal Server Connected' : 'Connecting to Server...'}
          >
            {isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px]">Ready</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[11px]">Connecting...</span>
              </>
            )}
          </div>

          {/* Speed Guide Button */}
          {onOpenSpeedGuide && (
            <button
              id="speed-guide-menu-btn"
              onClick={onOpenSpeedGuide}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:border-amber-500/40 transition-all cursor-pointer"
              title="How Speed Works & Performance Guide"
            >
              <Gauge className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Speed Guide</span>
              <span className="sm:hidden">Speed</span>
            </button>
          )}

          {/* Features Button */}
          <button
            id="features-menu-btn"
            onClick={onOpenFeatures}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:border-teal-500/40 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-500" />
            <span>Features</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            id="theme-toggle-btn"
            onClick={onToggleTheme}
            className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            aria-label="Toggle dark/light theme"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-700" />}
          </button>
        </div>
      </div>
    </header>
  );
};
