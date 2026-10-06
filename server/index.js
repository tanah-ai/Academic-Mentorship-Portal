const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Load environment variables from root directory
const envPath = path.join(__dirname, '..', '.env');
console.log('Loading .env from:', envPath);
console.log('.env file exists:', require('fs').existsSync(envPath));
dotenv.config({ path: envPath });

// Debug: Check if environment variables are loaded
console.log('DB_PASSWORD loaded:', process.env.DB_PASSWORD ? 'YES' : 'NO');
console.log('JWT_SECRET loaded:', process.env.JWT_SECRET ? 'YES' : 'NO');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const moduleRoutes = require('./routes/modules');
const sessionRoutes = require('./routes/sessions');
const matchingRoutes = require('./routes/matching');
const gamificationRoutes = require('./routes/gamification');
const analyticsRoutes = require('./routes/analytics');
const uploadRoutes = require('./routes/upload');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const dataLiteMiddleware = require('./middleware/dataLite');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Data-Lite'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 300, // development has several API calls per page
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please wait a few minutes and try again.'
  }
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: {
    success: false,
    error: 'Too many authentication attempts. Please wait 15 minutes and try again.'
  },
  skipSuccessfulRequests: true
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data-Lite middleware for low bandwidth optimization
app.use(dataLiteMiddleware);

// Make io accessible to routes
app.set('io', io);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/upload', uploadRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'MSU Academic Mentorship Portal API is running',
    timestamp: new Date().toISOString()
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-session', (sessionId) => {
    socket.join(`session-${sessionId}`);
    console.log(`User ${socket.id} joined session ${sessionId}`);
  });

  socket.on('leave-session', (sessionId) => {
    socket.leave(`session-${sessionId}`);
    console.log(`User ${socket.id} left session ${sessionId}`);
  });

  socket.on('whiteboard-update', (data) => {
    socket.to(`session-${data.sessionId}`).emit('whiteboard-update', data);
  });

  socket.on('code-update', (data) => {
    socket.to(`session-${data.sessionId}`).emit('code-update', data);
  });

  socket.on('chat-message', (data) => {
    socket.to(`session-${data.sessionId}`).emit('chat-message', data);
  });

  // WebRTC signaling
  socket.on('offer', (data) => {
    socket.to(`session-${data.sessionId}`).emit('offer', data);
  });

  socket.on('answer', (data) => {
    socket.to(`session-${data.sessionId}`).emit('answer', data);
  });

  socket.on('ice-candidate', (data) => {
    socket.to(`session-${data.sessionId}`).emit('ice-candidate', data);
  });

  socket.on('request-offer', (data) => {
    socket.to(`session-${data.sessionId}`).emit('request-offer', data);
  });

  socket.on('file-shared', (data) => {
    socket.to(`session-${data.sessionId}`).emit('file-shared', data);
  });

  socket.on('reaction', (data) => {
    socket.to(`session-${data.sessionId}`).emit('reaction', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, io };
