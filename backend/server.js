const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

const authRouter = require('./routes/auth');
const officialsRouter = require('./routes/officials');
const appointmentsRouter = require('./routes/appointments');
const notificationsRouter = require('./routes/notifications');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: [
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:5174', 'http://127.0.0.1:5174',
    'http://localhost:5175', 'http://127.0.0.1:5175'
  ],
  credentials: true
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log requests in development
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Register API Routes
app.use('/api/auth', authRouter);
app.use('/api/officials', officialsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', adminRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

const http = require('http');
const { initWebSocket } = require('./websocket');

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'An unexpected error occurred on the server.' });
});

// Boot server and verify DB tables
async function startServer() {
  try {
    await initDb();
    
    const server = http.createServer(app);
    initWebSocket(server);
    
    server.listen(PORT, () => {
      console.log(`Backend server successfully listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
    process.exit(1);
  }
}

startServer();
