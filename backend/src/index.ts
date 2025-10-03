import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config/index';
// Try to import logger, fallback to console if not available
let logger: any;
try {
  logger = require('./utils/logger').logger;
} catch (error) {
  console.warn('Logger not available, using console');
  logger = {
    info: console.log,
    error: console.error,
    warn: console.warn
  };
}

// Validate critical environment variables
function validateEnvironment() {
  const requiredEnvVars = ['JWT_SECRET'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    logger.info('Please ensure your .env file contains all required variables');
    process.exit(1);
  }
}

// Check if we can import middleware (they may not exist)
let errorHandler: any, authMiddleware: any, validateRequest: any;
try {
  errorHandler = require('./middleware/errorHandler').errorHandler;
  authMiddleware = require('./middleware/auth').authMiddleware;
  validateRequest = require('./middleware/validation').validateRequest;
} catch (error) {
  console.warn('Some middleware modules not found, using defaults');
  errorHandler = (err: any, req: any, res: any, next: any) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  };
  authMiddleware = (req: any, res: any, next: any) => next();
  validateRequest = (req: any, res: any, next: any) => next();
}

// Import route handlers with error handling
// Import route handlers with error handling
let authRoutes: any, slotRoutes: any, orderRoutes: any, deviceRoutes: any, eventRoutes: any, riderRoutes: any;
try {
  authRoutes = require('./routes/auth').default || require('./routes/auth');
  slotRoutes = require('./routes/slots').default || require('./routes/slots');
  orderRoutes = require('./routes/orders').default || require('./routes/orders');
  deviceRoutes = require('./routes/devices').default || require('./routes/devices');
  eventRoutes = require('./routes/events').default || require('./routes/events');
  riderRoutes = require('./routes/riders').default || require('./routes/riders');
} catch (error) {
  console.warn('Some route modules not found, using placeholders');
  const express = require('express');
  const placeholderRouter = express.Router();
  placeholderRouter.get('*', (req: any, res: any) => res.json({ message: 'Route not implemented yet' }));
  authRoutes = slotRoutes = orderRoutes = deviceRoutes = eventRoutes = riderRoutes = placeholderRouter;
}

// Import services with error handling
// Import services with error handling
let DatabaseService: any, RedisService: any, MQTTService: any, AuthService: any, OrderOrchestratorService: any, EventLedgerService: any, DeviceService: any;
try {
  DatabaseService = require('./services/DatabaseService').DatabaseService;
  RedisService = require('./services/RedisService').RedisService;
  MQTTService = require('./services/MQTTService').MQTTService;
  AuthService = require('./services/AuthService').AuthService;
  OrderOrchestratorService = require('./services/OrderOrchestratorService').OrderOrchestratorService;
  EventLedgerService = require('./services/EventLedgerService').EventLedgerService;
  DeviceService = require('./services/DeviceService').DeviceService;
} catch (error) {
  console.warn('Some service modules not found, using mock services');
  // Create mock services
  const mockService = {
    initialize: async () => { console.log('Mock service initialized'); },
    close: async () => { console.log('Mock service closed'); }
  };
  DatabaseService = RedisService = MQTTService = AuthService = OrderOrchestratorService = EventLedgerService = DeviceService = mockService;
}

const app: Application = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts, please try again later.',
});

app.use('/api/auth/', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info('Request received', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/slots', authMiddleware, slotRoutes);
app.use('/api/orders', authMiddleware, orderRoutes);
app.use('/api/devices', authMiddleware, deviceRoutes);
app.use('/api/events', authMiddleware, eventRoutes);
app.use('/api/riders', riderRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found on this server.',
    path: req.originalUrl
  });
});

// Global error handler
app.use(errorHandler);

// Initialize services with graceful degradation
async function initializeServices() {
  const services = [
    { name: 'Database', init: () => DatabaseService.initialize(), required: false },
    { name: 'Redis', init: () => RedisService.initialize(), required: false },
    { name: 'MQTT', init: () => MQTTService.initialize(), required: false },
    { name: 'Auth', init: () => AuthService.initialize(), required: true },
    { name: 'OrderOrchestrator', init: () => OrderOrchestratorService.initialize(), required: true },
    { name: 'EventLedger', init: () => EventLedgerService.initialize(), required: true },
    { name: 'Device', init: () => DeviceService.initialize(), required: true }
  ];

  logger.info('Initializing services...');
  
  for (const service of services) {
    try {
      logger.info(`Initializing ${service.name} service...`);
      await service.init();
      logger.info(`${service.name} service initialized successfully`);
    } catch (error) {
      logger.error(`Failed to initialize ${service.name} service`, { error });
      
      if (service.required) {
        logger.error(`${service.name} is a required service. Exiting...`);
        process.exit(1);
      } else {
        logger.warn(`${service.name} is optional. Continuing without it...`);
      }
    }
  }
  
  logger.info('Service initialization completed');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  
  try {
    await DatabaseService.close();
    await RedisService.close();
    await MQTTService.close();
    logger.info('Services closed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  
  try {
    await DatabaseService.close();
    await RedisService.close();
    await MQTTService.close();
    logger.info('Services closed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
});

// Start server
async function startServer() {
  // Validate environment first
  validateEnvironment();
  
  await initializeServices();
  
  const port = config.port || 3000;
  const server = app.listen(port, () => {
    logger.info(`Server running on port ${port}`, {
      port,
      environment: config.env,
      nodeVersion: process.version
    });
  });
  
  // Handle server errors
  server.on('error', (error: any) => {
    if (error.syscall !== 'listen') {
      throw error;
    }
    
    const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
    
    switch (error.code) {
      case 'EACCES':
        logger.error(`${bind} requires elevated privileges`);
        process.exit(1);
        break;
      case 'EADDRINUSE':
        logger.error(`${bind} is already in use`);
        process.exit(1);
        break;
      default:
        throw error;
    }
  });
}

// Start the application
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}

export default app;