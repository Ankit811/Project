// config/socket.js
import { Server } from 'socket.io';

const initializeSocket = (server, allowedOrigins) => {
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', socket => {
    console.log('User connected:', socket.id);
    
    socket.on('join', userId => {
      socket.join(userId);
      console.log(`User ${userId} joined room`);
    });
    
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  global._io = io;
  return io;
};

export default initializeSocket;
