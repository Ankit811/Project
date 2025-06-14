import { Server } from 'socket.io';
import { rateLimit } from 'express-rate-limit';

// Socket configuration
const SOCKET_CONFIG = {
  MAX_CONNECTIONS: 1000,
  ROOM_CLEANUP_INTERVAL: 300000, // 5 minutes
  MAX_ROOMS_PER_USER: 5,
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS_PER_WINDOW: 100,
  MAX_RECONNECTION_ATTEMPTS: 5,
  RECONNECTION_DELAY: 5000 // 5 seconds
};

// Connection tracking
const connectionTracker = {
  connections: new Map(),
  rooms: new Map(),
  lastCleanup: 0
};

// Rate limiter
const socketRateLimiter = rateLimit({
  windowMs: SOCKET_CONFIG.RATE_LIMIT_WINDOW,
  max: SOCKET_CONFIG.MAX_REQUESTS_PER_WINDOW,
  message: 'Too many socket connections from this IP, please try again later.'
});

// Room cleanup
const cleanupRooms = () => {
  const now = Date.now();
  
  // Clean up empty rooms
  connectionTracker.rooms.forEach((room, roomId) => {
    if (room.size === 0 && now - room.lastActivity > SOCKET_CONFIG.ROOM_CLEANUP_INTERVAL) {
      connectionTracker.rooms.delete(roomId);
      console.log(`Cleaned up empty room: ${roomId}`);
    }
  });
  
  // Clean up old connections
  connectionTracker.connections.forEach((conn, connId) => {
    if (now - conn.lastActivity > SOCKET_CONFIG.ROOM_CLEANUP_INTERVAL) {
      connectionTracker.connections.delete(connId);
    }
  });
  
  connectionTracker.lastCleanup = now;
};

// Initialize socket with enhanced security and monitoring
const initializeSocket = (server, allowedOrigins) => {
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        try {
          if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          return callback(new Error('Not allowed by CORS'));
        } catch (error) {
          console.error('CORS error:', error);
          return callback(error);
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    maxHttpBufferSize: 1e8, // 100MB
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true,
    transports: ['websocket', 'polling']
  });

  // Assign Socket.IO instance to global._io
  global._io = io;

  // Mobile-specific handlers
  io.on('connection', socket => {
    try {
      console.log('User connected:', socket.id);
      
      // Track connection
      connectionTracker.connections.set(socket.id, {
        lastActivity: Date.now(),
        userId: null,
        rooms: new Set()
      });

      // Mobile connection handling
      socket.on('mobile-connect', (deviceInfo) => {
        try {
          console.log('Mobile device connected:', deviceInfo);
          socket.join(`device:${deviceInfo.deviceId}`);
        } catch (error) {
          console.error('Mobile connection error:', error);
          socket.emit('error', 'Failed to connect mobile device');
        }
      });

      // Join room with validation
      socket.on('join', async (userId) => {
        try {
          const conn = connectionTracker.connections.get(socket.id);
          if (!conn) {
            throw new Error('Connection not found');
          }

          if (conn.rooms.size >= SOCKET_CONFIG.MAX_ROOMS_PER_USER) {
            throw new Error('Maximum room limit reached');
          }

          // Validate room existence
          if (!connectionTracker.rooms.has(userId)) {
            connectionTracker.rooms.set(userId, new Set());
          }

          // Join room
          socket.join(userId);
          conn.userId = userId;
          conn.rooms.add(userId);
          connectionTracker.rooms.get(userId).add(socket.id);
          
          console.log(`User ${userId} joined room`);
          
          // Mobile-specific handling
          if (socket.handshake.query.deviceId) {
            socket.join(`device:${socket.handshake.query.deviceId}`);
          }

        } catch (error) {
          console.error('Join error:', error);
          socket.emit('error', error.message);
        }
      });

      // Handle disconnect with cleanup
      socket.on('disconnect', (reason) => {
        try {
          console.log(`User disconnected: ${socket.id} (reason: ${reason})`);
          
          const conn = connectionTracker.connections.get(socket.id);
          if (conn) {
            // Leave all rooms
            conn.rooms.forEach(roomId => {
              socket.leave(roomId);
              const room = connectionTracker.rooms.get(roomId);
              if (room) {
                room.delete(socket.id);
              }
            });
            
            connectionTracker.connections.delete(socket.id);
          }

          // Mobile-specific cleanup
          if (socket.handshake.query.deviceId) {
            socket.leave(`device:${socket.handshake.query.deviceId}`);
          }

        } catch (error) {
          console.error('Disconnect error:', error);
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error('Socket error:', error);
        socket.emit('error', 'Socket connection error');
      });

      // Handle reconnection
      socket.on('reconnect', (attemptNumber) => {
        console.log(`Reconnection attempt ${attemptNumber} for socket ${socket.id}`);
        if (attemptNumber > SOCKET_CONFIG.MAX_RECONNECTION_ATTEMPTS) {
          socket.disconnect(true);
        }
      });

      // Handle network state changes (mobile)
      socket.on('network-state', (state) => {
        console.log(`Network state changed to: ${state}`);
        if (state === 'offline') {
          socket.disconnect(true);
        }
      });

    } catch (error) {
      console.error('Socket initialization error:', error);
      socket.disconnect(true);
    }
  });

  // Set up periodic cleanup
  setInterval(cleanupRooms, SOCKET_CONFIG.ROOM_CLEANUP_INTERVAL);

  // Add monitoring endpoints
  io.on('connection', socket => {
    socket.on('monitor', () => {
      const stats = {
        totalConnections: connectionTracker.connections.size,
        activeRooms: Array.from(connectionTracker.rooms.keys()).length,
        memoryUsage: process.memoryUsage(),
        lastCleanup: connectionTracker.lastCleanup
      };
      socket.emit('monitor-response', stats);
    });
  });

  // Export cleanup function
  io.cleanup = () => {
    console.log('Cleaning up socket connections...');
    io.sockets.sockets.forEach(socket => {
      socket.disconnect(true);
    });
    connectionTracker.connections.clear();
    connectionTracker.rooms.clear();
  };

  return io;
};

export default initializeSocket;