/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PinInput } from './PinInput';
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
  Clock
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
}

const CONNECTING_MESSAGES = [
  'Connecting to sender...',
  'Wait for a little while...',
  'Almost there...',
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
}) => {
  const [deviceStorageInfo, setDeviceStorageInfo] = useState<string>('Checking storage...');
  const [messageIndex, setMessageIndex] = useState<number>(0);

  // Measure actual device available storage using StorageManager API
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then((est) => {
        if (est.quota !== undefined && est.usage !== undefined) {
          const availableBytes = Math.max(0, est.quota - est.usage);
          if (availableBytes >= 1024 * 1024 * 1024) {
            const gb = (availableBytes / (1024 * 1024 * 1024)).toFixed(1);
            setDeviceStorageInfo(`${gb} GB free`);
          } else {
            const mb = (availableBytes / (1024 * 1024)).toFixed(0);
            setDeviceStorageInfo(`${mb} MB free`);
          }
        } else {
          setDeviceStorageInfo('Storage available');
        }
      }).catch(() => {
        setDeviceStorageInfo('Device storage available');
      });
    } else {
      setDeviceStorageInfo('Device storage available');
    }
  }, []);

  // Progressive connecting messages while loading
  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % CONNECTING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [isLoading]);

  const formatBytes = (bytes: number): string => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 2 : 0)} ${units[i]}`;
  };

  const getFileIcon = () => {
    if (!incomingMetadata) return <File className="w-8 h-8 text-teal-500" />;
    if (incomingMetadata.isText) return <FileText className="w-8 h-8 text-teal-500" />;
    if (incomingMetadata.type?.startsWith('video/')) return <Film className="w-8 h-8 text-teal-500" />;
    return <HardDrive className="w-8 h-8 text-teal-500" />;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-xl mx-auto p-6 sm:p-8 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl"
    >
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-5 border-b border-neutral-100 dark:border-neutral-800">
        <button
          id="receive-back-btn"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </button>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
          <Lock className="w-3 h-3" />
          <span>AES-256 Encrypted</span>
        </div>
      </div>

      {/* Main State: Enter PIN */}
      {!incomingMetadata ? (
        <div className="text-center my-6">
          <div className="inline-flex p-3 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 mb-3">
            <ArrowDown className="w-6 h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Pull from Void
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
            Enter the 6-digit key shared by the sender
          </p>

          {/* 6-Digit PIN input */}
          <div className="mt-5">
            <PinInput
              value={pin}
              onChange={onChangePin}
              onComplete={onSubmitPin}
              disabled={isLoading}
            />
          </div>

          {/* Device Storage Status Pill */}
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-600 dark:text-neutral-400">
            <HardDrive className="w-3.5 h-3.5 text-teal-500" />
            <span>Device Storage: <strong className="text-neutral-900 dark:text-neutral-200">{deviceStorageInfo}</strong></span>
          </div>

          {/* Error notification */}
          {errorMessage && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-mono flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Progressive Loading status */}
          {isLoading && (
            <div className="mt-5 flex items-center justify-center gap-2 text-xs font-mono text-teal-600 dark:text-teal-400">
              <Clock className="w-3.5 h-3.5 animate-spin" />
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
            disabled={pin.length !== 6 || isLoading}
            onClick={() => onSubmitPin(pin)}
            className={`mt-6 w-full py-3.5 px-6 rounded-xl font-mono text-sm font-bold tracking-wide transition-all shadow-md flex items-center justify-center gap-2 ${
              pin.length === 6 && !isLoading
                ? 'bg-gradient-to-r from-teal-500 to-emerald-400 text-neutral-950 hover:brightness-105 cursor-pointer scale-[1.01]'
                : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
            }`}
          >
            <span>{isLoading ? 'Connecting...' : 'Pull from Void'}</span>
          </button>
        </div>
      ) : (
        /* Incoming Payload Pre-Flight Info (Auto-starts immediately) */
        <div className="my-6 text-left">
          <div className="text-center mb-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              <span>Code Matched &amp; Verified</span>
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white mt-2">
              Incoming File
            </h2>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 shrink-0">
              {getFileIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 break-words [overflow-wrap:anywhere] leading-snug">
                {incomingMetadata.name}
              </h3>
              <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400 mt-1">
                {incomingMetadata.isText ? 'Clipboard Text' : formatBytes(incomingMetadata.size)} • {incomingMetadata.type || 'File'}
              </p>
            </div>
          </div>

          {/* Storage & Pre-Flight estimation */}
          <div className="grid grid-cols-2 gap-3 mt-4 text-xs font-mono">
            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/70 dark:border-neutral-800/70">
              <span className="text-neutral-500 dark:text-neutral-400 block text-[11px]">Available Storage</span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200 mt-0.5 block">
                {deviceStorageInfo}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/70 dark:border-neutral-800/70">
              <span className="text-neutral-500 dark:text-neutral-400 block text-[11px]">Encryption</span>
              <span className="font-semibold text-teal-600 dark:text-teal-400 mt-0.5 block">
                AES-256 Verified
              </span>
            </div>
          </div>

          {/* Quick Accept Button if not auto-started */}
          <button
            id="accept-transfer-btn"
            onClick={onAcceptTransfer}
            className="mt-6 w-full py-3.5 px-6 rounded-xl font-mono text-sm font-bold tracking-wide bg-gradient-to-r from-teal-500 to-emerald-400 text-neutral-950 hover:brightness-105 cursor-pointer transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <span>Starting Transfer...</span>
          </button>
        </div>
      )}
    </motion.div>
  );
};
