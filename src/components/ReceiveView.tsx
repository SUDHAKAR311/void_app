/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PinInput } from './PinInput';
import { SecurityModal } from './SecurityModal';
import { TransferMetadata } from '../types';
import { 
  ArrowDown, 
  Lock, 
  X, 
  CheckCircle2, 
  AlertCircle,
  File,
  FileText,
  Film,
  HardDrive,
  Clock,
  Archive,
  Users,
  ShieldCheck,
  ChevronLeft,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReceiveViewProps {
  pin: string;
  onChangePin: (pin: string) => void;
  onSubmitPin: (pin: string) => void;
  onBack: () => void;
  incomingMetadata: TransferMetadata | null;
  onAcceptTransfer: () => void;
  isLoading: boolean;
  errorMessage?: string;
  warningMessage?: string;
  isLocked?: boolean;
  lockRemainingSeconds?: number;
}

const CONNECTING_MESSAGES = [
  'Locating Void payload in RAM...',
  'Deriving AES-256-GCM zero-knowledge key...',
  'Connecting secure peer stream...',
];

export const ReceiveView: React.FC<ReceiveViewProps> = ({
  pin,
  onChangePin,
  onSubmitPin,
  onBack,
  incomingMetadata,
  onAcceptTransfer,
  isLoading,
  errorMessage,
  warningMessage,
  isLocked = false,
  lockRemainingSeconds = 0,
}) => {
  const [messageIndex, setMessageIndex] = useState<number>(0);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(lockRemainingSeconds);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'warning' | 'lockout';
    title?: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    setCountdownSeconds(lockRemainingSeconds);
  }, [lockRemainingSeconds]);

  // Live countdown timer for lockout
  useEffect(() => {
    if (!isLocked || countdownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCountdownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isLocked, countdownSeconds]);

  // Trigger popup modal for warnings (no inline yellow banners!)
  useEffect(() => {
    if (warningMessage) {
      setModalConfig({
        isOpen: true,
        type: 'warning',
        title: 'Security Verification Notice',
        message: warningMessage,
      });
    }
  }, [warningMessage]);

  // Trigger popup modal on lockout
  useEffect(() => {
    if (isLocked) {
      setModalConfig({
        isOpen: true,
        type: 'lockout',
        title: 'Security Cooldown Active',
        message: 'Too many unsuccessful code verification attempts. To safeguard ephemeral session privacy and prevent unauthorized access, code retrieval on this device has been temporarily suspended.',
      });
    }
  }, [isLocked]);

  // If user tries to keep trying via keyboard while locked, show popup
  useEffect(() => {
    if (!isLocked) return;
    const handleKeyWhenLocked = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return;
      if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace') {
        triggerLockoutModal();
      }
    };
    window.addEventListener('keydown', handleKeyWhenLocked);
    return () => window.removeEventListener('keydown', handleKeyWhenLocked);
  }, [isLocked, countdownSeconds]);

  // Progressive connecting messages while loading
  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % CONNECTING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [isLoading]);

  const triggerLockoutModal = () => {
    setModalConfig({
      isOpen: true,
      type: 'lockout',
      title: 'Security Cooldown Active',
      message: 'Access is temporarily restricted due to repeated invalid verification attempts. To safeguard session privacy, please allow the active cooldown window to conclude before trying another code.',
    });
  };

  const handlePullAttempt = () => {
    if (isLocked) {
      triggerLockoutModal();
      return;
    }
    if (pin.length === 6) {
      onSubmitPin(pin);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 2 : 0)} ${units[i]}`;
  };

  const formatLockTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-xl mx-auto p-6 sm:p-8 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 shadow-xl"
    >
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/80 pb-4">
        <button
          id="receive-back-btn"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono text-neutral-600 dark:text-neutral-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Encrypted Tunnel</span>
          </div>
        </div>
      </div>

      {/* Main State: Enter PIN */}
      {!incomingMetadata ? (
        <div className="text-center my-6">
          <div className="inline-flex p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 mb-3">
            <ArrowDown className="w-5 h-5" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white font-sans">
            Retrieve Payload
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-sans">
            Enter the 6-digit verification code provided by the sender
          </p>

          {/* 6-Digit PIN input */}
          <div className="mt-5">
            <PinInput
              value={pin}
              onChange={onChangePin}
              onComplete={onSubmitPin}
              disabled={isLoading || isLocked}
              onAttemptWhenDisabled={isLocked ? triggerLockoutModal : undefined}
            />
          </div>

          {/* Cooldown Active Inline Banner (Clean & Professional, no loud colors) */}
          {isLocked && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={triggerLockoutModal}
              className="mt-4 p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/80 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between cursor-pointer hover:border-neutral-300 dark:hover:border-neutral-700 transition-all text-left"
              title="Click to view lockout details"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Clock className="w-4 h-4 text-rose-500 shrink-0 animate-spin" />
                <div className="min-w-0">
                  <div className="text-xs font-mono font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <span>Security Cooldown Active</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 font-semibold">
                      Restricted
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-sans truncate mt-0.5">
                    Wait {formatLockTime(countdownSeconds)} ({countdownSeconds}s) before retrying
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono text-neutral-700 dark:text-neutral-300 font-medium shrink-0 ml-3 underline">
                View Details
              </span>
            </motion.div>
          )}

          {/* Error notification (clean neutral pill) */}
          {errorMessage && !isLocked && (
            <div className="mt-4 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-mono flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-neutral-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Progressive Loading status */}
          {isLoading && (
            <div className="mt-5 flex items-center justify-center gap-2 text-xs font-mono text-neutral-700 dark:text-neutral-300">
              <Clock className="w-3.5 h-3.5 animate-spin text-neutral-500" />
              <AnimatePresence mode="wait">
                <motion.span
                  key={messageIndex}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.2 }}
                >
                  {CONNECTING_MESSAGES[messageIndex]}
                </motion.span>
              </AnimatePresence>
            </div>
          )}

          {/* Submit action */}
          <button
            id="submit-pin-btn"
            disabled={(!isLocked && pin.length !== 6) || isLoading}
            onClick={handlePullAttempt}
            className={`mt-6 w-full py-3.5 px-6 rounded-xl font-sans text-sm font-semibold tracking-normal transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
              isLocked
                ? 'bg-neutral-100 hover:bg-neutral-200/80 text-rose-600 dark:bg-neutral-800 dark:text-rose-400 border border-neutral-200 dark:border-neutral-700'
                : pin.length === 6 && !isLoading
                ? 'bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100'
                : 'bg-neutral-100 dark:bg-neutral-800/60 text-neutral-400 dark:text-neutral-500 cursor-not-allowed border border-neutral-200/50 dark:border-neutral-800'
            }`}
          >
            <span>
              {isLocked 
                ? `Cooldown Active (${countdownSeconds}s remaining) • View Details`
                : isLoading 
                ? 'Connecting to Peer...' 
                : 'Pull from Void'}
            </span>
          </button>
        </div>
      ) : (
        /* Incoming Payload Pre-Flight Info (Auto-starts immediately) */
        <div className="my-6 text-left">
          <div className="text-center mb-5">
            <div className="inline-flex p-3 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Payload Found
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-sans mt-0.5">
              Encrypted channel established • Initializing transfer
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-500">Payload Type:</span>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 uppercase">
                {incomingMetadata.type === 'archive' 
                  ? `Batch Archive (${incomingMetadata.fileManifest?.length || incomingMetadata.fileCount || 0} items)`
                  : incomingMetadata.type}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-500">Total Size:</span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100">
                {formatBytes(incomingMetadata.size)}
              </span>
            </div>

            {incomingMetadata.distributionMode && (
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-neutral-500">Distribution:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-neutral-800 dark:text-neutral-200">
                  {incomingMetadata.distributionMode === 'broadcast' ? (
                    <>
                      <Users className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Person to Many</span>
                    </>
                  ) : (
                    <span>Person to Person</span>
                  )}
                </span>
              </div>
            )}

            {/* Respective Image / Payload Storage Verification */}
            <div className="pt-2.5 border-t border-neutral-200 dark:border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-neutral-500">
                  {(incomingMetadata.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif|heic)$/i.test(incomingMetadata.name || ''))
                    ? 'Respective Image:'
                    : 'Respective File:'}
                </span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 truncate max-w-[220px]">
                  {(incomingMetadata.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif|heic)$/i.test(incomingMetadata.name || '')) ? (
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <File className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  )}
                  <span className="truncate">{incomingMetadata.name || 'Payload'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-neutral-500">
                  {(incomingMetadata.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif|heic)$/i.test(incomingMetadata.name || ''))
                    ? 'Actual Size of this Image:'
                    : 'Actual Size of this File:'}
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatBytes(incomingMetadata.size)}
                </span>
              </div>

              {/* Status banner verifying storage for respective image */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate font-semibold">
                    Payload Verified • Ready to Receive {(incomingMetadata.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif|heic)$/i.test(incomingMetadata.name || '')) ? 'Image' : 'File'}
                  </span>
                </div>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0 ml-2 font-medium">
                  ✓ Verified
                </span>
              </div>
            </div>

            {incomingMetadata.fileManifest && incomingMetadata.fileManifest.length > 0 && (
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <div className="text-[11px] font-mono text-neutral-500 mb-1.5 flex items-center justify-between">
                  <span>File Manifest ({incomingMetadata.fileManifest.length} items):</span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {incomingMetadata.fileManifest.map((file, idx) => (
                    <div 
                      key={idx} 
                      className="p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-xs font-mono flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <File className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <span className="text-[11px] text-neutral-400 shrink-0">
                        {formatBytes(file.size)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            id="accept-transfer-btn"
            onClick={onAcceptTransfer}
            className="mt-6 w-full py-3.5 px-6 rounded-xl font-sans text-sm font-semibold tracking-normal transition-all shadow-sm flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 cursor-pointer"
          >
            <span>Start Immediate Transfer</span>
          </button>
        </div>
      )}

      {/* Security Warning & Lockout Pop-up Modal */}
      <SecurityModal
        isOpen={!!modalConfig?.isOpen}
        type={modalConfig?.type || 'warning'}
        title={modalConfig?.title}
        message={modalConfig?.message || ''}
        remainingSeconds={countdownSeconds}
        onClose={() => setModalConfig(null)}
      />
    </motion.div>
  );
};
