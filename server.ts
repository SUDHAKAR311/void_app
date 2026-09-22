/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { Server, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';

interface ActiveVoid {
  code: string;
  senderSocketId: string;
  receiverSocketId?: string;
  createdAt: number;
  metadata?: any;
}

const activeVoids = new Map<string, ActiveVoid>();
const failedAttempts = new Map<string, { count: number; blockedUntil: number }>();

// Periodic cleanup of expired codes (older than 15 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [code, session] of activeVoids.entries()) {
    if (now - session.createdAt > 15 * 60 * 1000) {
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

  app.use(express.json({ limit: '10mb' }));

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
    // Return high-availability STUN servers and optional TURN relay if configured
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

  // Socket.io Real-Time Matchmaking & Fallback Pipe
  io.on('connection', (socket: Socket) => {
    const clientIp = socket.handshake.address || socket.conn.remoteAddress || 'unknown';

    // 1. SENDER: Registers a unique 6-digit code
    socket.on('create-void', (code: string) => {
      if (!code || typeof code !== 'string' || code.length !== 6) {
        socket.emit('void-error', { message: 'Invalid 6-digit code format.' });
        return;
      }

      // If code already active and sender is different, regenerate
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
        createdAt: Date.now(),
      });

      socket.emit('void-created', { code, socketId: socket.id });
    });

    // 2. RECEIVER: Joins with 6-digit code
    socket.on('join-void', (code: string) => {
      const now = Date.now();
      const ipRecord = failedAttempts.get(clientIp);

      if (ipRecord && ipRecord.blockedUntil > now) {
        const remainingSeconds = Math.ceil((ipRecord.blockedUntil - now) / 1000);
        socket.emit('void-error', {
          message: `Too many failed attempts. Rate limited for ${remainingSeconds}s.`,
        });
        return;
      }

      const session = activeVoids.get(code);

      if (!session || !session.senderSocketId) {
        // Record failed attempt
        const count = (ipRecord?.count || 0) + 1;
        const blockedUntil = count >= 5 ? now + 15 * 60 * 1000 : 0;
        failedAttempts.set(clientIp, { count, blockedUntil });

        socket.emit('void-error', {
          message: count >= 5
            ? 'Too many failed code attempts. Temporary cooldown initiated.'
            : 'Void code not found or already closed. Check the 6 digits.',
        });
        return;
      }

      if (session.senderSocketId === socket.id) {
        socket.emit('void-error', { message: 'Cannot join your own void session.' });
        return;
      }

      // Handshake established!
      session.receiverSocketId = socket.id;

      // Notify sender that receiver connected
      io.to(session.senderSocketId).emit('partner-joined', {
        partnerId: socket.id,
        role: 'receiver',
        code,
      });

      // Notify receiver that sender was matched
      socket.emit('partner-found', {
        partnerId: session.senderSocketId,
        role: 'sender',
        code,
      });
    });

    // 3. WebRTC SIGNALING (SDP Offer, Answer, ICE Candidates)
    socket.on('signal', (data: { to: string; signal: any }) => {
      if (data?.to && data?.signal) {
        io.to(data.to).emit('signal', {
          from: socket.id,
          signal: data.signal,
        });
      }
    });

    // 4. TRIPLE-PATH FALLBACK PIPE (Socket-Pipe Relay)
    // Used when corporate firewalls, symmetric NATs, or strict mobile networks block P2P
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
        if (session.senderSocketId === socket.id || session.receiverSocketId === socket.id) {
          const partnerId = session.senderSocketId === socket.id ? session.receiverSocketId : session.senderSocketId;
          if (partnerId) {
            io.to(partnerId).emit('void-destroyed', { message: 'Partner closed the void.' });
          }
          activeVoids.delete(code);
        }
      }
    });

    // Disconnect: Grace period before notifying partner so temporary transport blips don't sever active transfers
    socket.on('disconnect', () => {
      for (const [code, session] of activeVoids.entries()) {
        if (session.senderSocketId === socket.id) {
          const receiverId = session.receiverSocketId;
          const currentSender = session.senderSocketId;
          setTimeout(() => {
            const currentSession = activeVoids.get(code);
            if (currentSession && currentSession.senderSocketId === currentSender) {
              if (receiverId) {
                io.to(receiverId).emit('partner-disconnected', {
                  message: 'Sender closed connection. Session terminated.',
                });
              }
              activeVoids.delete(code);
            }
          }, 15000);
        } else if (session.receiverSocketId === socket.id) {
          const senderId = session.senderSocketId;
          const currentReceiver = session.receiverSocketId;
          setTimeout(() => {
            const currentSession = activeVoids.get(code);
            if (currentSession && currentSession.receiverSocketId === currentReceiver) {
              if (senderId) {
                io.to(senderId).emit('partner-disconnected', {
                  message: 'Receiver disconnected.',
                });
              }
              currentSession.receiverSocketId = undefined;
            }
          }, 15000);
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
