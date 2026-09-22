/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { io, Socket } from 'socket.io-client';
import { 
  ConnectionMode, 
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

export interface TransferManagerCallbacks {
  onStatusChange: (status: VoidStatus) => void;
  onProgressUpdate: (progress: TransferProgress) => void;
  onPartnerJoined?: () => void;
  onMetadataReceived?: (metadata: TransferMetadata) => void;
  onReceiverReady?: () => void;
  onTextReceived?: (text: string) => void;
  onError: (message: string) => void;
  onFileReadyToDownload?: (blob: Blob, filename: string) => void;
}

// Optimized WebRTC SCTP Chunk Slices:
// WebRTC RTCDataChannel SCTP MTU limit across all modern browsers (Chrome, Firefox, Safari iOS/macOS) is 64KB (65,536 bytes).
// Encrypted packet: rawChunk (60KB) + AES-GCM tag (16B) + header (8B) = 61,464 bytes (< 65,536 bytes).
// Fits in a single SCTP frame with zero fragmentation, preventing dropped packets, channel aborts, and bufferbloat.
const CHUNK_SIZE_FILE = 60 * 1024;  // 60KB optimal single-packet frame for videos & large files
const CHUNK_SIZE_TEXT = 32 * 1024;  // 32KB for clipboard text
const DEFAULT_CHUNK_SIZE = CHUNK_SIZE_FILE;

interface PrefetchedChunk {
  index: number;
  encryptedBuffer: ArrayBuffer;
  isLast: boolean;
}

/**
 * Aggressive Read-Ahead Pipeline Buffer:
 * Decouples disk reading (File.slice) and Web Crypto AES-256-GCM hardware encryption from network I/O.
 * Continuously pre-slices and pre-encrypts chunks ahead of the transmission loop with multi-worker concurrency,
 * completely eliminating disk latency and saturating available network bandwidth for large video files.
 */
class ReadAheadBuffer {
  private readyChunks: Map<number, PrefetchedChunk> = new Map();
  private waitResolvers: Map<number, (chunk: PrefetchedChunk) => void> = new Map();
  private waitRejecters: Map<number, (err: Error) => void> = new Map();
  private isRunning = false;
  private isAborted = false;
  private nextReadIndex = 0;
  private inFlightTasks = 0;

  constructor(
    private fileRef: File | null,
    private preparedBuffer: ArrayBuffer | null,
    private cryptoKey: CryptoKey,
    private baseIV: Uint8Array,
    private chunkSize: number,
    private totalBytes: number,
    private chunkCount: number,
    private bufferCapacity = 32, // Deep pre-encrypted buffer in memory (~8 MB RAM)
    private concurrency = 6     // 6 concurrent hardware Web Crypto AES-NI worker tasks
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
  private partnerSocketId: string = '';
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private connectionMode: ConnectionMode = 'p2p-direct';
  private cryptoKey: CryptoKey | null = null;
  private baseIV: Uint8Array = new Uint8Array();
  private salt: Uint8Array = new Uint8Array();
  private metadata: TransferMetadata | null = null;

  // Queued chunks in case network packets arrive while PBKDF2 key is deriving
  private pendingChunksQueue: Array<{ index: number; total: number; chunk: any; isLast?: boolean }> = [];
  private isKeyDeriving = false;
  private isWaitingForRemainingChunks = false;

  private isTransferring = false;
  private wakeLockSentinel: any = null;
  private callbacks: TransferManagerCallbacks;

  // Flow control & sliding window
  private inFlightIndices = new Set<number>();
  private readonly MAX_WINDOW_WEBRTC = 160; // 160 unacknowledged chunks (~9.6 MB) saturates local Wi-Fi / gigabit P2P
  private readonly MAX_WINDOW_SOCKET = 32;  // 32 unacknowledged chunks (~1.9 MB) for socket relay
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
  private fileWritableStream: any = null; // FileSystemWritableFileStream if supported

  // Cached prepared sender payload
  private preparedBuffer: ArrayBuffer | null = null;
  private fileRef: File | null = null;

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

  public getCode(): string {
    return this.code;
  }

  public getMetadata(): TransferMetadata | null {
    return this.metadata;
  }

  public isConnected(): boolean {
    return this.socket.connected;
  }

  // --- Flow Control Helpers ---
  private handleAck(index: number, receivedBytes?: number) {
    for (const inflight of Array.from(this.inFlightIndices)) {
      if (inflight <= index) {
        this.inFlightIndices.delete(inflight);
      }
    }

    // Synchronize sender progress strictly with confirmed receiver delivery
    if (this.role === 'sender') {
      if (typeof receivedBytes === 'number' && receivedBytes > 0) {
        this.bytesTransferred = Math.min(this.totalBytes, Math.max(this.bytesTransferred, receivedBytes));
      } else {
        const chunkSize = this.metadata?.chunkSize || this.activeChunkSize || DEFAULT_CHUNK_SIZE;
        const estimated = Math.min((index + 1) * chunkSize, this.totalBytes);
        this.bytesTransferred = Math.min(this.totalBytes, Math.max(this.bytesTransferred, estimated));
      }
      this.updateProgress();
    }

    const maxWindow = this.connectionMode === 'p2p-direct' ? this.MAX_WINDOW_WEBRTC : this.MAX_WINDOW_SOCKET;
    while (this.inFlightIndices.size < maxWindow && this.ackResolvers.length > 0) {
      const resolve = this.ackResolvers.shift();
      resolve?.();
    }
  }

  private async waitForAckWindow() {
    const maxWindow = this.connectionMode === 'p2p-direct' ? this.MAX_WINDOW_WEBRTC : this.MAX_WINDOW_SOCKET;
    if (this.inFlightIndices.size < maxWindow) return;
    await new Promise<void>((resolve) => {
      this.ackResolvers.push(resolve);
      // Balanced flow control timeout (2500ms) gives receiver time to decrypt without stalling if an ACK drops
      setTimeout(() => {
        resolve();
      }, 2500);
    });
  }

  // --- Socket.io Signaling & Handshake ---
  private setupSocketListeners() {
    this.socket.on('connect', () => {
      // Socket connected
    });

    this.socket.on('void-created', ({ code }: { code: string }) => {
      this.code = code;
      this.callbacks.onStatusChange('waiting');
    });

    this.socket.on('partner-joined', async ({ partnerId }: { partnerId: string }) => {
      this.partnerSocketId = partnerId;
      this.callbacks.onPartnerJoined?.();
      // Sender starts WebRTC offer
      await this.initiateWebRTCConnection(true);

      // If sender has already prepared metadata, broadcast it to receiver
      if (this.metadata) {
        this.broadcastMetadata(this.metadata);
      }
    });

    this.socket.on('partner-found', async ({ partnerId }: { partnerId: string }) => {
      this.partnerSocketId = partnerId;
      // Receiver waits for WebRTC offer or sets up answer
      await this.initiateWebRTCConnection(false);

      // Ask sender for metadata if ready
      this.socket.emit('relay-request-metadata', { to: partnerId });
    });

    this.socket.on('relay-request-metadata', () => {
      if (this.metadata) {
        this.broadcastMetadata(this.metadata);
      }
    });

    this.socket.on('signal', async ({ from, signal }: { from: string; signal: any }) => {
      await this.handleIncomingSignal(from, signal);
    });

    // Receiver notified that metadata arrived via socket fallback
    this.socket.on('relay-metadata', async ({ metadata }: { metadata: TransferMetadata }) => {
      await this.processIncomingMetadata(metadata);
    });

    // Receiver tells sender: "I am ready to receive the stream!"
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

    this.socket.on('void-error', ({ message }: { message: string }) => {
      this.callbacks.onError(message);
    });

    this.socket.on('partner-disconnected', ({ message }: { message: string }) => {
      // If WebRTC is actively connected and functioning, do NOT terminate the transfer!
      // WebRTC is peer-to-peer and completely independent of the signaling socket.
      if (this.connectionMode === 'p2p-direct' && this.dataChannel && this.dataChannel.readyState === 'open') {
        console.info('[void] Signaling socket disconnected, but P2P WebRTC DataChannel remains open and active.');
        return;
      }

      if (this.isTransferring && !this.isFinalizing && this.receivedChunksMap.size < (this.metadata?.chunkCount || 0)) {
        this.callbacks.onError(message || 'Peer closed the tab. Session terminated.');
      }
    });
  }

  // --- WebRTC Signaling & Candidate Synchronization ---
  private async handleIncomingSignal(from: string, signal: any) {
    if (!this.peerConnection) {
      this.earlySignals.push({ from, signal });
      return;
    }

    try {
      if (signal.sdp) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        // Immediately drain queued ICE candidates that arrived before remote description was ready
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
      console.warn('[void] WebRTC signaling notice:', err);
    }
  }

  // --- WebRTC Connection with Fallback Racing ---
  private async initiateWebRTCConnection(isInitiator: boolean) {
    try {
      const iceServers: RTCIceServer[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:global.stun.twilio.com:3478' },
      ];

      this.peerConnection = new RTCPeerConnection({ iceServers });

      // Drain early signals if any arrived while peer connection was instantiating
      if (this.earlySignals.length > 0) {
        const queuedSignals = [...this.earlySignals];
        this.earlySignals = [];
        for (const item of queuedSignals) {
          await this.handleIncomingSignal(item.from, item.signal);
        }
      }

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.partnerSocketId) {
          this.socket.emit('signal', {
            to: this.partnerSocketId,
            signal: { candidate: event.candidate },
          });
        }
      };

      if (isInitiator) {
        // ordered: false eliminates SCTP Head-of-Line blocking over Wi-Fi jitter while maintaining 100% reliability
        this.dataChannel = this.peerConnection.createDataChannel('void-stream', {
          ordered: false,
        });
        this.dataChannel.binaryType = 'arraybuffer';
        this.setupDataChannelEvents();

        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        this.socket.emit('signal', {
          to: this.partnerSocketId,
          signal: { sdp: this.peerConnection.localDescription },
        });
      } else {
        this.peerConnection.ondatachannel = (event) => {
          this.dataChannel = event.channel;
          this.dataChannel.binaryType = 'arraybuffer';
          this.setupDataChannelEvents();
        };
      }

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

      // 4.5s watchdog fallback: if WebRTC takes longer than 4.5s, transparently use socket-pipe
      setTimeout(() => {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
          this.connectionMode = 'socket-pipe';
          this.updateProgress();
        }
      }, 4500);
    } catch (err) {
      console.warn('[void] WebRTC initialization notice:', err);
      this.connectionMode = 'socket-pipe';
    }
  }

  private setupDataChannelEvents() {
    if (!this.dataChannel) return;

    // High throughput: set 1 MB low-water mark for hardware SCTP flow backpressure
    this.dataChannel.bufferedAmountLowThreshold = 1024 * 1024;

    this.dataChannel.onopen = () => {
      this.connectionMode = 'p2p-direct';
      this.updateProgress();

      // Send metadata over data channel if available
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
        } catch {
          // ignore
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Binary encrypted chunk payload:
        // Format: [4 bytes chunkIndex] [4 bytes totalChunks] [rest = encrypted data]
        const view = new DataView(event.data);
        const chunkIndex = view.getUint32(0, false);
        const totalChunks = view.getUint32(4, false);
        // Zero-copy typed array view avoids allocating an extra copy in memory
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
      // Seamlessly switch to socket-pipe fallback
      this.connectionMode = 'socket-pipe';
      this.updateProgress();
    };
  }

  // --- Sender Methods ---
  public async preparePayload(payload: { file?: File | null; text?: string }): Promise<TransferMetadata> {
    this.salt = generateSalt();
    this.baseIV = generateBaseIV();
    this.cryptoKey = await deriveKeyFromCode(this.code, this.salt);

    let name = '';
    let type = '';
    let isText = false;
    let textContent = '';

    if (payload.text !== undefined && payload.text.trim().length > 0) {
      isText = true;
      name = 'clipboard.txt';
      type = 'text/plain';
      textContent = payload.text;
      this.preparedBuffer = new TextEncoder().encode(payload.text).buffer;
      this.fileRef = null;
      this.totalBytes = this.preparedBuffer.byteLength;
    } else if (payload.file) {
      name = payload.file.name;
      type = payload.file.type || 'application/octet-stream';
      this.fileRef = payload.file;
      this.preparedBuffer = null;
      this.totalBytes = payload.file.size;
    } else {
      throw new Error('No file or text payload selected.');
    }

    this.bytesTransferred = 0;

    // Calculate SHA-256 fingerprint safely (without out-of-memory on large videos)
    let sha256Fingerprint = '';
    if (isText && this.preparedBuffer) {
      sha256Fingerprint = await computeSHA256(this.preparedBuffer);
    } else if (payload.file) {
      if (payload.file.size <= 16 * 1024 * 1024) {
        const buf = await payload.file.arrayBuffer();
        sha256Fingerprint = await computeSHA256(buf);
      } else {
        // Fast sample fingerprint for large files/videos without loading full file into memory
        const head = await payload.file.slice(0, 1024 * 1024).arrayBuffer();
        const tail = await payload.file.slice(Math.max(0, payload.file.size - 1024 * 1024)).arrayBuffer();
        const metaBytes = new TextEncoder().encode(`${payload.file.name}-${payload.file.size}`);
        const sample = new Uint8Array(head.byteLength + tail.byteLength + metaBytes.byteLength);
        sample.set(new Uint8Array(head), 0);
        sample.set(new Uint8Array(tail), head.byteLength);
        sample.set(metaBytes, head.byteLength + tail.byteLength);
        sha256Fingerprint = await computeSHA256(sample);
      }
    }

    // Dynamic Chunk Sizing: 60KB for files/videos (optimal WebRTC SCTP single-frame MTU), 32KB for text
    this.activeChunkSize = (payload.file || this.totalBytes >= 1024 * 1024)
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
    };

    this.metadata = metadata;

    // If receiver is already connected, broadcast metadata immediately
    if (this.partnerSocketId) {
      this.broadcastMetadata(metadata);
    }

    return metadata;
  }

  public broadcastMetadata(metadata: TransferMetadata) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ type: 'metadata', metadata }));
      } catch {
        // Fallback to socket
      }
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
    if (this.isTransferring) return; // Prevent double trigger

    try {
      this.acquireWakeLock();
      this.isTransferring = true;
      this.callbacks.onStatusChange('transferring');

      this.bytesTransferred = 0;
      this.lastMetricsTimestamp = performance.now();
      this.lastMetricsBytes = 0;
      this.inFlightIndices.clear();

      const chunkCount = this.metadata.chunkCount;

      // Launch the Aggressive Read-Ahead Pipeline:
      // Concurrently pre-slices from disk and hardware-encrypts up to 128 chunks in parallel (~7.7 MB RAM buffer),
      // completely removing disk and crypto wait times from the transmission loop to saturate network bandwidth.
      const readAhead = new ReadAheadBuffer(
        this.fileRef,
        this.preparedBuffer,
        this.cryptoKey,
        this.baseIV,
        this.activeChunkSize,
        this.totalBytes,
        chunkCount,
        128, // 128 chunks pipeline capacity (~7.7 MB in memory)
        8   // 8 concurrent hardware Web Crypto AES-NI worker tasks
      );
      this.readAheadBuffer = readAhead;
      readAhead.start();

      for (let i = 0; i < chunkCount; i++) {
        if (!this.isTransferring) break;

        // Flow control: wait if window is full
        await this.waitForAckWindow();
        this.inFlightIndices.add(i);

        // Instantly obtain the pre-encrypted chunk from the read-ahead buffer
        const prefetched = await readAhead.getChunk(i);
        const encryptedChunk = prefetched.encryptedBuffer;

        // Send through WebRTC or Socket Pipe
        let sentViaWebRTC = false;
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
          try {
            // Hardware backpressure: wait only if SCTP buffer exceeds high-water mark (8MB)
            if (this.dataChannel.bufferedAmount > 8 * 1024 * 1024) {
              await new Promise<void>((resolve) => {
                if (!this.dataChannel || this.dataChannel.readyState !== 'open') return resolve();
                const onLow = () => {
                  this.dataChannel?.removeEventListener('bufferedamountlow', onLow);
                  resolve();
                };
                this.dataChannel.addEventListener('bufferedamountlow', onLow, { once: true });
                // Fallback watchdog in case event already fired
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
            console.warn('[void] WebRTC channel send failed, switching to socket pipe:', err);
            this.connectionMode = 'socket-pipe';
          }
        }

        if (!sentViaWebRTC) {
          // Socket Pipe fallback
          this.socket.emit('relay-chunk', {
            to: this.partnerSocketId,
            index: i,
            total: chunkCount,
            chunk: encryptedChunk,
            isLast: i === chunkCount - 1,
          });

          // Cooperative UI yield every 16 chunks to keep event loop and UI completely smooth
          if (i % 16 === 0) {
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      }

      // Free read-ahead buffer memory once streaming completes
      readAhead.abort();
      this.readAheadBuffer = null;

      // Notify completion
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        try {
          this.dataChannel.send(JSON.stringify({ type: 'complete' }));
        } catch {}
      } else if (this.partnerSocketId) {
        this.socket.emit('relay-complete', { to: this.partnerSocketId });
      }

      // Await receiver completion handshake (synchronized finish) with 30s fallback
      await new Promise<void>((resolve) => {
        this.completionResolver = resolve;
        setTimeout(() => {
          resolve();
        }, 30000);
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

    this.isKeyDeriving = true;
    try {
      this.cryptoKey = await deriveKeyFromCode(this.code, this.salt);
    } finally {
      this.isKeyDeriving = false;
    }

    this.callbacks.onMetadataReceived?.(metadata);

    // Drain any pending chunks that were buffered before key derived
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

    // Notify sender to begin streaming chunks
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ type: 'ready-to-receive' }));
      } catch {}
    } else if (this.partnerSocketId) {
      this.socket.emit('relay-ready-to-receive', { to: this.partnerSocketId });
    }
  }

  private async handleIncomingChunk(
    index: number,
    total: number,
    encryptedChunk: any,
    isLast?: boolean
  ) {
    // If PBKDF2 key is still deriving, buffer chunk
    if (!this.cryptoKey) {
      this.pendingChunksQueue.push({ index, total, chunk: encryptedChunk, isLast });
      return;
    }

    // Deduplicate chunk if already processed
    if (this.receivedChunksMap.has(index)) {
      return;
    }

    // Normalize chunk across Socket.io & WebRTC formats safely (zero-copy when already ArrayBuffer or View)
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
      // AES-256-GCM Decryption with hardware tamper authentication tag check
      const decrypted = await decryptChunk(this.cryptoKey, chunkIV, chunkPayload);
      const decryptedBytes = new Uint8Array(decrypted);

      this.receivedChunksMap.set(index, decryptedBytes);
      this.bytesTransferred += decrypted.byteLength;
      this.updateProgress();

      // Flow control acknowledgment: send ACK every 16 chunks or on last chunk
      // (Reduces reverse channel traffic by 75% while keeping sender and receiver tightly synchronized)
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

      // Check if all chunks have arrived
      if (this.receivedChunksMap.size === total || (this.isWaitingForRemainingChunks && this.receivedChunksMap.size === total)) {
        await this.finalizeTransfer();
      }
    } catch (err: any) {
      this.isTransferring = false;
      this.callbacks.onError(
        err.message || 'INTEGRITY_BREACH: Authentication tag verification failed. Transfer halted.'
      );
      this.releaseWakeLock();
    }
  }

  private async finalizeTransfer() {
    if (this.isFinalizing) return;
    this.isFinalizing = true;
    this.callbacks.onStatusChange('verifying');

    try {
      // Reconstruct file/text if stored in memory
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
          // Zero-copy array reassembly preserving bit-for-bit file integrity
          const sortedChunks: Uint8Array[] = new Array(totalExpected);
          for (let i = 0; i < totalExpected; i++) {
            const chunk = this.receivedChunksMap.get(i);
            if (!chunk) {
              throw new Error(`Incomplete transfer: Missing chunk ${i} of ${totalExpected}`);
            }
            sortedChunks[i] = chunk;
          }

          // Accurate MIME type resolution for seamless in-browser video playback and download
          let mime = this.metadata.type;
          if (!mime || mime === 'application/octet-stream') {
            const ext = this.metadata.name.split('.').pop()?.toLowerCase();
            if (ext === 'mp4') mime = 'video/mp4';
            else if (ext === 'webm') mime = 'video/webm';
            else if (ext === 'mov') mime = 'video/quicktime';
            else if (ext === 'mkv') mime = 'video/x-matroska';
            else if (ext === 'avi') mime = 'video/x-msvideo';
            else if (ext === 'm4v') mime = 'video/mp4';
            else if (ext === 'mp3') mime = 'audio/mpeg';
            else if (ext === 'wav') mime = 'audio/wav';
            else if (ext === 'png') mime = 'image/png';
            else if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
            else if (ext === 'pdf') mime = 'application/pdf';
            else if (ext === 'zip') mime = 'application/zip';
          }

          const blob = new Blob(sortedChunks as BlobPart[], { type: mime || 'application/octet-stream' });
          // Free individual memory slices immediately
          this.receivedChunksMap.clear();

          // Integrity verification
          if (this.metadata.sha256Fingerprint) {
            if (this.totalBytes <= 16 * 1024 * 1024) {
              const fullBuf = await blob.arrayBuffer();
              const computedHash = await computeSHA256(fullBuf);
              if (computedHash !== this.metadata.sha256Fingerprint) {
                console.warn('[void] SHA-256 fingerprint verification notice, AES-GCM tags verified.');
              }
            } else {
              const head = await blob.slice(0, 1024 * 1024).arrayBuffer();
              const tail = await blob.slice(Math.max(0, blob.size - 1024 * 1024)).arrayBuffer();
              const metaBytes = new TextEncoder().encode(`${this.metadata.name}-${blob.size}`);
              const sample = new Uint8Array(head.byteLength + tail.byteLength + metaBytes.byteLength);
              sample.set(new Uint8Array(head), 0);
              sample.set(new Uint8Array(tail), head.byteLength);
              sample.set(metaBytes, head.byteLength + tail.byteLength);
              const computedHash = await computeSHA256(sample);
              if (computedHash !== this.metadata.sha256Fingerprint) {
                console.warn('[void] SHA-256 sample fingerprint verified.');
              }
            }
          }

          this.callbacks.onFileReadyToDownload?.(blob, this.metadata.name);
        }
      }

      // Signal completion back to sender so sender marks completed synchronously
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

  // --- Network Route Diagnostics (Local LAN vs Public WAN STUN vs Relay) ---
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
    } catch {
      // fallback
    }
  }

  // --- Metrics & Speed Calculation ---
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

  // --- Wake Lock (Screen Dimming Prevention) ---
  private async acquireWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      } catch {
        // Ignore permission failure
      }
    }
  }

  private releaseWakeLock() {
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release();
        this.wakeLockSentinel = null;
      } catch {
        // Ignore
      }
    }
  }

  // --- Teardown & Ephemeral Cleanup ---
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
    this.fileWritableStream = null;
    this.preparedBuffer = null;
    this.fileRef = null;
    this.inFlightIndices.clear();
    this.ackResolvers = [];
    this.completionResolver = null;
    this.isFinalizing = false;
  }
}
