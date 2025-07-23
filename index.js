const express = require("express");
const router = require("./routes");
const { login } = require("./jwt");

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// CORS middleware for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    code: 200,
    message: 'MBBank API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Welcome endpoint
app.get('/', (req, res) => {
  res.json({
    code: 200,
    message: 'Welcome to MBBank API',
    description: 'Ngân hàng TMCP Quân đội - Military Commercial Joint Stock Bank',
    endpoints: {
      login: 'POST /auth/login',
      accounts: 'GET /accounts (requires authentication)',
      health: 'GET /health'
    }
  });
});

// Authentication endpoint
app.post('/auth/login', login);

// Protected routes
app.use("/accounts", router);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    code: 404,
    message: 'Endpoint not found',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()} - ${error.message}`);
  console.error(error.stack);

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    code: error.status || 500,
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: error.stack })
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║               MBBank API Server Started                   ║
║                                                           ║
║  🏦 Ngân hàng TMCP Quân đội - MBBank                     ║
║  🚀 Server running on port ${PORT}                           ║
║  🔐 JWT Authentication enabled                            ║
║  🛡️  Cerbos Authorization enabled                         ║
║  📧 Email domain: @mbbank.com                            ║
║                                                           ║
║  Health check: http://localhost:${PORT}/health             ║
║  API Documentation: Available on request                 ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;