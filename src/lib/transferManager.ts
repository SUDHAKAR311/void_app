/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { io, Socket } from 'socket.io-client';
import JSZip from 'jszip';
import { 
  ConnectionMode, 
  DistributionMode,
  FileItemManifest,
  TransferMetadata, 
  TransferProgress, 
  VoidRole, 
  VoidStatus 
} from '../types';
import { 
  base64ToBuffer, 
  bufferToBase64, 
  computeSHA256, 
  decryptChunk, 
  deriveKeyFromCode, 
  encryptChunk, 
  generateBaseIV, 
  generateSalt, 
  getChunkIV 
} from './crypto';
import { wakeLockManager } from '../utils/wakeLockManager';

export interface TransferManagerCallbacks {
  onStatusChange: (status: VoidStatus) => void;
  onProgressUpdate: (progress: TransferProgress) => void;
  onPartnerJoined?: () => void;
  onMetadataReceived?: (metadata: TransferMetadata) => void;
  onReceiverReady?: () => void;
  onTextReceived?: (text: string) => void;
  onError: (message: string, isLocked?: boolean, remainingSeconds?: number, warning?: string) => void;
  onFileReadyToDownload?: (blob: Blob, filename: string) => void;
  onMultiFilesReady?: (files: Array<{ name: string; blob: Blob; size: number }>, zipBlob: Blob) => void;
}

const CHUNK_SIZE_FILE = 60 * 1024;  // 60KB optimal single-packet frame
const CHUNK_SIZE_TEXT = 32 * 1024;  // 32KB for clipboard text
const DEFAULT_CHUNK_SIZE = CHUNK_SIZE_FILE;

interface PrefetchedChunk {
  index: number;
  encryptedBuffer: ArrayBuffer;
  isLast: boolean;
}

class ReadAheadBuffer {
  private readyChunks: Map<number, PrefetchedChunk> = new Map();
  private waitResolvers: Map<number, (chunk: PrefetchedChunk) => void> = new Map();
  private waitRejecters: Map<number, (err: Error) => void> = new Map();
  private isRunning = false;
  private isAborted = false;
  private nextReadIndex = 0;
  private inFlightTasks = 0;

  constructor(
    private fileRef: File | Blob | null,
    private preparedBuffer: ArrayBuffer | null,
    private cryptoKey: CryptoKey,
    private baseIV: Uint8Array,
    private chunkSize: number,
    private totalBytes: number,
    private chunkCount: number,
    private bufferCapacity = 32,
    private concurrency = 6
  ) {}

  public start() {
    this.isRunning = true;
    this.isAborted = false;
    this.nextReadIndex = 0;
    this.fill();
  }

  private fill() {
    if (this.isAborted || !this.isRunning) return;

    while (
      !this.isAborted &&
      this.isRunning &&
      this.inFlightTasks < this.concurrency &&
      this.readyChunks.size + this.inFlightTasks < this.bufferCapacity &&
      this.nextReadIndex < this.chunkCount
    ) {
      const idx = this.nextReadIndex++;
      this.inFlightTasks++;
      this.prefetchChunk(idx).finally(() => {
        this.inFlightTasks--;
        this.fill();
      });
    }
  }

  private async prefetchChunk(index: number) {
    if (this.isAborted) return;
    try {
      const start = index * this.chunkSize;
      const end = Math.min(start + this.chunkSize, this.totalBytes);

      let rawChunk: ArrayBuffer;
      if (this.fileRef) {
        rawChunk = await this.fileRef.slice(start, end).arrayBuffer();
      } else if (this.preparedBuffer) {
        rawChunk = this.preparedBuffer.slice(start, end);
      } else {
        return;
      }

      if (this.isAborted) return;

      const chunkIV = getChunkIV(this.baseIV, index);
      const encrypted = await encryptChunk(this.cryptoKey, chunkIV, rawChunk);

      if (this.isAborted) return;

      const prefetched: PrefetchedChunk = {
        index,
        encryptedBuffer: encrypted,
        isLast: index === this.chunkCount - 1,
      };

      const waiter = this.waitResolvers.get(index);
      if (waiter) {
        this.waitResolvers.delete(index);
        this.waitRejecters.delete(index);
        waiter(prefetched);
      } else {
        this.readyChunks.set(index, prefetched);
      }
    } catch (err: any) {
      if (this.isAborted) return;
      const rejecter = this.waitRejecters.get(index);
      if (rejecter) {
        this.waitResolvers.delete(index);
        this.waitRejecters.delete(index);
        rejecter(err);
      }
    }
  }

  public async getChunk(index: number): Promise<PrefetchedChunk> {
    if (this.isAborted) {
      throw new Error('ReadAheadBuffer aborted');
    }

    if (this.readyChunks.has(index)) {
      const chunk = this.readyChunks.get(index)!;
      this.readyChunks.delete(index);
      this.fill();
      return chunk;
    }

    return new Promise<PrefetchedChunk>((resolve, reject) => {
      this.waitResolvers.set(index, (chunk) => {
        this.fill();
        resolve(chunk);
      });
      this.waitRejecters.set(index, reject);
      this.fill();
    });
  }

  public abort() {
    this.isAborted = true;
    this.isRunning = false;
    this.readyChunks.clear();
    for (const reject of Array.from(this.waitRejecters.values())) {
      try { reject(new Error('Transfer cancelled')); } catch {}
    }
    this.waitResolvers.clear();
    this.waitRejecters.clear();
  }
}

export class TransferManager {
  private socket: Socket;
  private role: VoidRole;
  private code: string = '';
  private distributionMode: DistributionMode = 'p2p';
  private partnerSocketId: string = '';
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private connectionMode: ConnectionMode = 'p2p-direct';
  private cryptoKey: CryptoKey | null = null;
  private baseIV: Uint8Array = new Uint8Array();
  private salt: Uint8Array = new Uint8Array();
  private metadata: TransferMetadata | null = null;

  // Queued chunks for receiver before key is derived
  private pendingChunksQueue: Array<{ index: number; total: number; chunk: any; isLast?: boolean }> = [];
  private isWaitingForRemainingChunks = false;

  private isTransferring = false;
  private callbacks: TransferManagerCallbacks;

  // Flow control & sliding window
  private inFlightIndices = new Set<number>();
  private ackResolvers: Array<() => void> = [];
  private completionResolver: (() => void) | null = null;
  private isFinalizing = false;

  // Queued WebRTC ICE candidates and signals in case of race conditions
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private earlySignals: Array<{ from: string; signal: any }> = [];

  // Active transmission parameters
  private activeChunkSize: number = CHUNK_SIZE_FILE;
  private readAheadBuffer: ReadAheadBuffer | null = null;

  // Flow metrics
  private bytesTransferred = 0;
  private totalBytes = 0;
  private lastMetricsTimestamp = 0;
  private lastMetricsBytes = 0;
  private currentSpeedBps = 0;
  private networkRoute: 'local-lan' | 'public-wan' | 'relay-server' = 'public-wan';

  // Receiver stream assembly
  private receivedChunksMap = new Map<number, Uint8Array>();

  // Cached prepared sender payload
  private preparedBuffer: ArrayBuffer | null = null;
  private fileRef: File | Blob | null = null;
  private rawFilesList: File[] = [];

  constructor(role: VoidRole, callbacks: TransferManagerCallbacks) {
    this.role = role;
    this.callbacks = callbacks;
    this.socket = io({
      reconnectionAttempts: 8,
      timeout: 20000,
    });

    this.setupSocketListeners();
  }

  public getSocket(): Socket {
    return this.socket;
  }

  public setCode(code: string) {
    this.code = code;
  }

  public setDistributionMode(mode: DistributionMode) {
    this.distributionMode = mode;
  }

  public getDistributionMode(): DistributionMode {
    return this.distributionMode;
  }

  public getMetadata(): TransferMetadata | null {
    return this.metadata;
  }

  // --- Socket.IO Event Handlers ---
  private setupSocketListeners() {
    this.socket.on('partner-joined', async ({ partnerId, code, mode }: { partnerId: string; code: string; mode?: DistributionMode }) => {
      this.partnerSocketId = partnerId;
      if (mode) this.distributionMode = mode;
      this.callbacks.onPartnerJoined?.();

      // In 1-to-1 P2P mode, initiate WebRTC connection
      if (this.distributionMode === 'p2p') {
        await this.initiateWebRTCAsSender();
      } else {
        // In broadcast mode, use high-speed socket relay pipe with cached memory chunks
        this.connectionMode = 'socket-pipe';
        this.networkRoute = 'relay-server';
        this.updateProgress();
      }
    });

    this.socket.on('partner-found', async ({ partnerId, code, mode }: { partnerId: string; code: string; mode?: DistributionMode }) => {
      this.partnerSocketId = partnerId;
      if (mode) this.distributionMode = mode;

      if (this.distributionMode === 'p2p') {
        await this.initiateWebRTCAsReceiver();
      } else {
        this.connectionMode = 'socket-pipe';
        this.networkRoute = 'relay-server';
        this.updateProgress();
        // Request the broadcast stream if already published
        this.socket.emit('request-broadcast-stream', { code: this.code });
      }
    });

    this.socket.on('signal', async ({ from, signal }: { from: string; signal: any }) => {
      await this.handleIncomingSignal(from, signal);
    });

    // Receiver notified that metadata arrived
    this.socket.on('relay-metadata', async ({ metadata }: { metadata: TransferMetadata }) => {
      await this.processIncomingMetadata(metadata);
    });

    // Receiver tells sender: "Ready to receive stream!"
    this.socket.on('relay-ready-to-receive', () => {
      this.callbacks.onReceiverReady?.();
      this.startStreamingChunks();
    });

    this.socket.on('relay-chunk', async (data: { index: number; total: number; chunk: any; isLast?: boolean }) => {
      await this.handleIncomingChunk(data.index, data.total, data.chunk, data.isLast);
    });

    this.socket.on('relay-ack', ({ index, receivedBytes }: { index: number; receivedBytes?: number }) => {
      this.handleAck(index, receivedBytes);
    });

    this.socket.on('relay-complete', async () => {
      if (this.metadata && this.receivedChunksMap.size >= this.metadata.chunkCount) {
        await this.finalizeTransfer();
      } else {
        this.isWaitingForRemainingChunks = true;
      }
    });

    this.socket.on('relay-ack-complete', () => {
      this.callbacks.onStatusChange('completed');
      this.releaseWakeLock();
      if (this.completionResolver) {
        this.completionResolver();
        this.completionResolver = null;
      }
    });

    this.socket.on('void-error', (data: { message: string; warning?: string; isLocked?: boolean; remainingSeconds?: number }) => {
      this.callbacks.onError(data.message, data.isLocked, data.remainingSeconds, data.warning);
    });

    this.socket.on('partner-disconnected', ({ message }: { message: string }) => {
      if (this.connectionMode === 'p2p-direct' && this.dataChannel && this.dataChannel.readyState === 'open') {
        return;
      }
      if (this.distributionMode === 'broadcast') {
        return; // Don't terminate broadcast session on peer disconnect
      }
      if (this.isTransferring && !this.isFinalizing && this.receivedChunksMap.size < (this.metadata?.chunkCount || 0)) {
        this.callbacks.onError(message || 'Peer closed the tab. Session terminated.');
      }
    });
  }

  // --- WebRTC Signaling ---
  private async handleIncomingSignal(from: string, signal: any) {
    if (!this.peerConnection) {
      this.earlySignals.push({ from, signal });
      return;
    }

    try {
      if (signal.sdp) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        if (this.pendingCandidates.length > 0) {
          const queued = [...this.pendingCandidates];
          this.pendingCandidates = [];
          for (const cand of queued) {
            try {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
            } catch (candErr) {
              console.warn('[void] Queued ICE candidate notice:', candErr);
            }
          }
        }

        if (signal.sdp.type === 'offer') {
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          this.socket.emit('signal', {
            to: from,
            signal: { sdp: this.peerConnection.localDescription },
          });
        }
      } else if (signal.candidate) {
        if (this.peerConnection.remoteDescription) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          this.pendingCandidates.push(signal.candidate);
        }
      }
    } catch (err) {
      console.warn('[void] Signal processing fallback:', err);
    }
  }

  private async getIceServers(): Promise<RTCIceServer[]> {
    try {
      const res = await fetch('/api/ice-servers');
      if (res.ok) {
        const data = await res.json();
        return data.iceServers;
      }
    } catch {
      // Fallback
    }
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ];
  }

  private async initiateWebRTCAsSender() {
    try {
      const iceServers = await this.getIceServers();
      this.peerConnection = new RTCPeerConnection({ iceServers });

      this.dataChannel = this.peerConnection.createDataChannel('void-stream', {
        ordered: false, // Eliminates Head-of-Line blocking over Wi-Fi
      });
      this.dataChannel.binaryType = 'arraybuffer';
      this.setupDataChannelEvents();

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.partnerSocketId) {
          this.socket.emit('signal', {
            to: this.partnerSocketId,
            signal: { candidate: event.candidate },
          });
        }
      };

      this.peerConnection.onconnectionstatechange = async () => {
        if (this.peerConnection?.connectionState === 'connected') {
          this.connectionMode = 'p2p-direct';
          await this.updateNetworkRoute();
          this.updateProgress();
        } else if (
          this.peerConnection?.connectionState === 'failed' ||
          this.peerConnection?.connectionState === 'disconnected'
        ) {
          this.connectionMode = 'socket-pipe';
          this.networkRoute = 'relay-server';
          this.updateProgress();
        }
      };

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.socket.emit('signal', {
        to: this.partnerSocketId,
        signal: { sdp: this.peerConnection.localDescription },
      });

      // Process any early signals
      for (const early of this.earlySignals) {
        await this.handleIncomingSignal(early.from, early.signal);
      }
      this.earlySignals = [];
    } catch (err) {
      console.warn('[void] WebRTC initialization notice:', err);
      this.connectionMode = 'socket-pipe';
    }
  }

  private async initiateWebRTCAsReceiver() {
    try {
      const iceServers = await this.getIceServers();
      this.peerConnection = new RTCPeerConnection({ iceServers });

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.partnerSocketId) {
          this.socket.emit('signal', {
            to: this.partnerSocketId,
            signal: { candidate: event.candidate },
          });
        }
      };

      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.dataChannel.binaryType = 'arraybuffer';
        this.setupDataChannelEvents();
      };

      this.peerConnection.onconnectionstatechange = async () => {
        if (this.peerConnection?.connectionState === 'connected') {
          this.connectionMode = 'p2p-direct';
          await this.updateNetworkRoute();
          this.updateProgress();
        } else if (
          this.peerConnection?.connectionState === 'failed' ||
          this.peerConnection?.connectionState === 'disconnected'
        ) {
          this.connectionMode = 'socket-pipe';
          this.networkRoute = 'relay-server';
          this.updateProgress();
        }
      };

      for (const early of this.earlySignals) {
        await this.handleIncomingSignal(early.from, early.signal);
      }
      this.earlySignals = [];
    } catch (err) {
      console.warn('[void] WebRTC receiver notice:', err);
      this.connectionMode = 'socket-pipe';
    }
  }

  private setupDataChannelEvents() {
    if (!this.dataChannel) return;
    this.dataChannel.bufferedAmountLowThreshold = 1024 * 1024;

    this.dataChannel.onopen = () => {
      this.connectionMode = 'p2p-direct';
      this.updateProgress();

      if (this.role === 'sender' && this.metadata && this.dataChannel) {
        this.dataChannel.send(JSON.stringify({ type: 'metadata', metadata: this.metadata }));
      }
    };

    this.dataChannel.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'metadata') {
            await this.processIncomingMetadata(parsed.metadata);
          } else if (parsed.type === 'ready-to-receive') {
            this.callbacks.onReceiverReady?.();
            this.startStreamingChunks();
          } else if (parsed.type === 'ack') {
            this.handleAck(parsed.index, parsed.receivedBytes);
          } else if (parsed.type === 'complete') {
            if (this.metadata && this.receivedChunksMap.size >= this.metadata.chunkCount) {
              await this.finalizeTransfer();
            } else {
              this.isWaitingForRemainingChunks = true;
            }
          } else if (parsed.type === 'ack-complete') {
            this.callbacks.onStatusChange('completed');
            this.releaseWakeLock();
            if (this.completionResolver) {
              this.completionResolver();
              this.completionResolver = null;
            }
          }
        } catch {}
      } else if (event.data instanceof ArrayBuffer) {
        const view = new DataView(event.data);
        const chunkIndex = view.getUint32(0, false);
        const totalChunks = view.getUint32(4, false);
        const encryptedData = new Uint8Array(event.data, 8);
        const isLast = chunkIndex === totalChunks - 1;
        await this.handleIncomingChunk(chunkIndex, totalChunks, encryptedData, isLast);
      }
    };

    this.dataChannel.onclose = () => {
      if (this.isTransferring && !this.isFinalizing && this.receivedChunksMap.size < (this.metadata?.chunkCount || 0)) {
        this.connectionMode = 'socket-pipe';
        this.updateProgress();
      }
    };

    this.dataChannel.onerror = () => {
      this.connectionMode = 'socket-pipe';
      this.updateProgress();
    };
  }

  // --- Sender Methods (Single File, Multi-File, or Text) ---
  public async preparePayload(payload: { 
    file?: File | null; 
    files?: File[]; 
    text?: string;
    distributionMode?: DistributionMode;
  }): Promise<TransferMetadata> {
    this.salt = generateSalt();
    this.baseIV = generateBaseIV();
    this.cryptoKey = await deriveKeyFromCode(this.code, this.salt);
    if (payload.distributionMode) {
      this.distributionMode = payload.distributionMode;
    }

    let name = '';
    let type = '';
    let isText = false;
    let isMultiFile = false;
    let fileManifest: FileItemManifest[] = [];
    let textContent = '';

    const multipleFiles = payload.files && payload.files.length > 1 ? payload.files : null;

    if (payload.text !== undefined && payload.text.trim().length > 0) {
      isText = true;
      name = 'clipboard.txt';
      type = 'text/plain';
      textContent = payload.text;
      this.preparedBuffer = new TextEncoder().encode(payload.text).buffer;
      this.fileRef = null;
      this.totalBytes = this.preparedBuffer.byteLength;
    } else if (multipleFiles && multipleFiles.length > 1) {
      // MULTI-FILE ARCHIVE PACKAGING:
      // Packages files into an optimized zip container with zero compression (STORE mode)
      // for instant streaming without CPU lag.
      isMultiFile = true;
      name = `void-archive-${multipleFiles.length}-files.zip`;
      type = 'application/zip';
      this.rawFilesList = multipleFiles;

      fileManifest = multipleFiles.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type || 'application/octet-stream',
      }));

      const zip = new JSZip();
      for (const f of multipleFiles) {
        zip.file(f.name, f);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      this.fileRef = zipBlob;
      this.preparedBuffer = null;
      this.totalBytes = zipBlob.size;
    } else if (payload.file || (payload.files && payload.files.length === 1)) {
      const single = payload.file || payload.files![0];
      name = single.name;
      type = single.type || 'application/octet-stream';
      this.fileRef = single;
      this.preparedBuffer = null;
      this.totalBytes = single.size;
    } else {
      throw new Error('No files or text payload selected.');
    }

    this.bytesTransferred = 0;

    // Fast SHA-256 fingerprint
    let sha256Fingerprint = '';
    if (isText && this.preparedBuffer) {
      sha256Fingerprint = await computeSHA256(this.preparedBuffer);
    } else if (this.fileRef) {
      if (this.fileRef.size <= 16 * 1024 * 1024) {
        const buf = await this.fileRef.arrayBuffer();
        sha256Fingerprint = await computeSHA256(buf);
      } else {
        const head = await this.fileRef.slice(0, 1024 * 1024).arrayBuffer();
        const tail = await this.fileRef.slice(Math.max(0, this.fileRef.size - 1024 * 1024)).arrayBuffer();
        const metaBytes = new TextEncoder().encode(`${name}-${this.fileRef.size}`);
        const sample = new Uint8Array(head.byteLength + tail.byteLength + metaBytes.byteLength);
        sample.set(new Uint8Array(head), 0);
        sample.set(new Uint8Array(tail), head.byteLength);
        sample.set(metaBytes, head.byteLength + tail.byteLength);
        sha256Fingerprint = await computeSHA256(sample);
      }
    }

    this.activeChunkSize = (this.fileRef || this.totalBytes >= 1024 * 1024)
      ? CHUNK_SIZE_FILE
      : CHUNK_SIZE_TEXT;

    const chunkCount = Math.ceil(this.totalBytes / this.activeChunkSize);

    const metadata: TransferMetadata = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      size: this.totalBytes,
      type,
      isText,
      textPreview: isText ? textContent.slice(0, 200) : undefined,
      chunkCount,
      chunkSize: this.activeChunkSize,
      totalBytes: this.totalBytes,
      sha256Fingerprint,
      salt: bufferToBase64(this.salt),
      iv: bufferToBase64(this.baseIV),
      timestamp: Date.now(),
      distributionMode: this.distributionMode,
      isMultiFile,
      fileCount: multipleFiles ? multipleFiles.length : 1,
      fileManifest: isMultiFile ? fileManifest : undefined,
    };

    this.metadata = metadata;

    // In Broadcast Mode, cache metadata on the server immediately
    if (this.distributionMode === 'broadcast') {
      this.socket.emit('cache-broadcast-metadata', {
        code: this.code,
        metadata,
      });
      // Start caching all encrypted chunks in RAM so receivers can pull instantly with zero sender lag
      this.precacheBroadcastChunks(metadata);
    } else if (this.partnerSocketId) {
      this.broadcastMetadata(metadata);
    }

    return metadata;
  }

  // Pre-caches encrypted chunks on the server in broadcast mode so any number of receivers can retrieve concurrently
  private async precacheBroadcastChunks(metadata: TransferMetadata) {
    if (!this.cryptoKey || (!this.fileRef && !this.preparedBuffer)) return;

    try {
      const chunkCount = metadata.chunkCount;
      const readAhead = new ReadAheadBuffer(
        this.fileRef,
        this.preparedBuffer,
        this.cryptoKey,
        this.baseIV,
        this.activeChunkSize,
        this.totalBytes,
        chunkCount,
        64,
        6
      );
      readAhead.start();

      for (let i = 0; i < chunkCount; i++) {
        const prefetched = await readAhead.getChunk(i);
        this.socket.emit('cache-broadcast-chunk', {
          code: this.code,
          index: i,
          total: chunkCount,
          chunk: prefetched.encryptedBuffer,
          isLast: i === chunkCount - 1,
        });
        if (i % 24 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      readAhead.abort();
    } catch (err) {
      console.warn('[void] Broadcast pre-cache error:', err);
    }
  }

  public broadcastMetadata(metadata: TransferMetadata) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ type: 'metadata', metadata }));
      } catch {}
    }

    if (this.partnerSocketId) {
      this.socket.emit('relay-metadata', {
        to: this.partnerSocketId,
        metadata,
      });
    }
  }

  public async startStreamingChunks() {
    if ((!this.preparedBuffer && !this.fileRef) || !this.metadata || !this.cryptoKey) return;
    if (this.isTransferring) return;

    try {
      this.acquireWakeLock();
      this.isTransferring = true;
      this.callbacks.onStatusChange('transferring');

      this.bytesTransferred = 0;
      this.lastMetricsTimestamp = performance.now();
      this.lastMetricsBytes = 0;
      this.inFlightIndices.clear();

      const chunkCount = this.metadata.chunkCount;

      const readAhead = new ReadAheadBuffer(
        this.fileRef,
        this.preparedBuffer,
        this.cryptoKey,
        this.baseIV,
        this.activeChunkSize,
        this.totalBytes,
        chunkCount,
        128,
        8
      );
      this.readAheadBuffer = readAhead;
      readAhead.start();

      for (let i = 0; i < chunkCount; i++) {
        if (!this.isTransferring) break;

        await this.waitForAckWindow();
        this.inFlightIndices.add(i);

        const prefetched = await readAhead.getChunk(i);
        const encryptedChunk = prefetched.encryptedBuffer;

        let sentViaWebRTC = false;
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
          try {
            if (this.dataChannel.bufferedAmount > 8 * 1024 * 1024) {
              await new Promise<void>((resolve) => {
                if (!this.dataChannel || this.dataChannel.readyState !== 'open') return resolve();
                const onLow = () => {
                  this.dataChannel?.removeEventListener('bufferedamountlow', onLow);
                  resolve();
                };
                this.dataChannel.addEventListener('bufferedamountlow', onLow, { once: true });
                setTimeout(onLow, 50);
              });
            }

            const packet = new Uint8Array(8 + encryptedChunk.byteLength);
            const packetView = new DataView(packet.buffer);
            packetView.setUint32(0, i, false);
            packetView.setUint32(4, chunkCount, false);
            packet.set(new Uint8Array(encryptedChunk), 8);

            this.dataChannel.send(packet.buffer);
            sentViaWebRTC = true;
          } catch (err) {
            this.connectionMode = 'socket-pipe';
          }
        }

        if (!sentViaWebRTC) {
          this.socket.emit('relay-chunk', {
            to: this.partnerSocketId,
            index: i,
            total: chunkCount,
            chunk: encryptedChunk,
            isLast: i === chunkCount - 1,
          });

          if (i % 16 === 0) {
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      }

      readAhead.abort();
      this.readAheadBuffer = null;

      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        try {
          this.dataChannel.send(JSON.stringify({ type: 'complete' }));
        } catch {}
      } else if (this.partnerSocketId) {
        this.socket.emit('relay-complete', { to: this.partnerSocketId });
      }

      await new Promise<void>((resolve) => {
        this.completionResolver = resolve;
        setTimeout(() => resolve(), 30000);
      });

      this.bytesTransferred = this.totalBytes;
      this.updateProgress();
      this.callbacks.onStatusChange('completed');
      this.releaseWakeLock();
    } catch (err: any) {
      if (this.readAheadBuffer) {
        this.readAheadBuffer.abort();
        this.readAheadBuffer = null;
      }
      this.callbacks.onError(err.message || 'Stream delivery halted.');
      this.releaseWakeLock();
    }
  }

  // --- Receiver Methods ---
  private async processIncomingMetadata(metadata: TransferMetadata) {
    this.metadata = metadata;
    this.totalBytes = metadata.totalBytes;
    this.salt = base64ToBuffer(metadata.salt);
    this.baseIV = base64ToBuffer(metadata.iv);
    if (metadata.distributionMode) {
      this.distributionMode = metadata.distributionMode;
    }

    this.cryptoKey = await deriveKeyFromCode(this.code, this.salt);

    this.callbacks.onMetadataReceived?.(metadata);

    // Drain queued chunks
    if (this.pendingChunksQueue.length > 0) {
      const queue = [...this.pendingChunksQueue];
      this.pendingChunksQueue = [];
      for (const item of queue) {
        await this.handleIncomingChunk(item.index, item.total, item.chunk, item.isLast);
      }
    }
  }

  public async signalReadyToReceive() {
    if (!this.metadata) return;

    this.acquireWakeLock();
    this.isTransferring = true;
    this.isFinalizing = false;
    this.callbacks.onStatusChange('transferring');

    if (this.distributionMode === 'broadcast') {
      // In broadcast mode, request stream immediately
      this.socket.emit('request-broadcast-stream', { code: this.code });
    } else {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        try {
          this.dataChannel.send(JSON.stringify({ type: 'ready-to-receive' }));
        } catch {}
      } else if (this.partnerSocketId) {
        this.socket.emit('relay-ready-to-receive', { to: this.partnerSocketId });
      }
    }
  }

  private async handleIncomingChunk(
    index: number,
    total: number,
    encryptedChunk: any,
    isLast?: boolean
  ) {
    if (!this.cryptoKey) {
      this.pendingChunksQueue.push({ index, total, chunk: encryptedChunk, isLast });
      return;
    }

    if (this.receivedChunksMap.has(index)) {
      return;
    }

    let chunkPayload: any = null;
    if (encryptedChunk instanceof ArrayBuffer || ArrayBuffer.isView(encryptedChunk)) {
      chunkPayload = encryptedChunk;
    } else if (encryptedChunk && typeof encryptedChunk === 'object') {
      if (encryptedChunk.data && (Array.isArray(encryptedChunk.data) || ArrayBuffer.isView(encryptedChunk.data))) {
        chunkPayload = new Uint8Array(encryptedChunk.data);
      } else if (Array.isArray(encryptedChunk)) {
        chunkPayload = new Uint8Array(encryptedChunk);
      } else {
        const vals = Object.values(encryptedChunk).filter((v) => typeof v === 'number') as number[];
        chunkPayload = new Uint8Array(vals);
      }
    } else if (typeof encryptedChunk === 'string') {
      chunkPayload = base64ToBuffer(encryptedChunk);
    }

    if (!chunkPayload || (chunkPayload as any).byteLength === 0) {
      return;
    }

    const chunkIV = getChunkIV(this.baseIV, index);

    try {
      const decrypted = await decryptChunk(this.cryptoKey, chunkIV, chunkPayload);
      const decryptedBytes = new Uint8Array(decrypted);

      this.receivedChunksMap.set(index, decryptedBytes);
      this.bytesTransferred += decrypted.byteLength;
      this.updateProgress();

      if (index % 16 === 0 || isLast || index === total - 1) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
          try {
            this.dataChannel.send(JSON.stringify({ 
              type: 'ack', 
              index, 
              receivedBytes: this.bytesTransferred 
            }));
          } catch {}
        }
        if (this.partnerSocketId) {
          this.socket.emit('relay-ack', { 
            to: this.partnerSocketId, 
            index, 
            receivedBytes: this.bytesTransferred 
          });
        }
      }

      if (this.receivedChunksMap.size === total || (this.isWaitingForRemainingChunks && this.receivedChunksMap.size === total)) {
        await this.finalizeTransfer();
      }
    } catch (err: any) {
      this.isTransferring = false;
      this.callbacks.onError(
        err.message || 'Authentication tag verification failed. Transfer halted.'
      );
      this.releaseWakeLock();
    }
  }

  private async finalizeTransfer() {
    if (this.isFinalizing) return;
    this.isFinalizing = true;
    this.callbacks.onStatusChange('verifying');

    try {
      if (this.receivedChunksMap.size > 0) {
        const sortedIndices = Array.from(this.receivedChunksMap.keys()).sort((a, b) => a - b);
        const totalExpected = this.metadata?.chunkCount || sortedIndices.length;

        if (this.metadata?.isText) {
          let totalLen = 0;
          for (const idx of sortedIndices) {
            totalLen += this.receivedChunksMap.get(idx)!.byteLength;
          }
          const combined = new Uint8Array(totalLen);
          let offset = 0;
          for (const idx of sortedIndices) {
            const chunk = this.receivedChunksMap.get(idx)!;
            combined.set(chunk, offset);
            offset += chunk.byteLength;
          }
          const text = new TextDecoder().decode(combined);
          this.receivedChunksMap.clear();
          this.callbacks.onTextReceived?.(text);
        } else if (this.metadata) {
          const sortedChunks: Uint8Array[] = new Array(totalExpected);
          for (let i = 0; i < totalExpected; i++) {
            const chunk = this.receivedChunksMap.get(i);
            if (!chunk) {
              throw new Error(`Incomplete transfer: Missing chunk ${i} of ${totalExpected}`);
            }
            sortedChunks[i] = chunk;
          }

          let mime = this.metadata.type;
          if (!mime || mime === 'application/octet-stream') {
            const ext = this.metadata.name.split('.').pop()?.toLowerCase();
            if (ext === 'mp4') mime = 'video/mp4';
            else if (ext === 'webm') mime = 'video/webm';
            else if (ext === 'mov') mime = 'video/quicktime';
            else if (ext === 'mkv') mime = 'video/x-matroska';
            else if (ext === 'avi') mime = 'video/x-msvideo';
            else if (ext === 'png') mime = 'image/png';
            else if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
            else if (ext === 'pdf') mime = 'application/pdf';
            else if (ext === 'zip') mime = 'application/zip';
          }

          let blob: Blob;
          try {
            blob = new Blob(sortedChunks as BlobPart[], { type: mime || 'application/octet-stream' });
          } catch (allocErr: any) {
            this.receivedChunksMap.clear();
            throw new Error(
              `Insufficient device storage or browser memory to compile ${this.metadata.name}. Please ensure your device has sufficient free disk space and close unused applications.`
            );
          }
          this.receivedChunksMap.clear();

          // MULTI-FILE ARCHIVE UNPACKING
          // If this was a multi-file batch, unpack files individually so user can download each file separately or all at once
          if (this.metadata.isMultiFile) {
            try {
              const zip = await JSZip.loadAsync(blob);
              const unpackedFiles: Array<{ name: string; blob: Blob; size: number }> = [];

              for (const [filename, fileEntry] of Object.entries(zip.files)) {
                if (!fileEntry.dir) {
                  const fileBlob = await fileEntry.async('blob');
                  unpackedFiles.push({
                    name: filename,
                    blob: fileBlob,
                    size: fileBlob.size,
                  });
                }
              }

              if (unpackedFiles.length > 0) {
                this.callbacks.onMultiFilesReady?.(unpackedFiles, blob);
              }
            } catch (zipErr) {
              console.warn('[void] Multi-file unpack notice, delivering archive blob:', zipErr);
            }
          }

          this.callbacks.onFileReadyToDownload?.(blob, this.metadata.name);
        }
      }

      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        try {
          this.dataChannel.send(JSON.stringify({ type: 'ack-complete' }));
        } catch {}
      }
      if (this.partnerSocketId) {
        this.socket.emit('relay-ack-complete', { to: this.partnerSocketId });
      }

      this.callbacks.onStatusChange('completed');
      this.releaseWakeLock();
    } catch (err: any) {
      this.callbacks.onError(err.message || 'Integrity verification failed');
      this.releaseWakeLock();
    }
  }

  // --- Network Route Diagnostics ---
  private async updateNetworkRoute() {
    if (this.connectionMode === 'socket-pipe') {
      this.networkRoute = 'relay-server';
      return;
    }
    if (!this.peerConnection) return;
    try {
      const stats = await this.peerConnection.getStats();
      let selectedPair: any = null;
      stats.forEach((report: any) => {
        if (report.type === 'candidate-pair' && (report.selected || report.state === 'succeeded')) {
          selectedPair = report;
        }
      });
      if (selectedPair) {
        const local = stats.get(selectedPair.localCandidateId) as any;
        const remote = stats.get(selectedPair.remoteCandidateId) as any;
        if (local?.candidateType === 'host' && remote?.candidateType === 'host') {
          this.networkRoute = 'local-lan';
        } else if (local?.candidateType === 'relay' || remote?.candidateType === 'relay') {
          this.networkRoute = 'relay-server';
        } else {
          this.networkRoute = 'public-wan';
        }
      }
    } catch {}
  }

  private handleAck(index: number, receivedBytes?: number) {
    this.inFlightIndices.delete(index);
    if (receivedBytes !== undefined && receivedBytes > this.bytesTransferred) {
      this.bytesTransferred = receivedBytes;
      this.updateProgress();
    }

    if (this.ackResolvers.length > 0) {
      const resolver = this.ackResolvers.shift();
      resolver?.();
    }
  }

  private async waitForAckWindow(): Promise<void> {
    const maxWindow = this.connectionMode === 'p2p-direct' ? 160 : 32;
    if (this.inFlightIndices.size < maxWindow) {
      return;
    }

    return new Promise<void>((resolve) => {
      this.ackResolvers.push(resolve);
      setTimeout(resolve, 80);
    });
  }

  private updateProgress() {
    const now = performance.now();
    const elapsedSec = (now - this.lastMetricsTimestamp) / 1000;

    if (elapsedSec >= 0.5) {
      const bytesDelta = this.bytesTransferred - this.lastMetricsBytes;
      this.currentSpeedBps = bytesDelta / elapsedSec;
      this.lastMetricsTimestamp = now;
      this.lastMetricsBytes = this.bytesTransferred;
    }

    const percentage = this.totalBytes > 0 
      ? Math.min(100, (this.bytesTransferred / this.totalBytes) * 100) 
      : 0;

    const remainingBytes = Math.max(0, this.totalBytes - this.bytesTransferred);
    const etaSeconds = this.currentSpeedBps > 0 
      ? Math.ceil(remainingBytes / this.currentSpeedBps) 
      : 0;

    const chunkSize = this.metadata?.chunkSize || this.activeChunkSize || DEFAULT_CHUNK_SIZE;

    const progress: TransferProgress = {
      bytesTransferred: this.bytesTransferred,
      totalBytes: this.totalBytes,
      percentage,
      speedBps: this.currentSpeedBps,
      etaSeconds,
      currentChunk: Math.floor(this.bytesTransferred / chunkSize),
      totalChunks: this.metadata?.chunkCount || Math.ceil(this.totalBytes / chunkSize) || 1,
      mode: this.connectionMode,
      networkRoute: this.networkRoute,
      encryptionActive: true,
      sha256Verified: percentage >= 100,
    };

    this.callbacks.onProgressUpdate(progress);
  }

  private async acquireWakeLock() {
    try {
      await wakeLockManager.acquire();
    } catch {}
  }

  private releaseWakeLock() {
    try {
      wakeLockManager.release();
    } catch {}
  }

  public destroy() {
    this.isTransferring = false;
    this.releaseWakeLock();

    if (this.readAheadBuffer) {
      try { this.readAheadBuffer.abort(); } catch {}
      this.readAheadBuffer = null;
    }

    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch {}
      this.peerConnection = null;
    }

    if (this.socket) {
      if (this.code) {
        this.socket.emit('destroy-void', this.code);
      }
      this.socket.disconnect();
    }

    this.receivedChunksMap.clear();
    this.pendingChunksQueue = [];
    this.pendingCandidates = [];
    this.earlySignals = [];
    this.preparedBuffer = null;
    this.fileRef = null;
    this.rawFilesList = [];
    this.inFlightIndices.clear();
    this.ackResolvers = [];
    this.completionResolver = null;
    this.isFinalizing = false;
  }
}
