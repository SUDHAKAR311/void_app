/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { QRCodeDisplay } from './QRCodeDisplay';
import { 
  UploadCloud, 
  FileText, 
  Files, 
  QrCode, 
  Copy, 
  Check, 
  Lock, 
  X, 
  File, 
  Film, 
  RefreshCw, 
  Clock, 
  Send,
  ArrowUp,
  User,
  Users,
  Archive,
  Plus,
  HardDrive,
  CheckCircle2,
  Sun,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DistributionMode } from '../types';
import { wakeLockManager, WakeLockStatus } from '../utils/wakeLockManager';

interface SendViewProps {
  code: string;
  distributionMode: DistributionMode;
  onChangeDistributionMode: (mode: DistributionMode) => void;
  onBack: () => void;
  onGenerateCode: () => void;
  onRegenerateCode: () => void;
  selectedFiles: File[];
  onSelectFiles: (files: File[]) => void;
  clipboardText: string;
  onChangeClipboardText: (text: string) => void;
  activeTab: 'file' | 'text';
  onChangeTab: (tab: 'file' | 'text') => void;
  isReceiverReady: boolean;
  onStartTransfer: () => void;
}

const WAITING_MESSAGES_P2P = [
  'Waiting for receiver to connect...',
  'Wait for a little while...',
  'Almost there...',
];

const WAITING_MESSAGES_BROADCAST = [
  'Ready for multiple recipients...',
  'Share code with anyone to retrieve...',
  'RAM broadcast engine active...',
];

export const SendView: React.FC<SendViewProps> = ({
  code,
  distributionMode,
  onChangeDistributionMode,
  onBack,
  onGenerateCode,
  onRegenerateCode,
  selectedFiles,
  onSelectFiles,
  clipboardText,
  onChangeClipboardText,
  activeTab,
  onChangeTab,
  isReceiverReady,
  onStartTransfer,
}) => {
  const [showQR, setShowQR] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [waitMessageIndex, setWaitMessageIndex] = useState(0);
  const [wakeLockStatus, setWakeLockStatus] = useState<WakeLockStatus>(wakeLockManager.status);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return wakeLockManager.subscribe(setWakeLockStatus);
  }, []);

  // Keep screen awake while 6-digit code or QR is active
  useEffect(() => {
    if (code) {
      wakeLockManager.acquire();
    }
    return () => {
      wakeLockManager.release();
    };
  }, [code]);

  const waitingList = distributionMode === 'broadcast' ? WAITING_MESSAGES_BROADCAST : WAITING_MESSAGES_P2P;

  useEffect(() => {
    if (isReceiverReady && distributionMode === 'p2p') return;
    const interval = setInterval(() => {
      setWaitMessageIndex((prev) => (prev + 1) % waitingList.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isReceiverReady, distributionMode, waitingList.length]);

  const formatBytes = (bytes: number): string => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 2 : 0)} ${units[i]}`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      onSelectFiles([...selectedFiles, ...droppedFiles]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const addedFiles = Array.from(e.target.files);
      onSelectFiles([...selectedFiles, ...addedFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    const updated = selectedFiles.filter((_, i) => i !== index);
    onSelectFiles(updated);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const hasPayload = activeTab === 'file' ? selectedFiles.length > 0 : clipboardText.trim().length > 0;
  const totalFilesSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-xl mx-auto p-6 sm:p-8 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
        <button
          id="send-back-btn"
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

      {/* Mode Switcher: Person to Person vs Person to Many */}
      <div className="my-6">
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold">
            Transfer Architecture
          </label>
          <span className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 font-medium">
            {distributionMode === 'p2p' ? '1-to-1 WebRTC' : 'Multi-Peer Broadcast'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Option 1: Person to Person */}
          <button
            id="mode-p2p-btn"
            type="button"
            disabled={!!code}
            onClick={() => onChangeDistributionMode('p2p')}
            className={`relative p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              distributionMode === 'p2p'
                ? 'bg-neutral-50 dark:bg-neutral-800/90 border-neutral-900 dark:border-neutral-300 shadow-xs ring-1 ring-neutral-900/10 dark:ring-neutral-700'
                : 'bg-white dark:bg-neutral-950/60 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
            } ${code ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${
                  distributionMode === 'p2p'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}>
                  <User className="w-4 h-4" />
                </div>
                <span className="text-xs font-mono font-bold text-neutral-900 dark:text-white">
                  Person to Person
                </span>
              </div>
              {distributionMode === 'p2p' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-sans leading-snug pl-8">
              Private direct stream to a single recipient
            </p>
          </button>

          {/* Option 2: Person to Many */}
          <button
            id="mode-broadcast-btn"
            type="button"
            disabled={!!code}
            onClick={() => onChangeDistributionMode('broadcast')}
            className={`relative p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              distributionMode === 'broadcast'
                ? 'bg-neutral-50 dark:bg-neutral-800/90 border-neutral-900 dark:border-neutral-300 shadow-xs ring-1 ring-neutral-900/10 dark:ring-neutral-700'
                : 'bg-white dark:bg-neutral-950/60 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
            } ${code ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${
                  distributionMode === 'broadcast'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}>
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-xs font-mono font-bold text-neutral-900 dark:text-white">
                  Person to Many
                </span>
              </div>
              {distributionMode === 'broadcast' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-sans leading-snug pl-8">
              Simultaneous transfer for multiple recipients
            </p>
          </button>
        </div>

        {/* Clean Architecture Status Strip - Single Crisp Line */}
        <div className="mt-2.5 px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/70 dark:border-neutral-800/70 flex items-center justify-between text-xs font-mono text-neutral-600 dark:text-neutral-300">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-medium">
              {distributionMode === 'broadcast'
                ? 'Broadcast Active • One code for all recipients'
                : '1:1 Direct Active • Private peer-to-peer stream'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs: Send Files vs Text Clipboard */}
      <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-950 p-1 mb-5 border border-neutral-200/80 dark:border-neutral-800/80">
        <button
          id="send-tab-file"
          onClick={() => onChangeTab('file')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-mono font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === 'file'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Files className="w-4 h-4 text-teal-500" />
          <span>Files ({selectedFiles.length})</span>
        </button>

        <button
          id="send-tab-text"
          onClick={() => onChangeTab('text')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-mono font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === 'text'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4 text-teal-500" />
          <span>Text / Clipboard</span>
        </button>
      </div>

      {/* Tab 1: Multi-File Selection & Drop Zone */}
      {activeTab === 'file' && (
        <div className="space-y-3">
          <div
            id="file-drop-zone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`p-6 sm:p-7 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-teal-500 bg-teal-500/10 scale-[1.01]'
                : 'border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950/40 hover:border-teal-500/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
            <div className="p-3.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 mb-2">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Select or Drop Files at Once
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
              Supports multiple files, photos, videos, or documents
            </p>
          </div>

          {/* Selected Files List with Individual Remove & Total Counter */}
          {selectedFiles.length > 0 && (
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-200/60 dark:border-neutral-800/60 text-xs font-mono">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Archive className="w-3.5 h-3.5 text-teal-500" />
                  <span>{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} queued</span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-teal-600 dark:text-teal-400 font-bold">{formatBytes(totalFilesSize)}</span>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-[11px] text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add more</span>
                  </button>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800/70 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      <div className="text-teal-500 shrink-0">
                        {file.type.startsWith('video/') ? (
                          <Film className="w-4 h-4" />
                        ) : (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif|heic)$/i.test(file.name)) ? (
                          <ImageIcon className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <File className="w-4 h-4" />
                        )}
                      </div>
                      <span className="truncate text-neutral-800 dark:text-neutral-200 font-medium">
                        {file.name}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                        {formatBytes(file.size)}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(idx);
                      }}
                      className="p-1 text-neutral-400 hover:text-red-500 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                      title="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Payload Summary */}
              <div className="mt-2.5 pt-2 border-t border-neutral-200/70 dark:border-neutral-800/70 flex items-center justify-between text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                <span>{selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'} selected</span>
                <span className="text-neutral-700 dark:text-neutral-300 font-semibold">
                  Total Size: {formatBytes(totalFilesSize)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Text Clipboard input */}
      {activeTab === 'text' && (
        <div>
          <textarea
            id="clipboard-text-input"
            rows={5}
            value={clipboardText}
            onChange={(e) => onChangeClipboardText(e.target.value)}
            placeholder="Paste text, links, code, or notes here..."
            className="w-full p-4 rounded-xl text-xs sm:text-sm font-mono border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-all resize-none"
          />
          <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 mt-1 px-1">
            <span>Direct stream • Never stored on disk</span>
            <span>{clipboardText.length} characters</span>
          </div>
        </div>
      )}

      {/* Flow State: Either "Push to Void" OR The Generated Code Card */}
      {!code ? (
        <div className="mt-6 space-y-3">
          <button
            id="generate-void-code-btn"
            disabled={!hasPayload}
            onClick={onGenerateCode}
            className={`w-full py-4 px-6 rounded-xl font-mono text-sm font-bold tracking-wide transition-all shadow-lg flex items-center justify-center gap-2.5 ${
              hasPayload
                ? 'bg-gradient-to-r from-teal-500 to-emerald-400 text-neutral-950 hover:brightness-105 cursor-pointer scale-[1.01]'
                : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
            }`}
          >
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            <span>Push to Void</span>
          </button>
          <p className="text-center text-xs font-mono text-neutral-500 dark:text-neutral-400">
            {hasPayload 
              ? `Generates encrypted 6-digit PIN & QR for ${distributionMode === 'broadcast' ? 'broadcast' : 'direct transfer'}` 
              : 'Select one or more files, or enter text above to continue'}
          </p>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-6 space-y-6"
        >
          {/* Prominent 6-Digit Void Code Section */}
          <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/80 border border-neutral-200 dark:border-neutral-800 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Your 6-Digit Void Code
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                {distributionMode === 'broadcast' ? 'Broadcast (Multi-User)' : 'P2P (1-to-1)'}
              </span>
            </div>

            <div className="flex items-center justify-center gap-3 my-2">
              <div
                id="void-code-display"
                className="text-4xl sm:text-5xl font-mono font-black tracking-widest text-teal-600 dark:text-teal-400 select-all"
              >
                {code ? `${code.slice(0, 3)} ${code.slice(3)}` : '------'}
              </div>
              <button
                id="copy-code-inline-btn"
                onClick={copyCode}
                className="p-2 text-neutral-400 hover:text-teal-500 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Copy 6-digit code"
              >
                {copiedCode ? <Check className="w-5 h-5 text-teal-500" /> : <Copy className="w-5 h-5" />}
              </button>
              <button
                id="regenerate-code-btn"
                onClick={onRegenerateCode}
                className="p-2 text-neutral-400 hover:text-teal-500 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Generate a new random 6-digit PIN"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {/* QR Code toggle */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                id="toggle-qr-modal-btn"
                onClick={() => setShowQR(!showQR)}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-teal-500" />
                <span>{showQR ? 'Hide QR' : 'Show QR Code'}</span>
              </button>
            </div>

            {showQR && (
              <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <QRCodeDisplay code={code} />
              </div>
            )}

            {/* Live Status Message & Sleep Prevention Pill */}
            <div className="mt-4 pt-3 border-t border-neutral-200/80 dark:border-neutral-800/80 min-h-[32px] flex flex-col sm:flex-row items-center justify-between gap-2">
              {isReceiverReady && distributionMode === 'p2p' ? (
                <span className="text-emerald-500 font-semibold flex items-center gap-2 text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Receiver Connected! Ready to transfer...
                </span>
              ) : (
                <div className="flex items-center gap-2 text-xs font-mono text-neutral-600 dark:text-neutral-400">
                  <Clock className="w-3.5 h-3.5 text-teal-500 animate-spin" />
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={waitMessageIndex}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                    >
                      {waitingList[waitMessageIndex]}
                    </motion.span>
                  </AnimatePresence>
                </div>
              )}

              {wakeLockStatus.isActive && (
                <span 
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20"
                  title="Mobile screen kept awake while waiting for receiver"
                >
                  <Sun className="w-3 h-3 text-amber-500 animate-pulse" />
                  <span>Screen Kept Awake</span>
                </span>
              )}
            </div>
          </div>

          {/* Action Trigger */}
          <div>
            <button
              id="cast-void-btn"
              disabled={!hasPayload || (distributionMode === 'p2p' && !isReceiverReady)}
              onClick={onStartTransfer}
              className={`w-full py-3.5 px-6 rounded-xl font-mono text-sm font-bold tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 ${
                hasPayload && (distributionMode === 'broadcast' || isReceiverReady)
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-400 text-neutral-950 hover:brightness-105 cursor-pointer scale-[1.01]'
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
              }`}
            >
              <span>
                {distributionMode === 'broadcast'
                  ? 'Active Broadcast Ready • Anyone with code can retrieve'
                  : (isReceiverReady ? 'Transferring Now...' : 'Waiting for Receiver Connection')}
              </span>
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
