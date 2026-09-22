/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ConnectionMode = 'p2p-direct' | 'turn-relay' | 'socket-pipe';

export type AppView = 'choice' | 'send' | 'receive' | 'transfer';

export type VoidRole = 'sender' | 'receiver';

export type VoidStatus = 
  | 'idle' 
  | 'preparing' 
  | 'waiting' 
  | 'connecting' 
  | 'ready' 
  | 'transferring' 
  | 'verifying' 
  | 'completed' 
  | 'error';

export interface TransferMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  isText: boolean;
  textPreview?: string;
  chunkCount: number;
  chunkSize: number;
  totalBytes: number;
  sha256Fingerprint?: string;
  salt: string; // Base64 encoded PBKDF2 salt
  iv: string;   // Base64 encoded starting IV
  timestamp: number;
}

export interface TransferProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  speedBps: number;
  etaSeconds: number;
  currentChunk: number;
  totalChunks: number;
  mode: ConnectionMode;
  networkRoute?: 'local-lan' | 'public-wan' | 'relay-server';
  encryptionActive: boolean;
  sha256Verified?: boolean;
}

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface SocketSignalPayload {
  to: string;
  from?: string;
  signal: RTCSessionDescriptionInit | RTCIceCandidateInit | { candidate: RTCIceCandidateInit };
}

export interface RelayChunkPayload {
  to: string;
  code: string;
  index: number;
  total: number;
  chunk: ArrayBuffer | string; // ArrayBuffer or base64
  iv?: string;
}
