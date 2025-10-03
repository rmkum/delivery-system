import mqtt from 'mqtt';
import { config } from '../config';
import { logger } from '../utils/logger';
import { DeviceCommand } from './DeviceService';

export class MQTTService {
  private static client: mqtt.MqttClient;
  private static isConnected: boolean = false;
  private static subscriptions: Map<string, (message: any, topic: string) => void> = new Map();

  static async initialize() {
    logger.info('Initializing MQTT service...');
    
    try {
      this.client = mqtt.connect(config.mqtt.broker, {
        clientId: config.mqtt.clientId,
        username: config.mqtt.username,
        password: config.mqtt.password,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
      });

      this.client.on('connect', () => {
        logger.info('MQTT client connected');
        this.isConnected = true;
        this.resubscribeToTopics();
      });

      this.client.on('error', (error) => {
        logger.error('MQTT client error', { error });
        this.isConnected = false;
      });

      this.client.on('offline', () => {
        logger.warn('MQTT client offline');
        this.isConnected = false;
      });

      this.client.on('reconnect', () => {
        logger.info('MQTT client reconnecting...');
      });

      this.client.on('message', (topic, payload) => {
        this.handleMessage(topic, payload);
      });

      logger.info('MQTT service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MQTT service', { error });
      throw error;
    }
  }

  static async close() {
    if (this.client && this.isConnected) {
      await this.client.endAsync();
      this.isConnected = false;
      logger.info('MQTT connection closed');
    }
  }

  static async publishCommand(deviceId: string, command: DeviceCommand): Promise<void> {
    if (!this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    const topic = `devices/${deviceId}/commands`;
    const payload = JSON.stringify(command);

    await this.client.publishAsync(topic, payload, {
      qos: 1, // At least once delivery
      retain: false,
    });

    logger.debug('MQTT command published', { deviceId, commandType: command.type });
  }

  static async subscribe(topicPattern: string, callback: (message: any, topic: string) => void): Promise<void> {
    if (!this.isConnected) {
      // Store subscription for later when connected
      this.subscriptions.set(topicPattern, callback);
      return;
    }

    await this.client.subscribeAsync(topicPattern, { qos: 1 });
    this.subscriptions.set(topicPattern, callback);
    
    logger.debug('MQTT subscription added', { topicPattern });
  }

  static async unsubscribe(topicPattern: string): Promise<void> {
    if (this.isConnected) {
      await this.client.unsubscribeAsync(topicPattern);
    }
    
    this.subscriptions.delete(topicPattern);
    logger.debug('MQTT subscription removed', { topicPattern });
  }

  static async publish(topic: string, message: any, options?: {
    qos?: 0 | 1 | 2;
    retain?: boolean;
  }): Promise<void> {
    if (!this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    const payload = JSON.stringify(message);
    
    await this.client.publishAsync(topic, payload, {
      qos: options?.qos || 1,
      retain: options?.retain || false,
    });

    logger.debug('MQTT message published', { topic });
  }

  private static handleMessage(topic: string, payload: Buffer): void {
    try {
      const message = JSON.parse(payload.toString());
      
      // Find matching subscription
      for (const [pattern, callback] of this.subscriptions) {
        if (this.topicMatches(topic, pattern)) {
          callback(message, topic);
        }
      }
    } catch (error) {
      logger.error('Error handling MQTT message', { error, topic });
    }
  }

  private static topicMatches(topic: string, pattern: string): boolean {
    // Simple wildcard matching for MQTT topics
    const topicParts = topic.split('/');
    const patternParts = pattern.split('/');

    if (patternParts.length !== topicParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
        return false;
      }
    }

    return true;
  }

  private static async resubscribeToTopics(): Promise<void> {
    for (const [topicPattern] of this.subscriptions) {
      try {
        await this.client.subscribeAsync(topicPattern, { qos: 1 });
        logger.debug('Resubscribed to topic', { topicPattern });
      } catch (error) {
        logger.error('Failed to resubscribe to topic', { error, topicPattern });
      }
    }
  }

  static getConnectionStatus(): boolean {
    return this.isConnected;
  }

  static async healthCheck(): Promise<boolean> {
    return this.isConnected;
  }
}