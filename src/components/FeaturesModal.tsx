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
  Lock, 
  KeyRound, 
  Globe, 
  Radio, 
  Cpu, 
  Play, 
  ClipboardList, 
  Sparkles, 
  Gauge, 
  Users, 
  Files, 
  ShieldAlert,
  Image as ImageIcon,
  Activity,
  Layers,
  Search,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSpeedGuide?: () => void;
}

type FeatureCategory = 'unique' | 'security' | 'network' | 'storage' | 'ux';

interface FeatureItem {
  icon: React.ReactNode;
  title: string;
  badge: string;
  category: FeatureCategory;
  simpleSummary: string;
  details: string;
}

export const FeaturesModal: React.FC<FeaturesModalProps> = ({ 
  isOpen, 
  onClose,
  onOpenSpeedGuide 
}) => {
  const [activeCategory, setActiveCategory] = useState<FeatureCategory>('unique');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const categories: { id: FeatureCategory; label: string; icon: React.ReactNode; count: number }[] = [
    { 
      id: 'unique', 
      label: 'Unique vs Other Apps', 
      icon: <Sparkles className="w-3.5 h-3.5" />,
      count: 5 
    },
    { 
      id: 'security', 
      label: 'Security & Cryptography', 
      icon: <Lock className="w-3.5 h-3.5" />,
      count: 6 
    },
    { 
      id: 'network', 
      label: 'Network & Architecture', 
      icon: <Globe className="w-3.5 h-3.5" />,
      count: 7 
    },
    { 
      id: 'storage', 
      label: 'Storage & File Engine', 
      icon: <HardDrive className="w-3.5 h-3.5" />,
      count: 5 
    },
    { 
      id: 'ux', 
      label: 'Experience & Tools', 
      icon: <Activity className="w-3.5 h-3.5" />,
      count: 6 
    },
  ];

  const allFeatures: FeatureItem[] = [
    // --- 0. UNIQUE VS OTHER APPS ---
    {
      category: 'unique',
      icon: <Sparkles className="w-5 h-5 text-amber-500" />,
      title: 'Universal Freedom (Void vs AirDrop)',
      badge: 'Void vs AirDrop',
      simpleSummary: 'Zero Apple ecosystem lock-in; works across Android, Windows, Mac, Linux, and iOS.',
      details:
        'AirDrop requires Apple-proprietary chips, Bluetooth discovery rituals, and iOS/macOS exclusivity. Void operates seamlessly in any modern web browser across any operating system and adds Person-to-Many broadcast mode for sharing with whole groups at once.',
    },
    {
      category: 'unique',
      icon: <ServerOff className="w-5 h-5 text-rose-500" />,
      title: 'Zero Cloud Storage & 60+ MB/s Line Rate (Void vs WeTransfer)',
      badge: 'Void vs WeTransfer',
      simpleSummary: 'No cloud disk uploads, no waiting twice, 100% ephemeral RAM and direct streaming.',
      details:
        'WeTransfer uploads private files to corporate cloud storage for days, requiring receivers to wait for the entire upload to finish before downloading. Void streams micro-slices directly over local Wi-Fi at up to 60+ MB/s with zero disk writes and zero database logs.',
    },
    {
      category: 'unique',
      icon: <Cpu className="w-5 h-5 text-indigo-500" />,
      title: 'Hardware Workers & Anti-Jitter Engine (Void vs Snapdrop / Sharedrop)',
      badge: 'Void vs Snapdrop',
      simpleSummary: '8-thread parallel Web Worker crypto and unordered SCTP prevent browser freezing and Wi-Fi stalls.',
      details:
        'Standard WebRTC apps use single-threaded JavaScript encryption that stutters the browser UI on heavy files and suffer from Head-of-Line blocking when Wi-Fi drops a single UDP packet. Void parallelizes crypto across 8 hardware threads and runs unordered data channels for stutter-free delivery.',
    },
    {
      category: 'unique',
      icon: <Users className="w-5 h-5 text-teal-500" />,
      title: '1-to-N Broadcast with Zero Sender Re-Upload (Void vs Wormhole)',
      badge: 'Void vs Wormhole',
      simpleSummary: 'Send once to volatile RAM; unlimited peers download without taxing sender upload bandwidth.',
      details:
        'In traditional 1:1 apps, sending to 5 people requires 5 separate uploads that drain your battery and saturate your upload bandwidth. Void\'s Person-to-Many broadcast mode caches encrypted slices in RAM once, allowing unlimited peers to retrieve line-rate without sender slowdown.',
    },
    {
      category: 'unique',
      icon: <Layers className="w-5 h-5 text-emerald-500" />,
      title: 'Batch Multi-File Engine & Archive Packing',
      badge: 'Multi-File Bundling',
      simpleSummary: 'Send dozens of photos, documents, and folders in a single zero-compression unified stream.',
      details:
        'Unlike AirDrop and single-file web utilities that require individual sends or fail on mixed-type batches, Void bundles files into high-speed zero-compression streams with full manifest integrity.',
    },

    // --- 1. SECURITY & CRYPTOGRAPHY ---
    {
      category: 'security',
      icon: <Lock className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'End-to-End Encryption (AES-256-GCM + PBKDF2)',
      badge: 'Military Grade',
      simpleSummary: 'Client-side authenticated encryption locks data before it leaves your browser.',
      details:
        'Derives a 256-bit encryption key from the temporary 6-digit code using PBKDF2 with 100,000 iterations and a cryptographically secure 16-byte salt. Uses unique deterministic 12-byte initialization vectors (IV) for every chunk and 128-bit authentication tags to prevent replay and tampering.',
    },
    {
      category: 'security',
      icon: <Cpu className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Multi-Threaded Hardware Web Crypto Acceleration',
      badge: '8 Parallel Threads',
      simpleSummary: 'Offloads AES-256-GCM encryption across 8 parallel Web Worker hardware threads.',
      details:
        'Distributes cryptographic workloads across CPU cores utilizing native browser hardware AES-NI instructions. Encryption and decryption operate asynchronously ahead of network line rate without blocking the main UI thread.',
    },
    {
      category: 'security',
      icon: <Fingerprint className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Anti-Tamper Cryptographic SHA-256 Verification',
      badge: 'Bit-for-Bit Verified',
      simpleSummary: 'Guarantees the received file matches the original byte-for-byte without corruption.',
      details:
        'Computes cryptographic SHA-256 fingerprints before sending and verifies the entire payload upon reassembly. Any tampering, bit-rot, or packet corruption immediately triggers an integrity breach alert.',
    },
    {
      category: 'security',
      icon: <ShieldAlert className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Enterprise Security Lockout & Modal Feedback',
      badge: 'Dynamic Countdown',
      simpleSummary: 'Eliminates intrusive yellow warning banners; uses professional security dialogs with countdowns.',
      details:
        'Replaces messy inline warning banners with clean, professional modal feedback. Enforces real-time rate limiting, remaining attempt warnings, and an active lockout countdown that automatically unlocks when expired.',
    },
    {
      category: 'security',
      icon: <ServerOff className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Zero Server Storage, Zero Footprint, Zero Logs',
      badge: 'Zero Footprint',
      simpleSummary: 'Files are never saved to any server hard drive, cloud bucket, or database.',
      details:
        'Active room codes exist strictly in volatile server RAM. No user data, analytics, or files ever touch disk storage. When you close the tab, all session references vanish permanently.',
    },
    {
      category: 'security',
      icon: <KeyRound className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Zero-Knowledge 6-Digit Secret Handshake',
      badge: 'No Account Required',
      simpleSummary: 'Room codes double as cryptographic salting seeds with ephemeral 30-minute lifetimes.',
      details:
        'The server only coordinates the initial peer signaling handshake without ever holding the decrypted key. Rooms self-destruct after single-use (in P2P) or when the sender terminates the session.',
    },

    // --- 2. NETWORK & ARCHITECTURE ---
    {
      category: 'network',
      icon: <Radio className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Direct Peer-to-Peer (1:1 WebRTC) Architecture',
      badge: 'Zero Server Relay',
      simpleSummary: 'Transfers directly between sender and recipient at full hardware line speed.',
      details:
        'Establishes an ephemeral direct WebRTC data channel between two browser instances. Data travels device-to-device over your local Wi-Fi without traveling through cloud servers or proxy relays.',
    },
    {
      category: 'network',
      icon: <Users className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Person-to-Many (Broadcast) Distribution',
      badge: 'Zero Sender Lag',
      simpleSummary: 'Send once to RAM, allow N recipients to retrieve concurrently without performance drops.',
      details:
        'In broadcast mode, the sender pre-caches the AES-256 encrypted micro-slices directly into volatile server memory. Any number of recipients can enter the 6-digit code and stream the payload at line rate without taxing the sender device upload bandwidth or causing UI lag.',
    },
    {
      category: 'network',
      icon: <Zap className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'High-Throughput WebRTC SCTP Acceleration',
      badge: 'Up to 60+ MB/s',
      simpleSummary: 'Expanded 9.6 MB in-flight sliding window with an 8 MB backpressure buffer.',
      details:
        'Uses an aggressive 160-chunk in-flight sliding window (~9.6 MB) and monitors the SCTP bufferedAmountLowThreshold (8 MB). Fully saturates gigabit LAN and 5 GHz Wi-Fi connections with zero stop-and-wait delays.',
    },
    {
      category: 'network',
      icon: <Gauge className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Unordered SCTP Streaming (Zero Head-of-Line Blocking)',
      badge: 'Wi-Fi Optimized',
      simpleSummary: 'Eliminates Wi-Fi radio jitter pauses while maintaining 100% reliable delivery.',
      details:
        'Operates data channels with unordered SCTP delivery. If a single UDP packet is delayed by radio interference, subsequent packets continue processing immediately. Chunks are self-indexed and reassembled in memory without stalling.',
    },
    {
      category: 'network',
      icon: <Globe className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Real-Time Network Route Diagnostics',
      badge: 'Smart Route Detection',
      simpleSummary: 'Live inspection of active ICE candidate pairs and router connection paths.',
      details:
        'Detects whether your connection is Direct Local LAN, Internet P2P, or Relay Server. Automatically alerts you if router AP/Client Isolation is forcing your connection over the public internet and guides you to unlock maximum speed.',
    },
    {
      category: 'network',
      icon: <Radio className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Triple-Path Connection & Failover Guarantee',
      badge: '100% Reliable',
      simpleSummary: 'Never gets stuck on "connecting" even behind strict corporate or school firewalls.',
      details:
        'Triple-stage connection fallback hierarchy: Direct WebRTC P2P (host candidates) → STUN NAT Traversal (srflx candidates) → Encrypted WebSocket Socket Pipe relay fallback. If UDP is completely blocked by a firewall, data seamlessly routes over HTTPS/WSS.',
    },
    {
      category: 'network',
      icon: <Activity className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'NAT Traversal & Dynamic STUN/TURN Negotiation',
      badge: 'Firewall Piercing',
      simpleSummary: 'Traverses symmetric NATs, complex subnets, and corporate firewalls automatically.',
      details:
        'Configures multi-origin STUN candidate harvesting with automatic ICE candidate gathering timeout protection, ensuring instant pairing across heterogeneous networks without dropped connections.',
    },

    // --- 3. STORAGE & FILE ENGINE ---
    {
      category: 'storage',
      icon: <CheckCircle2 className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Pre-Flight Payload Verification & File Manifest',
      badge: 'Zero Corruption',
      simpleSummary: 'Inspects payload manifest, mime types, and file sizes before initiating file write.',
      details:
        'Provides bit-for-bit pre-flight payload validation so the receiver inspects exact file counts, byte sizes, and media types before accepting, guaranteeing transparent and predictable transfers.',
    },
    {
      category: 'storage',
      icon: <ImageIcon className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Respective Image & Media Payload Inspection',
      badge: 'Visual Pre-flight',
      simpleSummary: 'Pre-flight checks display file manifests, media types, and exact dimensions.',
      details:
        'Before transmission begins, the receiver inspects exact image metadata, file formats, and byte requirements to ensure clear verification before download.',
    },
    {
      category: 'storage',
      icon: <Files className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Multi-File Batch Transfers & Unified Archive',
      badge: 'Send Multiple at Once',
      simpleSummary: 'Select and transmit multiple documents, images, and videos in a single unified session.',
      details:
        'Queue dozens of files simultaneously. Multi-file batches are packed into a zero-compression high-speed archive with bit-for-bit file manifests. Receivers can download files individually or save the full archive with a single click.',
    },
    {
      category: 'storage',
      icon: <Layers className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Any File Size & Memory-Safe Streaming',
      badge: 'No File Size Limit',
      simpleSummary: 'Transfers 4K movies, heavy ZIPs, and disk images without browser crashes.',
      details:
        'Reads files in continuous 60 KB micro-slices with rolling chunk assembly and zero-copy typed array buffers. Uses minimal RAM overhead regardless of whether the file is 10 MB or 15 GB.',
    },
    {
      category: 'storage',
      icon: <HardDrive className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Direct Stream Disk Saving',
      badge: 'Instant File Write',
      simpleSummary: 'Saves incoming data chunks progressively without freezing browser memory.',
      details:
        'Chunks are collected in binary blobs and dispatched directly to browser download management upon completion, avoiding double-buffering and memory exhaustion on mobile devices.',
    },

    // --- 4. USER EXPERIENCE & TOOLS ---
    {
      category: 'ux',
      icon: <KeyRound className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'QR Code Auto-Retrieval & Mobile Pairing',
      badge: 'Instant Pair & Download',
      simpleSummary: 'Scanning the QR code automatically populates the code and begins file retrieval.',
      details:
        'QR codes encode direct room coordinates. Pointing any mobile camera or scanner at the sender QR code directly connects to the void session and triggers download without requiring manual code typing.',
    },
    {
      category: 'ux',
      icon: <Play className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Zero-Buffering Native Video & Media Player',
      badge: 'Instant Playback',
      simpleSummary: 'Watch transferred MP4, WebM, MOV, and MKV videos directly inside the browser.',
      details:
        'Automatically inspects file magic bytes and MIME containers upon completion. Instantly mounts an in-app HTML5 hardware-accelerated video player allowing you to watch videos immediately without manual disk downloading.',
    },
    {
      category: 'ux',
      icon: <ClipboardList className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Direct Encrypted Text & Clipboard Sync',
      badge: 'Instant Sync',
      simpleSummary: 'Instantly send URLs, passwords, long code snippets, and notes between devices.',
      details:
        'Dedicated text synchronization mode with live character counters, real-time chunk streaming, and one-click copy to clipboard with visual confirmation.',
    },
    {
      category: 'ux',
      icon: <Smartphone className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Screen Wake-Lock & Mobile Sleep Protection',
      badge: 'Background Safe',
      simpleSummary: 'Prevents phones and laptops from going to sleep while transferring large files.',
      details:
        'Integrates the native Screen Wake Lock API to prevent mobile operating systems (iOS and Android) from locking screens or throttling background browser network sockets during transfers.',
    },
    {
      category: 'ux',
      icon: <Activity className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Real-Time Speedometer & Progress Telemetry',
      badge: 'Live Throughput',
      simpleSummary: 'Calculates active MB/s transfer rates, time remaining (ETA), and completion percentages.',
      details:
        'Displays real-time rolling transfer speeds, dynamic chunk progression counters, estimated time remaining, and connection state changes with sub-second accuracy.',
    },
    {
      category: 'ux',
      icon: <Sparkles className="w-5 h-5 text-teal-500 dark:text-teal-400" />,
      title: 'Universal Cross-Platform & Adaptive Theming',
      badge: 'Universal Web',
      simpleSummary: 'Works between any combination of iPhone, Android, Mac, Windows, and Linux.',
      details:
        'Runs directly in modern web browsers (Chrome, Safari, Firefox, Edge, Brave). Features persistent dark/light mode theming with responsive desktop and mobile touch ergonomics.',
    },
  ];

  // Filter features by active category, and optional search query
  const displayedFeatures = allFeatures.filter((feat) => {
    const matchesCategory = feat.category === activeCategory;
    if (!searchQuery.trim()) return matchesCategory;
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      feat.title.toLowerCase().includes(query) ||
      feat.simpleSummary.toLowerCase().includes(query) ||
      feat.details.toLowerCase().includes(query) ||
      feat.badge.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        id="features-modal-card"
        className="relative w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl text-neutral-900 dark:text-neutral-100"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified System Directory &amp; Architecture</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight font-mono">
                System Architecture &amp; Features
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-sans mt-1">
                Explore what makes Void unique vs other apps, plus technical encryption, network routing, and storage specs.
              </p>
            </div>

            <button
              id="close-features-modal-btn"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Categorized Navigation Tabs (Explicit categories, no "All" button) */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-2">
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-neutral-900 dark:bg-teal-500 text-white dark:text-neutral-950 border-neutral-900 dark:border-teal-400 shadow-sm'
                      : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 border-neutral-200/80 dark:border-neutral-700/80 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-neutral-900 dark:hover:text-neutral-200'
                  }`}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive
                      ? 'bg-white/20 dark:bg-black/20 text-white dark:text-neutral-950 font-bold'
                      : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search bar inside header */}
          <div className="relative mt-3">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Filter in ${categories.find(c => c.id === activeCategory)?.label}...`}
              className="w-full pl-8 pr-3 py-1.5 text-xs font-mono rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-teal-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xs font-mono"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Speed Guide Direct Shortcut */}
          {activeCategory === 'network' && onOpenSpeedGuide && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-mono text-amber-700 dark:text-amber-400">
                <Gauge className="w-4 h-4 shrink-0 text-amber-500" />
                <span>Want maximum local Wi-Fi speeds (60+ MB/s)? Read our Network Route &amp; Speed Guide.</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenSpeedGuide();
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-neutral-950 font-mono text-xs font-bold hover:bg-amber-400 transition-colors cursor-pointer shrink-0"
              >
                Open Guide →
              </button>
            </div>
          )}

          {/* Unique Highlights Banner when on "unique" tab */}
          {activeCategory === 'unique' && (
            <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs font-mono text-teal-800 dark:text-teal-300 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
              <span>Direct architectural advantages of Void over AirDrop, WeTransfer, Snapdrop, and traditional cloud drives.</span>
            </div>
          )}

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {displayedFeatures.map((feat, idx) => (
                <motion.div
                  key={`${feat.category}-${feat.title}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.15, delay: idx * 0.03 }}
                  className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/40 hover:border-teal-500/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                        {feat.icon}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold">
                        {feat.badge}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold font-mono text-neutral-900 dark:text-white">
                      {feat.title}
                    </h3>
                    <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 mt-1 font-sans">
                      {feat.simpleSummary}
                    </p>
                    <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-2 leading-relaxed font-sans">
                      {feat.details}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {displayedFeatures.length === 0 && (
            <div className="p-8 text-center font-mono text-xs text-neutral-400">
              No features found matching "{searchQuery}" in this category.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950 shrink-0">
          <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>29 Verified Architectural Capabilities • {categories.find(c => c.id === activeCategory)?.label}</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl font-mono text-xs font-bold bg-neutral-900 dark:bg-teal-500 text-white dark:text-neutral-950 hover:bg-neutral-800 dark:hover:bg-teal-400 transition-colors cursor-pointer"
          >
            Close Directory
          </button>
        </div>
      </motion.div>
    </div>
  );
};
