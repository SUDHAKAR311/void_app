/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Zap, 
  HardDrive, 
  ServerOff, 
  Fingerprint, 
  Smartphone, 
  X, 
  CheckCircle2, 
  Lock, 
  KeyRound, 
  Globe,
  Radio,
  Cpu,
  Play,
  ClipboardList,
  Sparkles,
  Gauge
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSpeedGuide?: () => void;
}

export const FeaturesModal: React.FC<FeaturesModalProps> = ({ 
  isOpen, 
  onClose,
  onOpenSpeedGuide 
}) => {
  const [filter, setFilter] = useState<'all' | 'security' | 'performance' | 'usability'>('all');

  if (!isOpen) return null;

  const allFeatures = [
    {
      category: 'security',
      icon: <Lock className="w-5 h-5 text-teal-400" />,
      title: 'End-to-End Encryption (AES-256-GCM + PBKDF2)',
      badge: 'Military Grade',
      simpleSummary: 'Client-side authenticated encryption locks data before it leaves your browser.',
      details:
        'Derives a 256-bit encryption key from the temporary 6-digit code using PBKDF2 with 100,000 iterations and a cryptographically secure 16-byte salt. Uses unique deterministic 12-byte initialization vectors (IV) for every chunk and 128-bit authentication tags.',
    },
    {
      category: 'performance',
      icon: <Cpu className="w-5 h-5 text-teal-400" />,
      title: 'Multi-Threaded Hardware Web Crypto Acceleration',
      badge: '8 Parallel Threads',
      simpleSummary: 'Offloads AES-256-GCM encryption across 8 parallel Web Worker hardware threads.',
      details:
        'Distributes cryptographic workloads across CPU cores utilizing native browser hardware AES-NI instructions. Encryption and decryption operate asynchronously ahead of network line rate without blocking the main UI thread.',
    },
    {
      category: 'performance',
      icon: <Zap className="w-5 h-5 text-teal-400" />,
      title: 'High-Throughput WebRTC SCTP Acceleration',
      badge: 'Up to 60+ MB/s',
      simpleSummary: 'Expanded 9.6 MB in-flight sliding window with an 8 MB backpressure buffer.',
      details:
        'Uses an aggressive 160-chunk in-flight sliding window (~9.6 MB) and monitors the SCTP bufferedAmountLowThreshold (8 MB). Fully saturates gigabit LAN and 5 GHz Wi-Fi connections with zero stop-and-wait delays.',
    },
    {
      category: 'performance',
      icon: <Gauge className="w-5 h-5 text-teal-400" />,
      title: 'Unordered SCTP Streaming (Zero Head-of-Line Blocking)',
      badge: 'Wi-Fi Optimized',
      simpleSummary: 'Eliminates Wi-Fi radio jitter pauses while maintaining 100% reliable delivery.',
      details:
        'Operates data channels with unordered SCTP delivery. If a single UDP packet is delayed by radio interference, subsequent packets continue processing immediately. Chunks are self-indexed and reassembled in memory without stalling.',
    },
    {
      category: 'performance',
      icon: <Globe className="w-5 h-5 text-teal-400" />,
      title: 'Real-Time Network Route Diagnostics',
      badge: 'Smart Route Detection',
      simpleSummary: 'Live inspection of active ICE candidate pairs and router connection paths.',
      details:
        'Detects whether your connection is Direct Local LAN, Internet P2P, or Relay Server. Automatically alerts you if router AP/Client Isolation is forcing your connection over the public internet and guides you to unlock maximum speed.',
    },
    {
      category: 'performance',
      icon: <Radio className="w-5 h-5 text-teal-400" />,
      title: 'Triple-Path Connection & Failover Guarantee',
      badge: '100% Reliable',
      simpleSummary: 'Never gets stuck on "connecting" even behind strict corporate or school firewalls.',
      details:
        'Triple-stage connection fallback hierarchy: Direct WebRTC P2P (host candidates) → STUN NAT Traversal (srflx candidates) → Encrypted WebSocket Socket Pipe relay fallback. If UDP is completely blocked by a firewall, data seamlessly routes over HTTPS/WSS.',
    },
    {
      category: 'performance',
      icon: <ShieldCheck className="w-5 h-5 text-teal-400" />,
      title: 'Resilient Decoupled P2P Connection',
      badge: 'Fault Tolerant',
      simpleSummary: 'Transfers continue streaming even if the signaling server disconnects.',
      details:
        'WebRTC data channels operate autonomously between browsers once negotiated. Signaling server blips or temporary socket drops will never kill or restart an in-flight transfer, backed by a 15-second grace period.',
    },
    {
      category: 'usability',
      icon: <HardDrive className="w-5 h-5 text-teal-400" />,
      title: 'Any File Size & Memory-Safe Streaming',
      badge: 'No File Size Limit',
      simpleSummary: 'Transfers 4K movies, heavy ZIPs, and disk images without browser crashes.',
      details:
        'Reads files in continuous 60 KB micro-slices with rolling chunk assembly and zero-copy typed array buffers. Uses minimal RAM overhead regardless of whether the file is 10 MB or 15 GB.',
    },
    {
      category: 'usability',
      icon: <Play className="w-5 h-5 text-teal-400" />,
      title: 'Zero-Buffering Native Video & Media Player',
      badge: 'Instant Playback',
      simpleSummary: 'Watch transferred MP4, WebM, MOV, and MKV videos directly inside the browser.',
      details:
        'Automatically inspects file magic bytes and MIME containers upon completion. Instantly mounts an in-app HTML5 hardware-accelerated video player allowing you to watch videos immediately without manual disk downloading.',
    },
    {
      category: 'security',
      icon: <Fingerprint className="w-5 h-5 text-teal-400" />,
      title: 'Anti-Tamper Cryptographic SHA-256 Verification',
      badge: 'Bit-for-Bit Verified',
      simpleSummary: 'Guarantees the received file matches the original byte-for-byte without corruption.',
      details:
        'Computes cryptographic SHA-256 fingerprints before sending and verifies the entire payload upon reassembly. Any tampering or packet corruption immediately triggers an integrity breach alert.',
    },
    {
      category: 'usability',
      icon: <ClipboardList className="w-5 h-5 text-teal-400" />,
      title: 'Direct Encrypted Text & Clipboard Sync',
      badge: 'Instant Sync',
      simpleSummary: 'Instantly send URLs, passwords, long code snippets, and notes between devices.',
      details:
        'Dedicated text synchronization mode with live character counters, real-time chunk streaming, and one-click copy to clipboard with visual confirmation.',
    },
    {
      category: 'usability',
      icon: <Smartphone className="w-5 h-5 text-teal-400" />,
      title: 'Screen Wake-Lock & Mobile Sleep Protection',
      badge: 'Background Safe',
      simpleSummary: 'Prevents phones and laptops from going to sleep while transferring large files.',
      details:
        'Integrates the native Screen Wake Lock API to prevent mobile operating systems (iOS and Android) from locking screens or throttling background browser network sockets during transfers.',
    },
    {
      category: 'usability',
      icon: <KeyRound className="w-5 h-5 text-teal-400" />,
      title: 'Frictionless 6-Digit PIN & Camera QR Scanner',
      badge: 'No Accounts',
      simpleSummary: 'No login, no email, no app installation. Just enter 6 digits or scan with your camera.',
      details:
        'Temporary 6-digit room coordinates with integrated HTML5 camera QR code scanning and direct auto-pair URLs. Sessions collapse automatically as soon as the transfer finishes.',
    },
    {
      category: 'security',
      icon: <ServerOff className="w-5 h-5 text-teal-400" />,
      title: 'Zero Server Storage, Zero Footprint, Zero Logs',
      badge: 'Zero Footprint',
      simpleSummary: 'Files are never saved to any server hard drive, cloud bucket, or database.',
      details:
        'Active room codes exist strictly in volatile server RAM. No user data, analytics, or files ever touch disk storage. When you close the tab, all session references vanish permanently.',
    },
    {
      category: 'usability',
      icon: <Sparkles className="w-5 h-5 text-teal-400" />,
      title: 'Universal Cross-Platform & Adaptive Theming',
      badge: 'Universal Web',
      simpleSummary: 'Works between any combination of iPhone, Android, Mac, Windows, and Linux.',
      details:
        'Runs directly in modern web browsers (Chrome, Safari, Firefox, Edge, Brave). Features persistent dark/light mode theming with responsive desktop and mobile touch ergonomics.',
    },
  ];

  const filteredFeatures = allFeatures.filter((f) => filter === 'all' || f.category === filter);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        id="features-modal-card"
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-8 shadow-2xl text-neutral-900 dark:text-neutral-100"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-5 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Complete Feature &amp; Architecture Directory</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight font-mono">
              Features in <span className="font-mono lowercase text-teal-600 dark:text-teal-400">void</span>
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
              Direct, encrypted, memory-safe peer-to-peer data transport. Zero storage, zero footprint.
            </p>
          </div>
          <button
            id="close-features-modal-btn"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="Close features modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar & Speed Guide Link */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-5">
          <div className="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-mono">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg cursor-pointer transition-all ${
                filter === 'all'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              All ({allFeatures.length})
            </button>
            <button
              onClick={() => setFilter('security')}
              className={`px-3 py-1 rounded-lg cursor-pointer transition-all ${
                filter === 'security'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Security
            </button>
            <button
              onClick={() => setFilter('performance')}
              className={`px-3 py-1 rounded-lg cursor-pointer transition-all ${
                filter === 'performance'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Performance
            </button>
            <button
              onClick={() => setFilter('usability')}
              className={`px-3 py-1 rounded-lg cursor-pointer transition-all ${
                filter === 'usability'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Usability
            </button>
          </div>

          {onOpenSpeedGuide && (
            <button
              id="features-open-speed-guide-btn"
              onClick={() => {
                onClose();
                onOpenSpeedGuide();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer"
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Open Speed &amp; Network Guide →</span>
            </button>
          )}
        </div>

        {/* Detailed Feature List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {filteredFeatures.map((item, idx) => (
            <div
              key={idx}
              className="p-4 sm:p-5 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800/80 hover:border-teal-500/40 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                    {item.icon}
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold">
                    {item.badge}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 mb-1 font-mono">
                  {item.title}
                </h3>
                <p className="text-xs font-medium text-teal-600 dark:text-teal-400 mb-1.5">
                  {item.simpleSummary}
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {item.details}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Privacy Promise Banner */}
        <div className="mt-6 p-4 rounded-xl bg-teal-500/5 dark:bg-teal-950/20 border border-teal-500/20 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
            <strong className="text-neutral-900 dark:text-white">Our Zero-Knowledge Guarantee: </strong>
            Data streams directly RAM-to-RAM between your device and the recipient. Packets are encrypted with AES-256-GCM before transmission, verified with SHA-256, never stored on any server disk, and automatically expunged from memory on completion.
          </div>
        </div>

        {/* Close Button */}
        <div className="mt-6 flex justify-end">
          <button
            id="dismiss-features-btn"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-mono text-xs font-semibold bg-neutral-900 dark:bg-teal-500 text-white dark:text-neutral-950 hover:bg-neutral-800 dark:hover:bg-teal-400 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
