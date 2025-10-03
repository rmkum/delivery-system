# ESP32 Smart Shelf Controller Firmware

This directory contains the ESP32 firmware for the smart shelf controllers that manage the secure parcel storage slots.

## Hardware Requirements

- **Microcontroller**: ESP32-WROOM-32 or ESP32-S3
- **Memory**: 4MB Flash minimum, 8MB recommended
- **Connectivity**: Wi-Fi (primary), Ethernet (optional via W5500)
- **Security**: Hardware security module or secure storage partition
- **Power**: 12-24V DC input with PoE support

## Features

### Security
- ✅ **Client Certificate Authentication**: Mutual TLS with backend
- ✅ **JWT Token Verification**: Local validation of unlock tokens  
- ✅ **Secure Boot**: Verified firmware loading
- ✅ **Encrypted Storage**: Device credentials and keys
- ✅ **Tamper Detection**: Physical security monitoring

### Actuator Control
- ✅ **Solenoid Locks**: Fail-secure electromagnetic latches
- ✅ **Motor Control**: Servo/stepper for mechanical latches
- ✅ **LED Indicators**: Tri-color status per slot
- ✅ **Buzzer Alerts**: Audio feedback for events

### Sensor Monitoring
- ✅ **Door Sensors**: Reed switches for open/close detection
- ✅ **Weight Sensors**: Load cells for parcel presence (optional)
- ✅ **Tamper Switches**: Enclosure security monitoring
- ✅ **Environmental**: Temperature/humidity monitoring

### Communication
- ✅ **MQTT over TLS**: Primary communication protocol
- ✅ **HTTP REST**: Fallback API communication
- ✅ **WebSocket**: Real-time event streaming
- ✅ **OTA Updates**: Secure firmware over-the-air updates

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ESP32 Controller                        │
├─────────────────────────────────────────────────────────────┤
│  Application Layer                                          │
│  ├─ Unlock Handler     ├─ Sensor Monitor                   │
│  ├─ Event Logger       ├─ Status Reporter                  │
│  └─ OTA Manager        └─ Configuration                    │
├─────────────────────────────────────────────────────────────┤
│  Security Layer                                             │
│  ├─ JWT Verifier       ├─ Certificate Store               │
│  ├─ TLS Manager        ├─ Tamper Monitor                  │
│  └─ Key Storage        └─ Secure Boot                     │
├─────────────────────────────────────────────────────────────┤
│  Communication Layer                                        │
│  ├─ MQTT Client        ├─ HTTP Client                     │
│  ├─ WiFi Manager       ├─ Ethernet (optional)             │
│  └─ WebSocket Client   └─ Network Monitor                 │
├─────────────────────────────────────────────────────────────┤
│  Hardware Abstraction Layer                                 │
│  ├─ GPIO Control       ├─ PWM Control                      │
│  ├─ ADC Reading        ├─ I2C/SPI Bus                      │
│  └─ Timer Management   └─ Interrupt Handling              │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
firmware/
├── src/
│   ├── main.cpp                    # Main application entry point
│   ├── config/
│   │   ├── config.h               # Hardware and network configuration
│   │   ├── pins.h                 # GPIO pin definitions
│   │   └── certificates.h         # Embedded certificates
│   ├── security/
│   │   ├── jwt_verifier.cpp       # JWT token validation
│   │   ├── tls_manager.cpp        # TLS/SSL management
│   │   ├── certificate_store.cpp  # X.509 certificate handling
│   │   └── tamper_monitor.cpp     # Physical security monitoring
│   ├── communication/
│   │   ├── mqtt_client.cpp        # MQTT communication
│   │   ├── http_client.cpp        # HTTP REST client
│   │   ├── wifi_manager.cpp       # WiFi connection management
│   │   └── websocket_client.cpp   # WebSocket communication
│   ├── hardware/
│   │   ├── actuator_control.cpp   # Lock/unlock mechanisms
│   │   ├── sensor_monitor.cpp     # Door/weight/tamper sensors
│   │   ├── led_controller.cpp     # Status indicator LEDs
│   │   └── buzzer_control.cpp     # Audio alerts
│   ├── application/
│   │   ├── unlock_handler.cpp     # Core unlock logic
│   │   ├── event_logger.cpp       # Event management
│   │   ├── status_reporter.cpp    # Health monitoring
│   │   └── ota_manager.cpp        # Firmware updates
│   └── utils/
│       ├── logger.cpp             # Logging utilities
│       ├── crypto_utils.cpp       # Cryptographic helpers
│       └── time_sync.cpp          # NTP time synchronization
├── include/                       # Header files
├── lib/                          # External libraries
├── test/                         # Unit tests
├── platformio.ini                # PlatformIO configuration
├── partitions.csv               # Flash memory partitions
└── README.md                    # This file
```

## Configuration

### Device Provisioning
Each device requires unique certificates and configuration:

1. **Device Certificate**: X.509 client certificate for TLS authentication
2. **Private Key**: Corresponding private key (stored in secure partition)
3. **CA Certificate**: Root certificate for backend verification
4. **Device ID**: Unique identifier for MQTT topics and API calls
5. **Network Config**: WiFi credentials, MQTT broker details

### Security Settings
```cpp
// Security configuration
#define ENABLE_SECURE_BOOT      1
#define ENABLE_FLASH_ENCRYPTION 1
#define JWT_VERIFY_SIGNATURE    1
#define REQUIRE_TLS_CLIENT_CERT 1
#define TAMPER_LOCKOUT_ENABLED  1

// Token validation
#define JWT_MAX_SKEW_SECONDS    10
#define JWT_CACHE_SIZE          16
#define TOKEN_BLACKLIST_SIZE    32
```

### Hardware Configuration
```cpp
// Slot configuration
#define MAX_SLOTS               12
#define SLOT_LOCK_HOLD_TIME_MS  500
#define DOOR_OPEN_TIMEOUT_MS    30000
#define SENSOR_DEBOUNCE_MS      50

// Communication
#define MQTT_KEEPALIVE_SEC      60
#define HTTP_TIMEOUT_MS         5000
#define WIFI_RECONNECT_DELAY_MS 30000
```

## Build Instructions

### Prerequisites
- **PlatformIO Core** or **Arduino IDE**
- **ESP-IDF v4.4+** (for advanced features)
- **OpenSSL** (for certificate generation)

### Using PlatformIO
```bash
# Install PlatformIO
pip install platformio

# Build firmware
pio run

# Upload to device
pio run --target upload

# Monitor serial output
pio device monitor
```

### Using Arduino IDE
1. Install ESP32 board support
2. Install required libraries (see platformio.ini)
3. Open `src/main.cpp` in Arduino IDE
4. Select ESP32 board and upload

### Certificate Generation
```bash
# Generate device certificate (run during manufacturing)
./scripts/generate_device_cert.sh <device_id>

# This creates:
# - certs/device_<id>.crt
# - certs/device_<id>.key
# - include/certificates.h (embedded certs)
```

## Testing

### Unit Tests
```bash
# Run all tests
pio test

# Run specific test
pio test --filter test_jwt_verification
```

### Integration Tests
```bash
# Test with mock backend
./scripts/test_integration.sh

# Load test with multiple unlock requests
./scripts/load_test.sh
```

## Production Deployment

### Security Checklist
- [ ] Secure boot enabled and verified
- [ ] Flash encryption enabled
- [ ] Debug interfaces disabled
- [ ] Unique device certificates installed
- [ ] Default passwords changed
- [ ] Tamper detection tested
- [ ] OTA signature verification enabled

### Quality Assurance
- [ ] All slots unlock/lock correctly
- [ ] Sensors detect door open/close
- [ ] LED indicators function properly
- [ ] Network connectivity stable
- [ ] Power consumption within limits
- [ ] Temperature/humidity monitoring

### Installation Process
1. **Physical Installation**: Mount controller, connect actuators and sensors
2. **Certificate Provisioning**: Install unique device certificates
3. **Network Configuration**: Set WiFi credentials and backend endpoints
4. **Device Registration**: Register device with backend services
5. **Testing**: Verify all functionality end-to-end
6. **Monitoring**: Enable logging and health monitoring

## Troubleshooting

### Common Issues
- **Connection Failed**: Check network credentials and backend availability
- **Certificate Error**: Verify device certificate is valid and properly installed
- **Unlock Failed**: Check JWT token format and signature verification
- **Sensor Malfunction**: Verify wiring and calibration
- **OTA Failed**: Check firmware signature and available flash space

### Debug Commands
```cpp
// Serial console commands (development only)
debug_status        // Show system status
debug_network       // Network connection info
debug_certificates  // Certificate validation
debug_sensors       // Sensor readings
debug_unlock <slot> // Manual unlock test
```

### Monitoring
- **System Logs**: UART output and MQTT event publishing
- **Health Metrics**: Memory usage, network quality, sensor status
- **Security Events**: Failed authentications, tamper alerts
- **Performance**: Unlock latency, network round-trip times

## License

MIT License - see [LICENSE](../LICENSE) file for details.

## Support

For firmware issues, hardware problems, or security questions, contact the development team.