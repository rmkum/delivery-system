import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger, logAuditEvent } from '../utils/logger';
import { RedisService } from './RedisService';
import { DatabaseService } from './DatabaseService';
import { AuthService } from './AuthService';
import { EventLedgerService } from './EventLedgerService';
import { DeviceService } from './DeviceService';

export interface Order {
  id: string;
  tenantId: string;
  siteId: string;
  externalRef: string; // Platform order ID (Uber/Deliveroo/etc)
  platform: 'uber_eats' | 'deliveroo' | 'just_eat' | 'independent';
  riderId?: string;
  status: 'created' | 'prepared' | 'assigned' | 'picked_up' | 'complete' | 'cancelled';
  preparedAt?: Date;
  assignedAt?: Date;
  pickedUpAt?: Date;
  qrCode?: string;
  otpCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Slot {
  id: string;
  shelfId: string;
  siteId: string;
  tenantId: string;
  index: number; // Physical slot number (1-12)
  state: 'empty' | 'reserved' | 'occupied' | 'unlocking' | 'open' | 'error';
  orderId?: string;
  reservedAt?: Date;
  occupiedAt?: Date;
  lastUnlockAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlotAssignmentRequest {
  orderId: string;
  siteId: string;
  tenantId: string;
  staffId: string;
  preferredSlotId?: string;
}

export interface UnlockRequest {
  orderId: string;
  riderId: string;
  slotId?: string; // Optional - can be determined from order
  deviceFingerprint?: string;
}

export class OrderOrchestratorService {
  static async initialize() {
    logger.info('Initializing OrderOrchestratorService...');
    
    // Start background cleanup tasks
    this.startCleanupTasks();
    
    logger.info('OrderOrchestratorService initialized successfully');
  }

  // Staff assigns a prepared order to an available slot
  static async assignOrderToSlot(request: SlotAssignmentRequest): Promise<{ slotId: string; success: boolean; qrCode?: string; otpCode?: string }> {
    try {
      logger.info('Processing slot assignment request', { orderId: request.orderId, siteId: request.siteId });

      // Validate order exists and is in correct state
      const order = await this.getOrder(request.orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status !== 'prepared') {
        throw new Error(`Order status ${order.status} is not valid for assignment`);
      }

      if (order.tenantId !== request.tenantId) {
        throw new Error('Order does not belong to this tenant');
      }

      // Find available slot
      let targetSlot: Slot | null = null;
      
      if (request.preferredSlotId) {
        // Check if preferred slot is available
        targetSlot = await this.getSlot(request.preferredSlotId);
        if (!targetSlot || targetSlot.state !== 'empty' || !targetSlot.isActive) {
          throw new Error('Preferred slot is not available');
        }
      } else {
        // Find next available slot
        targetSlot = await this.findAvailableSlot(request.siteId, request.tenantId);
        if (!targetSlot) {
          throw new Error('No available slots');
        }
      }

      // Reserve slot in Redis (atomic operation)
      const reservationSuccessful = await RedisService.reserveSlot(
        targetSlot.id,
        order.id,
        config.business.slotReservationTTL
      );

      if (!reservationSuccessful) {
        // Slot was taken by another request
        throw new Error('Slot reservation failed - slot taken by another request');
      }

      try {
        // Update slot state in database
        await this.updateSlotState(targetSlot.id, 'reserved', order.id);

        // Update order status
        await this.updateOrderStatus(order.id, 'assigned', targetSlot.id);

        // Generate QR code and OTP for fallback
        const qrCode = await this.generateOrderQRCode(order.id);
        const otpCode = await this.generateOrderOTP(order.id);

        // Log assignment event
        await EventLedgerService.logEvent({
          type: 'slot_assigned',
          tenantId: request.tenantId,
          siteId: request.siteId,
          shelfId: targetSlot.shelfId,
          slotId: targetSlot.id,
          orderId: order.id,
          userId: request.staffId,
          metadata: {
            slotIndex: targetSlot.index,
            platform: order.platform,
            externalRef: order.externalRef,
          },
        });

        // Send command to device to lock the slot
        await DeviceService.sendSlotLockCommand(targetSlot.shelfId, targetSlot.id);

        logAuditEvent('slot_assigned', 'order', request.staffId, {
          orderId: order.id,
          slotId: targetSlot.id,
          siteId: request.siteId,
        });

        logger.info('Slot assignment successful', {
          orderId: order.id,
          slotId: targetSlot.id,
          slotIndex: targetSlot.index,
        });

        return {
          slotId: targetSlot.id,
          success: true,
          qrCode,
          otpCode,
        };

      } catch (error) {
        // Rollback slot reservation on failure
        await RedisService.releaseSlot(targetSlot.id);
        throw error;
      }

    } catch (error) {
      logger.error('Slot assignment failed', { error, request });
      return {
        slotId: '',
        success: false,
      };
    }
  }

  // Rider requests to unlock their assigned parcel
  static async requestUnlock(request: UnlockRequest): Promise<{ unlockToken?: string; slotId?: string; success: boolean; error?: string }> {
    try {
      logger.info('Processing unlock request', { orderId: request.orderId, riderId: request.riderId });

      // Validate order and get assigned slot
      const order = await this.getOrder(request.orderId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      if (order.status !== 'assigned') {
        return { success: false, error: `Order status ${order.status} is not valid for pickup` };
      }

      // Get assigned slot
      const slot = await this.getOrderAssignedSlot(order.id);
      if (!slot) {
        return { success: false, error: 'No slot assigned to this order' };
      }

      if (slot.state !== 'reserved' && slot.state !== 'occupied') {
        return { success: false, error: `Slot state ${slot.state} is not valid for unlock` };
      }

      // Rate limiting per rider
      const rateLimitKey = `unlock_attempts:${request.riderId}`;
      const attempts = await RedisService.incrementRateLimit(rateLimitKey, 60000); // 1 minute window
      
      if (attempts > config.business.maxUnlockAttempts) {
        await EventLedgerService.logEvent({
          type: 'unlock_rate_limited',
          tenantId: order.tenantId,
          slotId: slot.id,
          orderId: order.id,
          riderId: request.riderId,
          metadata: { attempts },
        });
        
        return { success: false, error: 'Too many unlock attempts. Please wait.' };
      }

      // Verify rider identity (this would check platform integration)
      const isValidRider = await this.verifyRiderForOrder(request.riderId, order);
      if (!isValidRider) {
        await EventLedgerService.logEvent({
          type: 'unauthorized_unlock_attempt',
          tenantId: order.tenantId,
          slotId: slot.id,
          orderId: order.id,
          riderId: request.riderId,
          metadata: { reason: 'rider_not_authorized' },
        });
        
        return { success: false, error: 'Rider not authorized for this order' };
      }

      // Generate single-use unlock token
      const unlockToken = await AuthService.generateUnlockToken(
        order.id,
        request.riderId,
        slot.id,
        slot.shelfId,
        slot.siteId,
        order.tenantId
      );

      // Update slot state to unlocking
      await this.updateSlotState(slot.id, 'unlocking');

      // Log unlock request
      await EventLedgerService.logEvent({
        type: 'unlock_requested',
        tenantId: order.tenantId,
        siteId: slot.siteId,
        shelfId: slot.shelfId,
        slotId: slot.id,
        orderId: order.id,
        riderId: request.riderId,
        metadata: {
          deviceFingerprint: request.deviceFingerprint,
          slotIndex: slot.index,
        },
      });

      logAuditEvent('unlock_requested', 'order', request.riderId, {
        orderId: order.id,
        slotId: slot.id,
      });

      logger.info('Unlock token generated successfully', {
        orderId: order.id,
        slotId: slot.id,
        riderId: request.riderId,
      });

      return {
        unlockToken,
        slotId: slot.id,
        success: true,
      };

    } catch (error) {
      logger.error('Unlock request failed', { error, request });
      return { success: false, error: 'Internal server error' };
    }
  }

  // Process successful unlock confirmation from device
  static async confirmUnlock(slotId: string, orderId: string, riderId: string): Promise<void> {
    try {
      logger.info('Processing unlock confirmation', { slotId, orderId, riderId });

      // Update slot state to open
      await this.updateSlotState(slotId, 'open');

      // Update order status 
      await this.updateOrderStatus(orderId, 'picked_up');

      // Get slot and order details for logging
      const slot = await this.getSlot(slotId);
      const order = await this.getOrder(orderId);

      if (slot && order) {
        // Log successful pickup
        await EventLedgerService.logEvent({
          type: 'parcel_picked_up',
          tenantId: order.tenantId,
          siteId: slot.siteId,
          shelfId: slot.shelfId,
          slotId: slot.id,
          orderId: order.id,
          riderId,
          metadata: {
            slotIndex: slot.index,
            platform: order.platform,
            pickupDuration: Date.now() - (slot.reservedAt?.getTime() || 0),
          },
        });

        logAuditEvent('parcel_picked_up', 'order', riderId, {
          orderId,
          slotId,
        });
      }

      // Start cleanup timer to reset slot after pickup window
      setTimeout(async () => {
        await this.resetSlotAfterPickup(slotId);
      }, 30000); // 30 seconds to collect parcel

      logger.info('Unlock confirmation processed successfully', { slotId, orderId, riderId });

    } catch (error) {
      logger.error('Unlock confirmation failed', { error, slotId, orderId, riderId });
      throw error;
    }
  }

  // Handle failed unlock attempts
  static async handleUnlockFailure(slotId: string, orderId: string, riderId: string, reason: string): Promise<void> {
    try {
      // Reset slot state back to occupied/reserved
      const slot = await this.getSlot(slotId);
      if (slot) {
        const newState = slot.state === 'unlocking' ? 'occupied' : slot.state;
        await this.updateSlotState(slotId, newState);
      }

      // Log failed unlock
      const order = await this.getOrder(orderId);
      if (slot && order) {
        await EventLedgerService.logEvent({
          type: 'unlock_failed',
          tenantId: order.tenantId,
          siteId: slot.siteId,
          shelfId: slot.shelfId,
          slotId,
          orderId,
          riderId,
          metadata: { reason, slotIndex: slot.index },
        });
      }

      logger.warn('Unlock attempt failed', { slotId, orderId, riderId, reason });

    } catch (error) {
      logger.error('Failed to handle unlock failure', { error, slotId, orderId, riderId, reason });
    }
  }

  // Staff manual override (emergency unlock)
  static async emergencyUnlock(slotId: string, staffId: string, reason: string, totpCode: string): Promise<boolean> {
    try {
      // Verify staff step-up authentication
      const isValidStepUp = await AuthService.verifyStepUpAuth(staffId, totpCode);
      if (!isValidStepUp) {
        return false;
      }

      const slot = await this.getSlot(slotId);
      if (!slot) {
        return false;
      }

      // Send emergency unlock command to device
      await DeviceService.sendEmergencyUnlockCommand(slot.shelfId, slotId);

      // Update slot state
      await this.updateSlotState(slotId, 'open');

      // Log emergency unlock
      await EventLedgerService.logEvent({
        type: 'emergency_unlock',
        tenantId: slot.tenantId,
        siteId: slot.siteId,
        shelfId: slot.shelfId,
        slotId,
        orderId: slot.orderId,
        userId: staffId,
        metadata: { reason, slotIndex: slot.index },
      });

      logAuditEvent('emergency_unlock', 'slot', staffId, {
        slotId,
        reason,
      });

      logger.warn('Emergency unlock performed', { slotId, staffId, reason });

      return true;

    } catch (error) {
      logger.error('Emergency unlock failed', { error, slotId, staffId, reason });
      return false;
    }
  }

  // Private helper methods
  private static async findAvailableSlot(siteId: string, tenantId: string): Promise<Slot | null> {
    // Implementation would query database for available slots
    // For now, return null as placeholder
    return null;
  }

  private static async getOrder(orderId: string): Promise<Order | null> {
    // Implementation would query database
    return null;
  }

  private static async getSlot(slotId: string): Promise<Slot | null> {
    // Implementation would query database
    return null;
  }

  private static async getOrderAssignedSlot(orderId: string): Promise<Slot | null> {
    // Implementation would query database for slot assigned to order
    return null;
  }

  private static async updateSlotState(slotId: string, state: Slot['state'], orderId?: string): Promise<void> {
    // Implementation would update database
    logger.debug('Slot state updated', { slotId, state, orderId });
  }

  private static async updateOrderStatus(orderId: string, status: Order['status'], slotId?: string): Promise<void> {
    // Implementation would update database
    logger.debug('Order status updated', { orderId, status, slotId });
  }

  private static async generateOrderQRCode(orderId: string): Promise<string> {
    // Generate QR code containing order ID and validation hash
    const qrData = {
      orderId,
      timestamp: Date.now(),
      hash: this.generateOrderHash(orderId),
    };
    return Buffer.from(JSON.stringify(qrData)).toString('base64');
  }

  private static async generateOrderOTP(orderId: string): Promise<string> {
    // Generate 6-digit OTP and store in Redis with TTL
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await RedisService.setCache(`otp:${orderId}`, otp, 1800); // 30 minutes
    return otp;
  }

  private static generateOrderHash(orderId: string): string {
    // Simple hash for QR code validation
    return orderId.slice(-8);
  }

  private static async verifyRiderForOrder(riderId: string, order: Order): Promise<boolean> {
    // In production, this would verify with delivery platform APIs
    // For now, return true as placeholder
    return true;
  }

  private static async resetSlotAfterPickup(slotId: string): Promise<void> {
    try {
      const slot = await this.getSlot(slotId);
      if (slot && slot.state === 'open') {
        // Reset slot to empty state
        await this.updateSlotState(slotId, 'empty');
        
        // Release Redis reservation
        await RedisService.releaseSlot(slotId);
        
        logger.info('Slot reset after pickup', { slotId });
      }
    } catch (error) {
      logger.error('Failed to reset slot after pickup', { error, slotId });
    }
  }

  private static startCleanupTasks(): void {
    // Cleanup expired reservations every 5 minutes
    setInterval(async () => {
      try {
        await this.cleanupExpiredReservations();
      } catch (error) {
        logger.error('Cleanup task failed', { error });
      }
    }, 5 * 60 * 1000);
  }

  private static async cleanupExpiredReservations(): Promise<void> {
    // Implementation would find and cleanup expired slot reservations
    logger.debug('Running cleanup of expired reservations');
  }
}