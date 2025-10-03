import winston from 'winston';
import { config } from '../config';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for different log levels
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(logColors);

// Define the custom format for console logging
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message} ${
      info.metadata && Object.keys(info.metadata).length > 0 
        ? JSON.stringify(info.metadata, null, 2) 
        : ''
    }`
  )
);

// Define the custom format for file logging
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] })
);

// Create transport array
const transports: winston.transport[] = [];

// Console transport
if (config.logging.enableConsole) {
  transports.push(
    new winston.transports.Console({
      level: config.logging.level,
      format: consoleFormat,
    })
  );
}

// File transport
if (config.logging.enableFile) {
  transports.push(
    new winston.transports.File({
      filename: config.logging.filePath,
      level: config.logging.level,
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );
}

// Syslog transport for production
if (config.logging.enableSyslog && config.logging.syslogHost) {
  // @ts-ignore - winston-syslog types might not be available
  const Syslog = require('winston-syslog').Syslog;
  transports.push(
    new Syslog({
      host: config.logging.syslogHost,
      port: config.logging.syslogPort,
      protocol: 'udp',
      format: fileFormat,
    })
  );
}

// Create the logger
export const logger = winston.createLogger({
  level: config.logging.level,
  levels: logLevels,
  format: fileFormat,
  transports,
  exitOnError: false,
});

// Create specialized loggers for different contexts
export const securityLogger = logger.child({ 
  service: 'security',
  component: 'auth'
});

export const deviceLogger = logger.child({
  service: 'device',
  component: 'communication'
});

export const auditLogger = logger.child({
  service: 'audit',
  component: 'events'
});

export const performanceLogger = logger.child({
  service: 'performance',
  component: 'metrics'
});

// Helper functions for structured logging
export const logContext = {
  request: (req: any) => ({
    requestId: req.id,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
  }),
  
  security: (event: string, details: any = {}) => ({
    securityEvent: event,
    timestamp: new Date().toISOString(),
    ...details,
  }),
  
  device: (deviceId: string, event: string, details: any = {}) => ({
    deviceId,
    deviceEvent: event,
    timestamp: new Date().toISOString(),
    ...details,
  }),
  
  audit: (action: string, resource: string, details: any = {}) => ({
    auditAction: action,
    auditResource: resource,
    timestamp: new Date().toISOString(),
    ...details,
  }),
  
  performance: (operation: string, duration: number, details: any = {}) => ({
    operation,
    duration,
    timestamp: new Date().toISOString(),
    ...details,
  }),
};

// Security event logging helpers
export const logSecurityEvent = (event: string, details: any = {}) => {
  securityLogger.warn('Security event detected', logContext.security(event, details));
};

export const logFailedAuth = (attempt: any) => {
  securityLogger.warn('Authentication failed', {
    ...logContext.security('auth_failed'),
    ip: attempt.ip,
    userAgent: attempt.userAgent,
    reason: attempt.reason,
  });
};

export const logUnauthorizedAccess = (req: any, resource: string) => {
  securityLogger.error('Unauthorized access attempt', {
    ...logContext.security('unauthorized_access'),
    ...logContext.request(req),
    resource,
  });
};

// Device event logging helpers
export const logDeviceEvent = (deviceId: string, event: string, details: any = {}) => {
  deviceLogger.info('Device event', logContext.device(deviceId, event, details));
};

export const logDeviceError = (deviceId: string, error: any, details: any = {}) => {
  deviceLogger.error('Device error', {
    ...logContext.device(deviceId, 'error'),
    error: error.message,
    stack: error.stack,
    ...details,
  });
};

// Audit event logging helpers
export const logAuditEvent = (action: string, resource: string, userId?: string, details: any = {}) => {
  auditLogger.info('Audit event', {
    ...logContext.audit(action, resource),
    userId,
    ...details,
  });
};

// Performance logging helpers
export const logPerformance = (operation: string, startTime: number, details: any = {}) => {
  const duration = Date.now() - startTime;
  performanceLogger.info('Performance metric', logContext.performance(operation, duration, details));
  
  // Log slow operations as warnings
  if (duration > 5000) { // 5 seconds
    performanceLogger.warn('Slow operation detected', {
      ...logContext.performance(operation, duration, details),
      threshold: 5000,
    });
  }
};

// Create a timer helper for performance logging
export const createTimer = (operation: string) => {
  const startTime = Date.now();
  return {
    end: (details: any = {}) => logPerformance(operation, startTime, details),
  };
};

// Error logging with context
export const logError = (error: Error, context: any = {}) => {
  logger.error('Application error', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context,
  });
};

// Request logging middleware helper
export const createRequestLogger = () => {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    // Log request start
    logger.http('Request started', logContext.request(req));
    
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const duration = Date.now() - startTime;
      
      logger.http('Request completed', {
        ...logContext.request(req),
        statusCode: res.statusCode,
        duration,
      });
      
      // Log slow requests
      if (duration > 1000) {
        performanceLogger.warn('Slow request', {
          ...logContext.request(req),
          statusCode: res.statusCode,
          duration,
        });
      }
      
      originalEnd.apply(this, args);
    };
    
    next();
  };
};

export default logger;