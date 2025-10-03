// QR Code generation utility for packages and slots
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

export class QRCodeService {
  
  /**
   * Generate QR code for a package when assigned to a slot
   * Contains: orderId, slotId, timestamp, verification hash
   */
  static async generatePackageQR(orderId: string, slotId: string, riderId?: string): Promise<string> {
    const qrData = {
      type: 'PACKAGE',
      orderId,
      slotId,
      riderId: riderId || null,
      timestamp: new Date().toISOString(),
      hash: this.generateVerificationHash(orderId, slotId),
      // For web demo - use tracking number as scannable content
      trackingNumber: `TRK${orderId.slice(-6).toUpperCase()}`
    };
    
    const qrCodeString = JSON.stringify(qrData);
    
    try {
      // Generate QR code as data URL (base64 image)
      const qrCodeDataURL = await QRCode.toDataURL(qrCodeString, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        width: 256
      });
      
      return qrCodeDataURL;
    } catch (error) {
      console.error('QR Code generation failed:', error);
      throw new Error('Failed to generate package QR code');
    }
  }

  /**
   * Generate QR code for a physical slot (printed and attached to shelf)
   * Contains: slotId, siteId, shelf location info
   */
  static async generateSlotQR(slotId: string, siteId: string, shelfId: string): Promise<string> {
    const qrData = {
      type: 'SLOT',
      slotId,
      siteId,
      shelfId,
      // Physical location info for maintenance
      location: `Site:${siteId} Shelf:${shelfId} Slot:${slotId}`,
    };
    
    const qrCodeString = JSON.stringify(qrData);
    
    try {
      const qrCodeDataURL = await QRCode.toDataURL(qrCodeString, {
        errorCorrectionLevel: 'H', // Higher error correction for physical labels
        type: 'image/png',
        quality: 0.95,
        margin: 2,
        width: 128
      });
      
      return qrCodeDataURL;
    } catch (error) {
      console.error('Slot QR Code generation failed:', error);
      throw new Error('Failed to generate slot QR code');
    }
  }

  /**
   * Parse and validate scanned QR code data
   */
  static parseQRCode(qrCodeString: string): any {
    try {
      const qrData = JSON.parse(qrCodeString);
      
      // Validate required fields based on type
      if (qrData.type === 'PACKAGE') {
        if (!qrData.orderId || !qrData.slotId || !qrData.hash) {
          throw new Error('Invalid package QR code format');
        }
        
        // Verify hash
        const expectedHash = this.generateVerificationHash(qrData.orderId, qrData.slotId);
        if (qrData.hash !== expectedHash) {
          throw new Error('QR code verification failed - invalid hash');
        }
      } else if (qrData.type === 'SLOT') {
        if (!qrData.slotId || !qrData.siteId) {
          throw new Error('Invalid slot QR code format');
        }
      }
      
      return qrData;
    } catch (error) {
      // If it's not JSON, treat as legacy tracking number
      if (qrCodeString.startsWith('TRK')) {
        return {
          type: 'LEGACY_TRACKING',
          trackingNumber: qrCodeString,
          orderId: qrCodeString // For demo purposes
        };
      }
      
      throw new Error('Invalid QR code format');
    }
  }

  /**
   * Generate verification hash for QR code integrity
   */
  private static generateVerificationHash(orderId: string, slotId: string): string {
    const crypto = require('crypto');
    const data = `${orderId}:${slotId}:DELIVERY_SECURITY`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Generate demo QR codes for testing (web version)
   */
  static generateDemoTrackingNumbers(): string[] {
    return [
      'TRK001234',
      'TRK005678', 
      'TRK009876',
      'TRK004321',
      'TRK007890'
    ];
  }

  /**
   * For web demo - simulate QR scanning with tracking numbers
   */
  static simulateQRScan(): string {
    const demoNumbers = this.generateDemoTrackingNumbers();
    const randomIndex = Math.floor(Math.random() * demoNumbers.length);
    return demoNumbers[randomIndex];
  }
}