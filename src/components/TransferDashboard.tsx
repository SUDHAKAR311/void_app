/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { TransferMetadata, TransferProgress, VoidRole, VoidStatus } from '../types';
import { 
  CheckCircle2, 
  Lock, 
  Radio, 
  Zap, 
  File, 
  FileText, 
  Film, 
  Music,
  HardDrive, 
  X,
  Download,
  Copy,
  Check,
  RotateCcw,
  Globe,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';

interface TransferDashboardProps {
  role: VoidRole;
  status?: VoidStatus;
  metadata: TransferMetadata | null;
  progress: TransferProgress;
  isCompleted?: boolean;
  isError?: boolean;
  errorMessage?: string;
  receivedText?: string;
  downloadBlob?: { blob: Blob; filename: string } | null;
  downloadUrl?: string;
  onCancel: () => void;
  onReset: () => void;
  onManualDownload?: () => void;
  onDownloadManual?: () => void;
  onOpenSpeedGuide?: () => void;
}

export const TransferDashboard: React.FC<TransferDashboardProps> = ({
  role,
  status,
  metadata,
  progress,
  isCompleted: propIsCompleted,
  isError: propIsError,
  errorMessage,
  receivedText,
  downloadBlob,
  downloadUrl,
  onCancel,
  onReset,
  onManualDownload,
  onDownloadManual,
  onOpenSpeedGuide,
}) => {
  const isCompleted = propIsCompleted ?? (status === 'completed');
  const isError = propIsError ?? (status === 'error');
  const handleDownload = onManualDownload || onDownloadManual;
  const [copiedText, setCopiedText] = useState(false);
  const [deviceStorage, setDeviceStorage] = useState<string>('');

  const isVideo = Boolean(
    metadata?.type?.startsWith('video/') ||
    /\.(mp4|webm|mov|mkv|avi|m4v|ogv)$/i.test(metadata?.name || '') ||
    /\.(mp4|webm|mov|mkv|avi|m4v|ogv)$/i.test(downloadBlob?.filename || '')
  );

  const isAudio = Boolean(
    metadata?.type?.startsWith('audio/') ||
    /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(metadata?.name || '') ||
    /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(downloadBlob?.filename || '')
  );

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then((est) => {
        if (est.quota !== undefined && est.usage !== undefined) {
          const availableBytes = Math.max(0, est.quota - est.usage);
          if (availableBytes >= 1024 * 1024 * 1024) {
            setDeviceStorage(`${(availableBytes / (1024 * 1024 * 1024)).toFixed(1)} GB free`);
          } else {
            setDeviceStorage(`${(availableBytes / (1024 * 1024)).toFixed(0)} MB free`);
          }
        }
      }).catch(() => {});
    }
  }, []);

  const formatBytes = (bytes: number): string => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 2 : 0)} ${units[i]}`;
  };

  const formatSpeed = (bps: number): string => {
    if (!bps) return '0 KB/s';
    if (bps >= 1024 * 1024) {
      return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    return `${(bps / 1024).toFixed(0)} KB/s`;
  };

  const formatETA = (seconds: number): string => {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return 'Calculating...';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const remainingSecs = seconds % 60;
    return `${mins}m ${remainingSecs}s`;
  };

  const copyReceivedText = async () => {
    if (!receivedText) return;
    try {
      await navigator.clipboard.writeText(receivedText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // Ignore
    }
  };

  const getFileIcon = () => {
    if (!metadata) return <File className="w-8 h-8 text-teal-500" />;
    if (metadata.isText) return <FileText className="w-8 h-8 text-teal-500" />;
    if (metadata.type?.startsWith('video/')) return <Film className="w-8 h-8 text-teal-500" />;
    return <HardDrive className="w-8 h-8 text-teal-500" />;
  };

  const getModeBadge = () => {
    switch (progress.mode) {
      case 'p2p-direct':
        if (progress.networkRoute === 'local-lan') {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" title="Direct Local LAN connection (Maximum Wi-Fi/Ethernet Speed)">
              <Zap className="w-3.5 h-3.5 text-emerald-500" />
              <span>Direct LAN P2P (Max Speed)</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" title="Internet P2P: Speed is bounded by your internet upload speed">
            <Globe className="w-3.5 h-3.5 text-amber-500" />
            <span>Internet P2P (Upload Capped)</span>
          </span>
        );
      case 'turn-relay':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            <span>Encrypted Relay</span>
          </span>
        );
      case 'socket-pipe':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
            <Radio className="w-3 h-3 text-cyan-500" />
            <span>Encrypted Tunnel Stream</span>
          </span>
        );
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-xl mx-auto p-6 sm:p-8 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl transition-all"
    >
      {/* Top Verified Banner */}
      <div className="mb-4 flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="font-bold">Connected &amp; Verified</span>
        </div>
        <span className="text-[11px] opacity-80">PIN Matched</span>
      </div>

      {/* Top Status & Mode Header */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          {getModeBadge()}
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
          <Lock className="w-3 h-3" />
          <span>AES-256-GCM</span>
        </div>
      </div>

      {/* Item Summary Card with FULL Filename Visibility */}
      <div className="mt-5 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/70 dark:border-neutral-800/70 flex items-start gap-4">
        <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 shrink-0 mt-0.5">
          {getFileIcon()}
        </div>
        <div className="flex-1 min-w-0">
          {/* Filename clearly and fully visible with word-wrapping */}
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 break-words [overflow-wrap:anywhere] leading-snug">
            {metadata?.name || 'Void Payload'}
          </h3>
          <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400 mt-1">
            {metadata?.isText ? 'Clipboard Text' : formatBytes(metadata?.size || 0)}
            {metadata?.chunkCount ? ` • ${metadata.chunkCount.toLocaleString()} chunks` : ''}
          </p>
          {deviceStorage && role === 'receiver' && (
            <p className="text-[11px] font-mono text-teal-600 dark:text-teal-400 mt-1">
              Device Storage: {deviceStorage}
            </p>
          )}
        </div>
      </div>

      {/* Main Transfer Visualizer */}
      <div className="mt-6">
        {/* Progress Bar Header */}
        <div className="flex items-center justify-between text-xs font-mono mb-2">
          <span className="text-neutral-600 dark:text-neutral-400 font-semibold">
            {isCompleted
              ? 'Transfer Complete'
              : isError
              ? 'Interrupted'
              : role === 'sender'
              ? 'Pushing to recipient...'
              : 'Pulling from sender...'}
          </span>
          <span className="text-sm font-bold font-mono text-teal-600 dark:text-teal-400">
            {Math.min(100, Math.max(0, progress.percentage)).toFixed(1)}%
          </span>
        </div>

        {/* Outer Progress Track */}
        <div className="h-3 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden relative">
          <motion.div
            className="h-full bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-400 rounded-full transition-all duration-150 relative"
            style={{ width: `${Math.min(100, Math.max(0, progress.percentage))}%` }}
          >
            {!isCompleted && !isError && (
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            )}
          </motion.div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/60 dark:border-neutral-800/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block">
              Transferred
            </span>
            <div className="text-xs sm:text-sm font-mono font-bold text-neutral-900 dark:text-neutral-100 mt-1 truncate">
              {formatBytes(progress.bytesTransferred)}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/60 dark:border-neutral-800/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block">
              Speed
            </span>
            <div className="text-xs sm:text-sm font-mono font-bold text-neutral-900 dark:text-neutral-100 mt-1">
              {isCompleted ? 'Done' : formatSpeed(progress.speedBps)}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/60 dark:border-neutral-800/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block">
              ETA
            </span>
            <div className="text-xs sm:text-sm font-mono font-bold text-neutral-900 dark:text-neutral-100 mt-1 truncate">
              {isCompleted ? '0s' : formatETA(progress.etaSeconds)}
            </div>
          </div>
        </div>

        {/* Network Route Advisory Tip */}
        {progress.networkRoute !== 'local-lan' && !isCompleted && !isError && (
          <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-neutral-600 dark:text-neutral-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-left">
            <div className="flex items-start gap-2.5">
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>
                Transferring over public internet route. If both devices are on the same Wi-Fi, disabling router <strong className="text-neutral-900 dark:text-neutral-200">AP/Client Isolation</strong> enables direct LAN transfer (30–60+ MB/s).
              </span>
            </div>
            {onOpenSpeedGuide && (
              <button
                id="dashboard-open-speed-guide-btn"
                onClick={onOpenSpeedGuide}
                className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-semibold transition-colors cursor-pointer self-end sm:self-auto shrink-0"
              >
                Speed Guide →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Completed State Actions */}
      {isCompleted && (
        <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Encrypted transfer verified bit-for-bit</span>
          </div>

          {/* Text clipboard download/copy */}
          {receivedText && (
            <div className="mt-3">
              <div className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-800 dark:text-neutral-200 max-h-32 overflow-y-auto break-all">
                {receivedText}
              </div>
              <button
                id="copy-received-text-btn"
                onClick={copyReceivedText}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20 transition-colors cursor-pointer"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-teal-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'Copied to Clipboard' : 'Copy Text'}</span>
              </button>
            </div>
          )}

          {/* Instant zero-buffering video player */}
          {downloadBlob && isVideo && downloadUrl && (
            <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-black shadow-lg">
              <div className="px-3 py-2 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between text-[11px] font-mono text-neutral-400">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Film className="w-3.5 h-3.5" />
                  Instant Video Playback (0% Buffering)
                </span>
                <span className="truncate max-w-[150px]">{downloadBlob.filename}</span>
              </div>
              <video
                id="void-received-video"
                src={downloadUrl}
                controls
                playsInline
                preload="auto"
                className="w-full max-h-72 object-contain bg-black"
              />
            </div>
          )}

          {/* Instant audio player */}
          {downloadBlob && isAudio && downloadUrl && (
            <div className="mt-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-900/90 shadow-md">
              <div className="text-[11px] font-mono text-neutral-400 mb-2 flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Music className="w-3.5 h-3.5" />
                <span>Audio Playback</span>
              </div>
              <audio
                id="void-received-audio"
                src={downloadUrl}
                controls
                preload="auto"
                className="w-full"
              />
            </div>
          )}

          {/* File download button */}
          {downloadBlob && (
            <div className="mt-3">
              <button
                id="manual-download-btn"
                onClick={handleDownload}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 text-neutral-950 font-mono text-xs font-bold hover:brightness-105 transition-all shadow-md cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Save File to Device ({formatBytes(downloadBlob.blob.size)})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs sm:text-sm flex items-start gap-2.5">
          <X className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Transfer Interrupted</div>
            <div className="mt-0.5 text-xs">{errorMessage || 'Connection terminated by peer or network drop.'}</div>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-3">
        {!isCompleted && !isError ? (
          <button
            id="cancel-transfer-btn"
            onClick={onCancel}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-mono rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        ) : (
          <button
            id="new-transfer-btn"
            onClick={onReset}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-mono font-semibold rounded-lg bg-neutral-900 dark:bg-teal-500 text-white dark:text-neutral-950 hover:bg-neutral-800 dark:hover:bg-teal-400 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Start New Transfer</span>
          </button>
        )}
      </div>
    </motion.div>
  );
};
