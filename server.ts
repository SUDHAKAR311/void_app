/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { Server, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';

export type DistributionMode = 'p2p' | 'broadcast';

interface ActiveVoid {
  code: string;
  senderSocketId: string;
  mode: DistributionMode;
  receiverSocketIds: Set<string>;
  createdAt: number;
  metadata?: any;
  // In broadcast mode, sender can cache encrypted chunks in RAM so subsequent receivers retrieve instantly without re-upload lag
  broadcastPayload?: {
    metadata: any;
    chunks: Map<number, any>;
    isReady: boolean;
  };
}

const activeVoids = new Map<string, ActiveVoid>();

// Rate-limiting / brute-force lockout:
// 1-6 attempts: silent counter increment
// 7-9 attempts: warning with remaining attempts
// 10+ attempts: locked for 30 minutes (1800000 ms)
const failedAttempts = new Map<string, { count: number; blockedUntil: number }>();

const MAX_ALLOWED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Periodic cleanup of expired codes (older than 45 minutes for broadcast, 15 for p2p)
setInterval(() => {
  const now = Date.now();
  for (const [code, session] of activeVoids.entries()) {
    const maxAge = session.mode === 'broadcast' ? 60 * 60 * 1000 : 15 * 60 * 1000;
    if (now - session.createdAt > maxAge) {
      activeVoids.delete(code);
    }
  }
  for (const [ip, record] of failedAttempts.entries()) {
    if (now > record.blockedUntil && record.count > 0) {
      failedAttempts.delete(ip);
    }
  }
}, 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  app.use(express.json({ limit: '50mb' }));

  // Socket.io initialization with high throughput configuration
  const io = new Server(server, {
    maxHttpBufferSize: 1e8, // 100MB buffer for robust socket pipe fallback
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // REST API Routes
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'void-ephemeral-p2p',
      activeSessions: activeVoids.size,
      timestamp: Date.now(),
    });
  });

  app.get('/api/ice-servers', (_req, res) => {
    const iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ];

    if (process.env.TURN_SERVER_URL) {
      iceServers.push({
        urls: process.env.TURN_SERVER_URL,
        username: process.env.TURN_USERNAME || '',
        credential: process.env.TURN_CREDENTIAL || '',
      });
    }

    res.json({ iceServers });
  });

  // Check rate-limit status for a client
  app.get('/api/check-lockout', (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const record = failedAttempts.get(clientIp);
    const now = Date.now();
    if (record && record.blockedUntil > now) {
      const remainingSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      return res.json({ locked: true, remainingSeconds, attempts: record.count });
    }
    return res.json({ locked: false, attempts: record?.count || 0, maxAttempts: MAX_ALLOWED_ATTEMPTS });
  });

  // Socket.io Real-Time Matchmaking & Multi-Receiver Relay
  io.on('connection', (socket: Socket) => {
    const clientIp = socket.handshake.address || socket.conn.remoteAddress || 'unknown';

    // 1. SENDER: Registers a unique 6-digit code with distribution mode
    socket.on('create-void', (payload: string | { code: string; mode?: DistributionMode }) => {
      const code = typeof payload === 'string' ? payload : payload?.code;
      const mode: DistributionMode = typeof payload === 'object' && payload?.mode === 'broadcast' ? 'broadcast' : 'p2p';

      if (!code || typeof code !== 'string' || code.length !== 6) {
        socket.emit('void-error', { message: 'Invalid 6-digit code format.' });
        return;
      }

      if (activeVoids.has(code)) {
        const existing = activeVoids.get(code)!;
        if (existing.senderSocketId !== socket.id) {
          socket.emit('void-error', { message: 'Code collision, generating fresh code.' });
          return;
        }
      }

      activeVoids.set(code, {
        code,
        senderSocketId: socket.id,
        mode,
        receiverSocketIds: new Set<string>(),
        createdAt: Date.now(),
      });

      socket.emit('void-created', { code, socketId: socket.id, mode });
    });

    // 2. RECEIVER: Joins with 6-digit code
    socket.on('join-void', (code: string) => {
      const now = Date.now();
      const ipRecord = failedAttempts.get(clientIp);

      // Check 30-minute lockout
      if (ipRecord && ipRecord.blockedUntil > now) {
        const remainingSeconds = Math.ceil((ipRecord.blockedUntil - now) / 1000);
        socket.emit('void-error', {
          message: `Device locked due to excessive failed attempts. Try again in ${Math.floor(remainingSeconds / 60)}m ${remainingSeconds % 60}s.`,
          isLocked: true,
          remainingSeconds,
          attempts: ipRecord.count,
        });
        return;
      }

      const session = activeVoids.get(code);

      if (!session || !session.senderSocketId) {
        // Record failed attempt
        const currentCount = (ipRecord?.count || 0) + 1;
        let blockedUntil = 0;
        let message = 'Void code not found or already closed. Check the 6 digits.';

        if (currentCount >= MAX_ALLOWED_ATTEMPTS) {
          blockedUntil = now + LOCKOUT_DURATION_MS;
          failedAttempts.set(clientIp, { count: currentCount, blockedUntil });
          socket.emit('void-error', {
            message: 'Too many wrong attempts! Your access is locked for 30 minutes for security.',
            isLocked: true,
            remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
            attempts: currentCount,
          });
          return;
        }

        failedAttempts.set(clientIp, { count: currentCount, blockedUntil: 0 });

        const remainingAttempts = MAX_ALLOWED_ATTEMPTS - currentCount;
        let warning: string | undefined;

        if (currentCount >= 7) {
          warning = `Warning: Too many wrong attempts! You have only ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining before a 30-minute lockout.`;
        }

        socket.emit('void-error', {
          message,
          warning,
          attempts: currentCount,
          remainingAttempts,
          isLocked: false,
        });
        return;
      }

      if (session.senderSocketId === socket.id) {
        socket.emit('void-error', { message: 'Cannot join your own void session.' });
        return;
      }

      // Successful verification! Reset failed attempts for this IP
      failedAttempts.delete(clientIp);

      // Add to session receivers
      session.receiverSocketIds.add(socket.id);

      // Notify sender that a receiver joined
      io.to(session.senderSocketId).emit('partner-joined', {
        partnerId: socket.id,
        role: 'receiver',
        code,
        mode: session.mode,
      });

      // Notify receiver that sender was matched
      socket.emit('partner-found', {
        partnerId: session.senderSocketId,
        role: 'sender',
        code,
        mode: session.mode,
      });

      // In Broadcast Mode: If sender already cached metadata/payload in volatile memory, stream directly to new receiver instantly
      if (session.mode === 'broadcast' && session.broadcastPayload) {
        const payload = session.broadcastPayload;
        socket.emit('relay-metadata', {
          from: session.senderSocketId,
          metadata: payload.metadata,
        });
      }
    });

    // 3. WebRTC SIGNALING (Targeted peer-to-peer signalling)
    socket.on('signal', (data: { to: string; signal: any }) => {
      if (data?.to && data?.signal) {
        io.to(data.to).emit('signal', {
          from: socket.id,
          signal: data.signal,
        });
      }
    });

    // 4. BROADCAST MEMORY CACHE (Zero UI / network lag for unlimited receivers)
    // Sender uploads encrypted chunks once to volatile session memory.
    // The server distributes chunks instantly to all present and future receivers without re-taxing the sender device.
    socket.on('cache-broadcast-metadata', (data: { code: string; metadata: any }) => {
      const session = activeVoids.get(data?.code);
      if (session && session.senderSocketId === socket.id) {
        session.broadcastPayload = {
          metadata: data.metadata,
          chunks: new Map(),
          isReady: false,
        };
        // Broadcast metadata to all connected receivers
        for (const receiverId of session.receiverSocketIds) {
          io.to(receiverId).emit('relay-metadata', {
            from: socket.id,
            metadata: data.metadata,
          });
        }
      }
    });

    socket.on('cache-broadcast-chunk', (data: { code: string; index: number; total: number; chunk: any; isLast?: boolean }) => {
      const session = activeVoids.get(data?.code);
      if (session && session.senderSocketId === socket.id && session.broadcastPayload) {
        session.broadcastPayload.chunks.set(data.index, data.chunk);
        if (data.isLast) {
          session.broadcastPayload.isReady = true;
        }

        // Relay chunk to all active receivers currently waiting
        for (const receiverId of session.receiverSocketIds) {
          io.to(receiverId).emit('relay-chunk', {
            from: socket.id,
            index: data.index,
            total: data.total,
            chunk: data.chunk,
            isLast: data.isLast,
          });
        }
      }
    });

    // Request broadcast stream: A newly connected receiver requests the pre-cached encrypted stream
    socket.on('request-broadcast-stream', (data: { code: string }) => {
      const session = activeVoids.get(data?.code);
      if (session && session.broadcastPayload) {
        const bp = session.broadcastPayload;
        // Stream chunks to this specific receiver in swift paced batches
        const total = bp.metadata.chunkCount;
        let sent = 0;
        const sendNextBatch = () => {
          const batchLimit = Math.min(sent + 16, total);
          for (let i = sent; i < batchLimit; i++) {
            const chunk = bp.chunks.get(i);
            if (chunk !== undefined) {
              socket.emit('relay-chunk', {
                from: session.senderSocketId,
                index: i,
                total,
                chunk,
                isLast: i === total - 1,
              });
            }
          }
          sent = batchLimit;
          if (sent < total) {
            setTimeout(sendNextBatch, 5);
          }
        };
        sendNextBatch();
      }
    });

    // 5. TRIPLE-PATH FALLBACK PIPE (Direct Socket-Pipe Relay)
    socket.on('relay-metadata', (data: { to: string; metadata: any }) => {
      if (data?.to && data?.metadata) {
        io.to(data.to).emit('relay-metadata', {
          from: socket.id,
          metadata: data.metadata,
        });
      }
    });

    socket.on('relay-chunk', (data: { to: string; index: number; total: number; chunk: any; isLast?: boolean }) => {
      if (data?.to && data?.chunk !== undefined) {
        io.to(data.to).emit('relay-chunk', {
          from: socket.id,
          index: data.index,
          total: data.total,
          chunk: data.chunk,
          isLast: data.isLast,
        });
      }
    });

    socket.on('relay-ack', (data: { to: string; index: number; receivedBytes?: number }) => {
      if (data?.to && data?.index !== undefined) {
        io.to(data.to).emit('relay-ack', {
          from: socket.id,
          index: data.index,
          receivedBytes: data.receivedBytes,
        });
      }
    });

    socket.on('relay-ready-to-receive', (data: { to: string }) => {
      if (data?.to) {
        io.to(data.to).emit('relay-ready-to-receive', { from: socket.id });
      }
    });

    socket.on('relay-request-metadata', (data: { to: string }) => {
      if (data?.to) {
        io.to(data.to).emit('relay-request-metadata', { from: socket.id });
      }
    });

    socket.on('relay-complete', (data: { to: string }) => {
      if (data?.to) {
        io.to(data.to).emit('relay-complete', { from: socket.id });
      }
    });

    socket.on('relay-ack-complete', (data: { to: string }) => {
      if (data?.to) {
        io.to(data.to).emit('relay-ack-complete', { from: socket.id });
      }
    });

    // Cancel / Terminate Void
    socket.on('destroy-void', (code: string) => {
      if (code && activeVoids.has(code)) {
        const session = activeVoids.get(code)!;
        if (session.senderSocketId === socket.id) {
          for (const rId of session.receiverSocketIds) {
            io.to(rId).emit('void-destroyed', { message: 'Sender closed the void.' });
          }
          activeVoids.delete(code);
        } else if (session.receiverSocketIds.has(socket.id)) {
          session.receiverSocketIds.delete(socket.id);
          if (session.mode === 'p2p') {
            io.to(session.senderSocketId).emit('void-destroyed', { message: 'Receiver closed connection.' });
            activeVoids.delete(code);
          }
        }
      }
    });

    // Disconnect: Grace period before notifying partner so temporary transport blips don't sever active transfers
    socket.on('disconnect', () => {
      for (const [code, session] of activeVoids.entries()) {
        if (session.senderSocketId === socket.id) {
          const receivers = Array.from(session.receiverSocketIds);
          setTimeout(() => {
            const currentSession = activeVoids.get(code);
            if (currentSession && currentSession.senderSocketId === socket.id) {
              for (const rId of receivers) {
                io.to(rId).emit('partner-disconnected', {
                  message: 'Sender closed connection. Session terminated.',
                });
              }
              activeVoids.delete(code);
            }
          }, 20000);
        } else if (session.receiverSocketIds.has(socket.id)) {
          session.receiverSocketIds.delete(socket.id);
          if (session.mode === 'p2p') {
            setTimeout(() => {
              const currentSession = activeVoids.get(code);
              if (currentSession && !currentSession.receiverSocketIds.has(socket.id)) {
                io.to(currentSession.senderSocketId).emit('partner-disconnected', {
                  message: 'Receiver disconnected.',
                });
              }
            }, 15000);
          }
        }
      }
    });
  });

  // Vite middleware for development vs Static file server for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[void] Server live on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[void] Fatal server startup error:', err);
  process.exit(1);
});
