# 🚚 Delivery Security System

A comprehensive full-stack delivery parcel security system with smart locker controllers, mobile applications, and backend services designed to solve parcel theft in restaurants through 80% theft reduction.

## 🎯 Project Overview

This system provides secure parcel delivery through smart lockable shelves with the following key features:

- **Smart Locker Controllers**: ESP32-based controllers with solenoid locks and sensors
- **Secure Authentication**: JWT tokens, device certificates, and magic link authentication
- **Mobile Applications**: React Native apps for delivery riders and restaurant staff
- **Admin Dashboard**: Real-time monitoring and analytics web interface
- **Backend API**: Node.js/TypeScript with comprehensive audit logging
- **Device Communication**: MQTT protocol for real-time device management

## 🏗️ System Architecture

### Backend Services (`/backend`)
- **Auth Service**: Rider authentication, staff login, JWT token management
- **Order Orchestrator**: Smart slot assignment, unlock token generation
- **Event Ledger**: Immutable audit logs for all unlock attempts
- **Device API**: Secure MQTT/HTTPS communication with shelf controllers

### Mobile Applications (`/mobile`)
- **Rider App**: QR scanning, OTP fallback, unlock requests
- **Staff App**: Slot assignment, dashboard, manual overrides
- React Native cross-platform with offline support

### Device Firmware (`/firmware`)
- **ESP32 Controllers**: JWT verification, actuator control, sensor monitoring
- **Security Features**: Client certificates, tamper detection, fail-secure locks
- **Communication**: MQTT over TLS with backend services

### Web Dashboard (`/dashboard`)
- **Admin Interface**: Real-time occupancy monitoring
- **Analytics**: Success rates, error tracking, security alerts
- **Management**: Device provisioning, user administration

### Infrastructure (`/infrastructure`)
- **Development**: Docker Compose environment
- **Production**: Kubernetes deployment manifests
- **Security**: Certificate authority, monitoring, alerting

## 🔐 Security Features

- ✅ **Single-use JWT tokens** with 60-second TTL
- ✅ **Device mutual TLS** authentication
- ✅ **Tamper detection** with automatic lockout
- ✅ **Rate limiting** and abuse prevention
- ✅ **End-to-end audit logging**
- ✅ **Secure OTA firmware** updates

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- Docker and Docker Compose
- React Native development environment
- Arduino IDE or PlatformIO for firmware

### Installation

```bash
# Install all dependencies
npm run install:all

# Start development environment
npm run dev

# Build all components
npm run build
```

### Development Environment

```bash
# Start backend and dashboard
npm run dev

# Mobile development (separate terminal)
cd mobile
npm run android  # or npm run ios
```

## 📱 Mobile Apps

### Rider App Features
- QR code scanning for parcel pickup
- OTP fallback for poor lighting/offline scenarios
- Visual guidance with LED slot indicators
- Offline token caching (60s)
- Push notifications for order updates

### Staff App Features
- Quick slot assignment via bag QR scan
- Real-time dashboard of occupied slots
- Manual override with MFA authentication
- Audit log access

## 🔧 Hardware Requirements

### Smart Shelf Controller
- **Controller**: ESP32 with secure storage
- **Locks**: Solenoid latches (fail-secure, 50N+ holding force)
- **Sensors**: Reed switches (door), optional load cells
- **Indicators**: Tri-color LEDs per slot
- **Power**: PoE preferred, 12-24V backup
- **Connectivity**: Ethernet primary, Wi-Fi fallback

### Installation
- Retrofit existing shelf units (4-12 cubbies)
- Tamper-proof enclosure with service access
- Certificate provisioning during installation

## 📊 Performance Targets

- **Unlock Time**: < 2 seconds from valid request
- **QR Scan Success**: ≥ 95% first attempt
- **Rider Pickup**: < 15 seconds median
- **Staff Assignment**: < 10 seconds
- **Parcel Loss Reduction**: ≥ 80% within 3 months

## 🔍 Monitoring & Analytics

### Real-time Metrics
- Slot occupancy percentage
- Unlock success/failure rates
- Device health and connectivity
- Security events and alerts

### Audit & Compliance
- Immutable event ledger
- 90-day retention policy
- Compliance reporting
- Incident response workflows

## 📚 Documentation

- [API Documentation](./backend/docs/api.md)
- [Security Model](./docs/security.md)
- [Deployment Guide](./infrastructure/README.md)
- [Hardware Installation](./firmware/README.md)

## 🧪 Testing

```bash
# Run all tests
npm test

# Component-specific testing
npm run test:backend
npm run test:dashboard
cd mobile && npm test
```

## 🚀 Deployment

### Development
```bash
docker-compose up -d
```

### Production
```bash
kubectl apply -f infrastructure/k8s/
```

## 📞 Support

For technical support, security issues, or feature requests, please contact the development team.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.