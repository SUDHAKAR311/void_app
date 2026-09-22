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
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SendViewProps {
  code: string;
  onBack: () => void;
  onGenerateCode: () => void;
  onRegenerateCode: () => void;
  selectedFile: File | null;
  onSelectFile: (file: File | null) => void;
  clipboardText: string;
  onChangeClipboardText: (text: string) => void;
  activeTab: 'file' | 'text';
  onChangeTab: (tab: 'file' | 'text') => void;
  isReceiverReady: boolean;
  onStartTransfer: () => void;
}

const WAITING_MESSAGES = [
  'Waiting for receiver to connect...',
  'Wait for a little while...',
  'Almost there...',
];

export const SendView: React.FC<SendViewProps> = ({
  code,
  onBack,
  onGenerateCode,
  onRegenerateCode,
  selectedFile,
  onSelectFile,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cycle waiting messages smoothly every 2.5s
  useEffect(() => {
    if (isReceiverReady) return;
    const interval = setInterval(() => {
      setWaitMessageIndex((prev) => (prev + 1) % WAITING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isReceiverReady]);

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onSelectFile(e.target.files[0]);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Ignore
    }
  };

  const hasPayload = activeTab === 'file' ? !!selectedFile : clipboardText.trim().length > 0;

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

      {/* Tabs: Send File vs Text Clipboard */}
      <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-950 p-1 my-5 border border-neutral-200/80 dark:border-neutral-800/80">
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
          <span>Send File</span>
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

      {/* Tab 1: File Drop Zone */}
      {activeTab === 'file' && (
        <div>
          {!selectedFile ? (
            <div
              id="file-drop-zone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-teal-500 bg-teal-500/10 scale-[1.01]'
                  : 'border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950/40 hover:border-teal-500/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileInput}
              />
              <div className="p-4 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 mb-3">
                <UploadCloud className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Select or Send File
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
                Drop any file here, or click to browse your device
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shrink-0">
                  {selectedFile.type.startsWith('video/') ? (
                    <Film className="w-5 h-5" />
                  ) : (
                    <File className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 break-words [overflow-wrap:anywhere] leading-snug">
                    {selectedFile.name}
                  </h4>
                  <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {formatBytes(selectedFile.size)} • {selectedFile.type || 'File'}
                  </p>
                </div>
              </div>
              <button
                id="remove-selected-file-btn"
                onClick={() => onSelectFile(null)}
                className="p-1.5 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors shrink-0"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
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
            <span>Direct P2P • Never stored on any server</span>
            <span>{clipboardText.length} characters</span>
          </div>
        </div>
      )}

      {/* Flow State: Either "Send & Get Void Code" OR The Generated Code Card */}
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
            <Send className="w-4 h-4" />
            <span>Send to Get Void Code</span>
          </button>
          <p className="text-center text-xs font-mono text-neutral-500 dark:text-neutral-400">
            {hasPayload 
              ? 'Click Send to generate your 6-digit encryption PIN' 
              : 'Select a file or enter text above to generate your code'}
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
            <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Your 6-Digit Void Code
            </span>

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

            {/* Live Partner State with Animated Progressive Messages */}
            <div className="mt-4 pt-3 border-t border-neutral-200/80 dark:border-neutral-800/80 min-h-[32px] flex items-center justify-center">
              {isReceiverReady ? (
                <span className="text-emerald-500 font-semibold flex items-center gap-2 text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Receiver Connected &amp; Verified! Starting transfer...
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
                      {WAITING_MESSAGES[waitMessageIndex]}
                    </motion.span>
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Status / Manual Trigger fallback if needed */}
          <div>
            <button
              id="cast-void-btn"
              disabled={!hasPayload || !isReceiverReady}
              onClick={onStartTransfer}
              className={`w-full py-3.5 px-6 rounded-xl font-mono text-sm font-bold tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 ${
                hasPayload && isReceiverReady
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-400 text-neutral-950 hover:brightness-105 cursor-pointer scale-[1.01]'
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
              }`}
            >
              <span>
                {isReceiverReady ? 'Transferring Now...' : 'Waiting for Receiver Connection'}
              </span>
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
