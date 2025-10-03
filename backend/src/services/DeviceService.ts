import { config } from '../config';
import { logger, logDeviceEvent, logDeviceError } from '../utils/logger';
import { MQTTService } from './MQTTService';
import { RedisService } from './RedisService';
import { EventLedgerService } from './EventLedgerService';

export interface Device {
  id: string;
  shelfId: string;
  siteId: string;
  tenantId: string;
  name: string;
  model: string;
  firmwareVersion: string;
  lastSeenAt?: Date;
  isOnline: boolean;
  status: 'active' | 'inactive' | 'maintenance' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceCommand {
  id: string;
  type: 'unlock_slot' | 'lock_slot' | 'emergency_unlock' | 'status_request' | 'firmware_update';
  deviceId: string;
  slotId?: string;
  payload?: any;
  createdAt: Date;
  expiresAt: Date;
}

export class DeviceService {
  static async initialize() {
    logger.info('Initializing DeviceService...');
    
    // Subscribe to device events
    await this.subscribeToDeviceEvents();
    
    // Start device health monitoring
    this.startHealthMonitoring();
    
    logger.info('DeviceService initialized successfully');
  }

  static async sendSlotLockCommand(shelfId: string, slotId: string): Promise<void> {
    try {
      const command: DeviceCommand = {
        id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'lock_slot',
        deviceId: shelfId,
        slotId,
        payload: { slotId },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30000), // 30 seconds
      };

      await MQTTService.publishCommand(shelfId, command);
      
      logDeviceEvent(shelfId, 'lock_command_sent', { slotId });
    } catch (error) {
      logDeviceError(shelfId, error as Error, { slotId });
      throw error;
    }
  }

  static async sendEmergencyUnlockCommand(shelfId: string, slotId: string): Promise<void> {
    try {
      const command: DeviceCommand = {
        id: `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'emergency_unlock',
        deviceId: shelfId,
        slotId,
        payload: { slotId, emergency: true },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60000), // 60 seconds
      };

      await MQTTService.publishCommand(shelfId, command);
      
      logDeviceEvent(shelfId, 'emergency_unlock_sent', { slotId });
    } catch (error) {
      logDeviceError(shelfId, error as Error, { slotId });
      throw error;
    }
  }

  static async sendStatusRequest(deviceId: string): Promise<void> {
    try {
      const command: DeviceCommand = {
        id: `status_${Date.now()}`,
        type: 'status_request',
        deviceId,
        payload: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10000), // 10 seconds
      };

      await MQTTService.publishCommand(deviceId, command);
      
      logDeviceEvent(deviceId, 'status_request_sent', {});
    } catch (error) {
      logDeviceError(deviceId, error as Error, {});
      throw error;
    }
  }

  static async handleDeviceEvent(deviceId: string, event: any): Promise<void> {
    try {
      logger.debug('Device event received', { deviceId, event });

      // Update device status
      await RedisService.setDeviceStatus(deviceId, {
        lastSeen: new Date(),
        ...event,
      });

      // Log to event ledger
      await EventLedgerService.logEvent({
        type: `device_${event.type}`,
        deviceId,
        metadata: event,
        tenantId: event.tenantId || 'unknown',
      });

      // Handle specific event types
      switch (event.type) {
        case 'unlock_success':
          await this.handleUnlockSuccess(deviceId, event);
          break;
        case 'unlock_failed':
          await this.handleUnlockFailed(deviceId, event);
          break;
        case 'tamper_detected':
          await this.handleTamperDetected(deviceId, event);
          break;
        case 'door_opened':
        case 'door_closed':
          await this.handleDoorEvent(deviceId, event);
          break;
      }

    } catch (error) {
      logDeviceError(deviceId, error as Error, { event });
    }
  }

  private static async subscribeToDeviceEvents(): Promise<void> {
    // Subscribe to device event topics via MQTT
    await MQTTService.subscribe('devices/+/events', (message, topic) => {
      const deviceId = topic.split('/')[1];
      this.handleDeviceEvent(deviceId, message);
    });
  }

  private static async handleUnlockSuccess(deviceId: string, event: any): Promise<void> {
    logDeviceEvent(deviceId, 'unlock_success', {
      slotId: event.slotId,
      orderId: event.orderId,
    });
  }

  private static async handleUnlockFailed(deviceId: string, event: any): Promise<void> {
    logDeviceEvent(deviceId, 'unlock_failed', {
      slotId: event.slotId,
      reason: event.reason,
    });
  }

  private static async handleTamperDetected(deviceId: string, event: any): Promise<void> {
    logger.warn('Tamper detected on device', { deviceId, event });
    
    // Disable remote unlocks until manual reset
    await RedisService.setCache(`device_tamper:${deviceId}`, true, 24 * 3600); // 24 hours
  }

  private static async handleDoorEvent(deviceId: string, event: any): Promise<void> {
    logDeviceEvent(deviceId, event.type, {
      slotId: event.slotId,
      timestamp: event.timestamp,
    });
  }

  private static startHealthMonitoring(): void {
    setInterval(async () => {
      try {
        await this.checkDeviceHealth();
      } catch (error) {
        logger.error('Device health check failed', { error });
      }
    }, 60000); // Every minute
  }

  private static async checkDeviceHealth(): Promise<void> {
    // Implementation would check device heartbeats and alert on offline devices
    logger.debug('Device health check completed');
  }
}