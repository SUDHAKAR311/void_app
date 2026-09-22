/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Gauge,
  Zap,
  Wifi,
  Radio,
  ArrowUpRight,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Laptop,
  Smartphone,
  Server,
  Share2,
  SlidersHorizontal,
  Layers,
  Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SpeedGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SpeedGuideModal: React.FC<SpeedGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'how-it-works' | 'why-slow' | 'benchmarks' | 'improve-speed'>('how-it-works');

  if (!isOpen) return null;

  const networkBenchmarks = [
    {
      network: 'Direct Gigabit Ethernet / Fiber LAN',
      icon: <Layers className="w-4 h-4 text-emerald-500" />,
      theoretical: '125 MB/s (1000 Mbps)',
      realWorld: '90 – 115 MB/s',
      timeFor1_5GB: '~14 seconds',
      badge: 'Fastest',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      description: 'Direct wired local connection between PCs/Macs through a gigabit switch or router.',
    },
    {
      network: 'Wi-Fi 6 (802.11ax) Local LAN',
      icon: <Wifi className="w-4 h-4 text-teal-500" />,
      theoretical: '100+ MB/s',
      realWorld: '60 – 90+ MB/s',
      timeFor1_5GB: '~20 seconds',
      badge: 'Ultra Fast',
      badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
      description: 'Modern Wi-Fi 6 routers on 160MHz channels with AP Isolation turned OFF.',
    },
    {
      network: '5 GHz Wi-Fi (802.11ac) Local LAN',
      icon: <Wifi className="w-4 h-4 text-sky-500" />,
      theoretical: '50 – 70 MB/s',
      realWorld: '35 – 65 MB/s',
      timeFor1_5GB: '~30 – 45 seconds',
      badge: 'Recommended',
      badgeColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      description: 'Standard 5 GHz home Wi-Fi band when both devices communicate directly without leaving the house.',
    },
    {
      network: 'Direct Mobile Hotspot (P2P Wi-Fi)',
      icon: <Smartphone className="w-4 h-4 text-purple-500" />,
      theoretical: '40 – 80 MB/s',
      realWorld: '30 – 60 MB/s',
      timeFor1_5GB: '~35 – 50 seconds',
      badge: 'Zero Config',
      badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      description: 'One phone turns on Hotspot, other device connects directly. No home router isolation issues.',
    },
    {
      network: 'Symmetrical Fiber Internet (Over WAN)',
      icon: <ArrowUpRight className="w-4 h-4 text-blue-500" />,
      theoretical: '125 MB/s',
      realWorld: '30 – 70 MB/s',
      timeFor1_5GB: '~30 – 50 seconds',
      badge: 'High-End Internet',
      badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      description: 'When both sender & receiver have dedicated fiber internet with equal high upload & download speeds.',
    },
    {
      network: 'Standard Home Broadband (Cable / DSL / Asymmetric)',
      icon: <Radio className="w-4 h-4 text-amber-500" />,
      theoretical: 'ISP Upload Cap',
      realWorld: '1.5 – 3.5 MB/s (10–25 Mbps upload)',
      timeFor1_5GB: '~8 – 12 minutes',
      badge: 'Upload Bounded',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      description: 'Most consumer plans offer 100–300 Mbps download, but cap upload at only 20 Mbps (2.5 MB/s max).',
    },
    {
      network: '4G LTE / 5G Mobile Data',
      icon: <Radio className="w-4 h-4 text-orange-500" />,
      theoretical: '10 – 30 MB/s',
      realWorld: '2.0 – 12 MB/s',
      timeFor1_5GB: '~3 – 10 minutes',
      badge: 'Cellular Variable',
      badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
      description: 'Dependent on mobile tower distance and cellular carrier upstream congestion.',
    },
    {
      network: 'Encrypted WebSocket Relay Fallback',
      icon: <Server className="w-4 h-4 text-rose-500" />,
      theoretical: '25 MB/s',
      realWorld: '5 – 15 MB/s',
      timeFor1_5GB: '~2 – 4 minutes',
      badge: 'Firewall Fallback',
      badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      description: 'Used only when aggressive corporate or university firewalls strictly block all direct UDP/WebRTC traffic.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        id="speed-guide-modal-card"
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-8 shadow-2xl text-neutral-900 dark:text-neutral-100"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-5 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-2">
              <Gauge className="w-3.5 h-3.5" />
              <span>Speed &amp; Network Architecture Guide</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight font-mono">
              How Transfer Speed Works
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
              The physics, bottlenecks, and techniques to get maximum transfer throughput.
            </p>
          </div>
          <button
            id="close-speed-guide-btn"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="Close speed guide modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-5 p-1 bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-x-auto text-xs font-mono">
          <button
            onClick={() => setActiveTab('how-it-works')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer font-medium ${
              activeTab === 'how-it-works'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            1. The Direct Pipe
          </button>
          <button
            onClick={() => setActiveTab('why-slow')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer font-medium ${
              activeTab === 'why-slow'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            2. Why It Can Be Slow
          </button>
          <button
            onClick={() => setActiveTab('benchmarks')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer font-medium ${
              activeTab === 'benchmarks'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            3. Network Speeds
          </button>
          <button
            onClick={() => setActiveTab('improve-speed')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer font-medium ${
              activeTab === 'improve-speed'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            4. Maximize Speed
          </button>
        </div>

        {/* Tab Contents */}
        <div className="mt-6 text-neutral-700 dark:text-neutral-300 text-xs sm:text-sm leading-relaxed space-y-5">
          {activeTab === 'how-it-works' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800">
                <h3 className="text-base font-bold font-mono text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-teal-500" />
                  What is a Direct P2P Transfer?
                </h3>
                <p>
                  Unlike cloud services (Google Drive, Dropbox, WeTransfer) where you first upload a file to a remote server and then the other person downloads it, <strong>void streams data in real time directly from device to device</strong>.
                </p>
                <div className="mt-4 p-3 rounded-lg bg-neutral-100 dark:bg-neutral-900 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
                    <span className="text-teal-600 dark:text-teal-400 font-bold">[Sender Device]</span>
                    <span>→ (AES-256 Encrypt) →</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">[Direct Network Wire / Wi-Fi]</span>
                    <span>→ (AES-256 Decrypt) →</span>
                    <span className="text-teal-600 dark:text-teal-400 font-bold">[Receiver Device]</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800">
                <h3 className="text-base font-bold font-mono text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-500" />
                  The Single-Pipe Principle
                </h3>
                <p>
                  Because it is a direct line, transfer speed is <strong>strictly governed by the single slowest link between both devices</strong>.
                </p>
                <p className="mt-2">
                  Even if the receiver has a superfast <strong>1,000 Mbps download connection</strong>, if the sender's network only uploads at <strong>20 Mbps</strong>, the transfer can never exceed <strong>2.5 MB/s</strong> (20 Mbps ÷ 8 bits = 2.5 MB/s). Data cannot arrive faster than the sender can push it out onto the wire.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-teal-500/5 dark:bg-teal-950/20 border border-teal-500/20 text-teal-800 dark:text-teal-300">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-neutral-900 dark:text-white">The Software Speed Guarantee: </strong>
                    Void's transfer engine runs 8 parallel hardware encryption threads, zero-copy memory arrays, an 8MB buffer, and an unordered SCTP pipeline. <strong>The app's software is completely unthrottled and will instantly saturate 100% of the available network bandwidth.</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'why-slow' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20">
                <h3 className="text-base font-bold font-mono text-neutral-900 dark:text-white mb-2 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Why Your Transfer Might Be Capped at ~2.5 MB/s
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300">
                  If you transfer a 1.5 GB file and notice it takes around 10 minutes (running at roughly 2.5 MB/s), here are the exact technical reasons why:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800">
                  <h4 className="font-bold text-neutral-900 dark:text-white mb-1.5 flex items-center gap-1.5 font-mono">
                    <Radio className="w-3.5 h-3.5 text-rose-500" />
                    1. Router "AP / Client Isolation"
                  </h4>
                  <p className="text-neutral-600 dark:text-neutral-400 text-xs">
                    Even when both devices are in the same room on the same Wi-Fi, many consumer routers block devices from talking directly to each other. When blocked, the transfer is forced onto the public internet (WAN), subjecting local transfers to slow ISP upload caps.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800">
                  <h4 className="font-bold text-neutral-900 dark:text-white mb-1.5 flex items-center gap-1.5 font-mono">
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
                    2. ISP Asymmetric Upload Limits
                  </h4>
                  <p className="text-neutral-600 dark:text-neutral-400 text-xs">
                    Most home internet service providers (ISPs) advertise high download speeds (e.g. 200–300 Mbps) but quietly cap upload bandwidth at <strong>20 to 25 Mbps</strong>. In bytes, 20 Mbps equals exactly <strong>2.5 MB/s</strong>.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800">
                  <h4 className="font-bold text-neutral-900 dark:text-white mb-1.5 flex items-center gap-1.5 font-mono">
                    <Wifi className="w-3.5 h-3.5 text-orange-500" />
                    3. 2.4 GHz Wi-Fi Congestion
                  </h4>
                  <p className="text-neutral-600 dark:text-neutral-400 text-xs">
                    2.4 GHz Wi-Fi shares frequencies with Bluetooth, microwave ovens, and neighboring apartments. Real-world 2.4 GHz throughput rarely exceeds 4–5 MB/s even under ideal conditions.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800">
                  <h4 className="font-bold text-neutral-900 dark:text-white mb-1.5 flex items-center gap-1.5 font-mono">
                    <Smartphone className="w-3.5 h-3.5 text-purple-500" />
                    4. Mobile OS Background Throttling
                  </h4>
                  <p className="text-neutral-600 dark:text-neutral-400 text-xs">
                    If your phone screen locks or you switch to another app (Instagram, WhatsApp), iOS and Android put browser background sockets to sleep, dropping transfer speed to near zero.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'benchmarks' && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-neutral-600 dark:text-neutral-400 text-xs">
                Theoretical vs realistic transfer speeds across different network setups using Void's WebRTC engine:
              </p>

              <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                {networkBenchmarks.map((bench, idx) => (
                  <div key={idx} className="p-3.5 sm:p-4 bg-neutral-50/50 dark:bg-neutral-950/50 hover:bg-neutral-100/50 dark:hover:bg-neutral-900/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {bench.icon}
                        <h4 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white font-mono">
                          {bench.network}
                        </h4>
                      </div>
                      <span className={`self-start sm:self-auto text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${bench.badgeColor}`}>
                        {bench.badge}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 pt-2 border-t border-neutral-200/50 dark:border-neutral-800/50 font-mono text-[11px]">
                      <div>
                        <span className="text-neutral-400 block text-[10px]">Real-World Speed:</span>
                        <span className="font-bold text-teal-600 dark:text-teal-400">{bench.realWorld}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[10px]">Time for 1.5 GB File:</span>
                        <span className="font-bold text-neutral-900 dark:text-white">{bench.timeFor1_5GB}</span>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-neutral-400 block text-[10px]">Theoretical Max:</span>
                        <span className="text-neutral-500 dark:text-neutral-400">{bench.theoretical}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2">
                      {bench.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'improve-speed' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-xl bg-teal-500/5 dark:bg-teal-950/20 border border-teal-500/20">
                <h3 className="text-base font-bold font-mono text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-teal-500" />
                  Actionable Steps to Get 30–60+ MB/s Right Now
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
                  Follow these simple setup tips to unlock maximum local transmission rates:
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 font-mono font-bold flex items-center justify-center shrink-0 text-xs border border-teal-500/20">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-900 dark:text-white text-xs sm:text-sm font-mono">
                      Use Mobile Hotspot Mode (Zero Router Isolation)
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                      If transferring between a phone and a laptop or two phones: turn on the <strong>Portable Wi-Fi Hotspot</strong> on one device and connect the other device to it. This creates a direct 5 GHz wireless link that completely bypasses home routers and firewalls, achieving <strong>30 to 60+ MB/s</strong>.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 font-mono font-bold flex items-center justify-center shrink-0 text-xs border border-teal-500/20">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-900 dark:text-white text-xs sm:text-sm font-mono">
                      Disable "AP / Client Isolation" in Your Wi-Fi Router
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                      Log in to your home Wi-Fi router settings (usually <code className="bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded text-[11px]">192.168.1.1</code>) and toggle OFF <strong>"AP Isolation"</strong>, <strong>"Client Isolation"</strong>, or <strong>"Station Separation"</strong>. Ensure neither device is on a "Guest Network". This allows direct LAN transfers at full Wi-Fi speeds.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 font-mono font-bold flex items-center justify-center shrink-0 text-xs border border-teal-500/20">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-900 dark:text-white text-xs sm:text-sm font-mono">
                      Connect Both Devices to 5 GHz (Not 2.4 GHz)
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                      Select your router's <code className="bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded text-[11px]">_5G</code> SSID on both devices. 5 GHz provides over 5x higher real-world bandwidth than 2.4 GHz with near-zero appliance interference.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 font-mono font-bold flex items-center justify-center shrink-0 text-xs border border-teal-500/20">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-900 dark:text-white text-xs sm:text-sm font-mono">
                      Keep the Screen On and Browser Tab Visible
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                      Void automatically engages the <strong>Screen Wake-Lock API</strong> to stop devices from sleeping. On smartphones, do not switch to other apps during large transfers so the mobile operating system gives 100% CPU priority to the browser.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Engine: WebRTC SCTP (Unordered + 9.6MB Window)</span>
          </div>
          <button
            id="dismiss-speed-guide-btn"
            onClick={onClose}
            className="px-5 py-2 rounded-xl font-mono text-xs font-semibold bg-neutral-900 dark:bg-amber-500 text-white dark:text-neutral-950 hover:bg-neutral-800 dark:hover:bg-amber-400 transition-colors cursor-pointer"
          >
            Got It
          </button>
        </div>
      </motion.div>
    </div>
  );
};
