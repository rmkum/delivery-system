import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  
  // Frontend URLs
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3001',
  
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'delivery_security',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    connectionPool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    },
  },
  
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: 'delivery-security:',
  },
  
  // MQTT configuration
  mqtt: {
    broker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clientId: process.env.MQTT_CLIENT_ID || 'delivery-security-backend',
    topics: {
      deviceEvents: 'devices/+/events',
      deviceCommands: 'devices/+/commands',
      deviceStatus: 'devices/+/status',
    },
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this',
    unlockTokenSecret: process.env.JWT_UNLOCK_SECRET || 'unlock-token-secret-change-this',
    accessTokenTTL: parseInt(process.env.JWT_ACCESS_TTL || '900', 10), // 15 minutes
    refreshTokenTTL: parseInt(process.env.JWT_REFRESH_TTL || '604800', 10), // 7 days
    unlockTokenTTL: parseInt(process.env.JWT_UNLOCK_TTL || '60', 10), // 60 seconds
    algorithm: 'ES256' as const, // Use elliptic curve for better security
  },
  
  // Encryption keys (should be stored in KMS in production)
  encryption: {
    algorithm: 'aes-256-gcm',
    keyDerivationRounds: 100000,
  },
  
  // CORS configuration
  cors: {
    allowedOrigins: process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001'],
  },
  
  // Rate limiting
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    authWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW || '900000', 10),
    authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
  },
  
  // Email configuration (for magic links)
  email: {
    service: process.env.EMAIL_SERVICE || 'gmail',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || 'noreply@delivery-security.com',
  },
  
  // SMS configuration (for OTP fallback)
  sms: {
    provider: process.env.SMS_PROVIDER || 'twilio',
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
  },
  
  // Device security
  device: {
    certificatePath: process.env.DEVICE_CERT_PATH || './certs',
    caPrivateKey: process.env.CA_PRIVATE_KEY_PATH || './certs/ca-key.pem',
    caCertificate: process.env.CA_CERT_PATH || './certs/ca-cert.pem',
    certificateValidityDays: parseInt(process.env.CERT_VALIDITY_DAYS || '1095', 10), // 3 years
  },
  
  // Security settings
  security: {
    enableTLS: process.env.ENABLE_TLS === 'true',
    tlsCertPath: process.env.TLS_CERT_PATH,
    tlsKeyPath: process.env.TLS_KEY_PATH,
    requireDeviceCerts: process.env.REQUIRE_DEVICE_CERTS !== 'false',
    clockSkewToleranceSeconds: parseInt(process.env.CLOCK_SKEW_TOLERANCE || '10', 10),
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    enableConsole: process.env.ENABLE_CONSOLE_LOGS !== 'false',
    enableFile: process.env.ENABLE_FILE_LOGS === 'true',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log',
    enableSyslog: process.env.ENABLE_SYSLOG === 'true',
    syslogHost: process.env.SYSLOG_HOST,
    syslogPort: parseInt(process.env.SYSLOG_PORT || '514', 10),
  },
  
  // Monitoring and observability
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
    enableTracing: process.env.ENABLE_TRACING === 'true',
    tracingEndpoint: process.env.TRACING_ENDPOINT,
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
  },
  
  // Business logic settings
  business: {
    maxUnlockAttempts: parseInt(process.env.MAX_UNLOCK_ATTEMPTS || '3', 10),
    unlockCooldownMs: parseInt(process.env.UNLOCK_COOLDOWN_MS || '300000', 10), // 5 minutes
    slotReservationTTL: parseInt(process.env.SLOT_RESERVATION_TTL || '1800', 10), // 30 minutes
    eventRetentionDays: parseInt(process.env.EVENT_RETENTION_DAYS || '90', 10),
    maxSlotsPerShelf: parseInt(process.env.MAX_SLOTS_PER_SHELF || '12', 10),
  },
  
  // External integrations
  integrations: {
    uberEats: {
      enabled: process.env.UBER_EATS_ENABLED === 'true',
      apiKey: process.env.UBER_EATS_API_KEY,
      webhookSecret: process.env.UBER_EATS_WEBHOOK_SECRET,
    },
    deliveroo: {
      enabled: process.env.DELIVEROO_ENABLED === 'true',
      apiKey: process.env.DELIVEROO_API_KEY,
      webhookSecret: process.env.DELIVEROO_WEBHOOK_SECRET,
    },
    justEat: {
      enabled: process.env.JUST_EAT_ENABLED === 'true',
      apiKey: process.env.JUST_EAT_API_KEY,
      webhookSecret: process.env.JUST_EAT_WEBHOOK_SECRET,
    },
  },
};

// Validation
const requiredEnvVars = [
  'JWT_SECRET',
  'JWT_UNLOCK_SECRET',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Required environment variable ${envVar} is not set`);
  }
}

// Export individual modules for easier imports
export { config as default };