import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// API Configuration
const API_BASE_URL = 'http://localhost:3000';

// API Service
class ApiService {
  static async get(endpoint) {
    try {
      const response = await axios.get(`${API_BASE_URL}${endpoint}`);
      return response.data;
    } catch (error) {
      console.log('API Error (using mock data):', error.message);
      // Return mock data for development
      if (endpoint.includes('/orders/')) {
        return {
          id: '1',
          trackingNumber: 'TRK123456',
          status: 'pending',
          otp: '123456'
        };
      }
      if (endpoint.includes('/slots')) {
        return [
          { id: '1', status: 'occupied', orderId: 'ORD001' },
          { id: '2', status: 'empty' },
          { id: '3', status: 'occupied', orderId: 'ORD002' },
        ];
      }
      return [];
    }
  }

  static async post(endpoint, data) {
    try {
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, data);
      return response.data;
    } catch (error) {
      console.log('API Error (using mock response):', error.message);
      return { success: true, order: { ...data, id: '1' } };
    }
  }

  static async put(endpoint, data) {
    try {
      const response = await axios.put(`${API_BASE_URL}${endpoint}`, data);
      return response.data;
    } catch (error) {
      console.log('API Error (using mock response):', error.message);
      return { success: true, ...data };
    }
  }
}

// Main App Component
function App() {
  const [activeTab, setActiveTab] = useState('rider');
  const [currentScreen, setCurrentScreen] = useState('home');
  const [screenData, setScreenData] = useState(null);

  const navigateToScreen = (screen, data) => {
    setCurrentScreen(screen);
    setScreenData(data);
  };

  const goBack = () => {
    setCurrentScreen('home');
    setScreenData(null);
  };

  const renderRiderScreens = () => {
    switch (currentScreen) {
      case 'qr':
        return <QRScannerScreen onBack={goBack} onOrderFound={navigateToScreen} />;
      case 'otp':
        return <OTPScreen onBack={goBack} onOrderFound={navigateToScreen} />;
      case 'orderDetails':
        return <OrderDetailsScreen order={screenData} onBack={goBack} />;
      default:
        return <RiderHomeScreen onNavigate={navigateToScreen} />;
    }
  };

  const renderStaffScreens = () => {
    switch (currentScreen) {
      case 'slots':
        return <SlotManagementScreen onBack={goBack} />;
      case 'assignments':
        return <OrderAssignmentScreen onBack={goBack} />;
      default:
        return <StaffHomeScreen onNavigate={navigateToScreen} />;
    }
  };

  return (
    <div className="app-container">
      {/* Tab Content */}
      {activeTab === 'rider' ? renderRiderScreens() : renderStaffScreens()}
      
      {/* Tab Bar */}
      <div className="tab-bar">
        <button
          className={`tab ${activeTab === 'rider' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('rider');
            setCurrentScreen('home');
          }}
        >
          <div className="tab-icon">🚴</div>
          <div className="tab-text">Rider</div>
        </button>
        
        <button
          className={`tab ${activeTab === 'staff' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('staff');
            setCurrentScreen('home');
          }}
        >
          <div className="tab-icon">🏢</div>
          <div className="tab-text">Staff</div>
        </button>
      </div>
    </div>
  );
}

// QR Scanner Screen (Simulated for web)
function QRScannerScreen({ onBack, onOrderFound }) {
  const [scanned, setScanned] = useState(false);

  const simulateQRScan = () => {
    setScanned(true);
    setTimeout(() => {
      const trackingNumber = 'TRK' + Math.floor(Math.random() * 1000000);
      alert(`QR Code Scanned: ${trackingNumber}`);
      processOrder(trackingNumber);
    }, 1000);
  };

  const processOrder = async (trackingNumber) => {
    try {
      const order = await ApiService.get(`/api/orders/${trackingNumber}`);
      onOrderFound('orderDetails', { ...order, trackingNumber });
    } catch (error) {
      alert('Order not found or network error');
      setScanned(false);
    }
  };

  return (
    <div className="screen">
      <div className="header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <h2>Scan QR Code</h2>
      </div>
      
      <div className="scanner-area">
        <div className="scanner-box">
          <div className="scanner-overlay">
            {!scanned ? (
              <>
                <div className="scanner-frame"></div>
                <p>Point camera at QR code</p>
                <button className="scan-button" onClick={simulateQRScan}>
                  📱 Simulate QR Scan
                </button>
              </>
            ) : (
              <p>Processing...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// OTP Entry Screen
function OTPScreen({ onBack, onOrderFound }) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');

  const handleVerifyOTP = async () => {
    if (!otp || !trackingNumber) {
      alert('Please enter both tracking number and OTP');
      return;
    }

    setLoading(true);
    try {
      const result = await ApiService.post('/api/orders/verify-otp', {
        trackingNumber,
        otp
      });
      
      alert('OTP verified successfully!');
      onOrderFound('orderDetails', { ...result.order, trackingNumber, otp });
    } catch (error) {
      alert('Invalid OTP or tracking number');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen">
      <div className="header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <h2>Enter OTP</h2>
      </div>
      
      <div className="content">
        <h1>🔢 Enter OTP</h1>
        <p>Verify parcel pickup/delivery</p>

        <div className="input-container">
          <label>Tracking Number</label>
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Enter tracking number"
          />
        </div>

        <div className="input-container">
          <label>OTP Code</label>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter 6-digit OTP"
            maxLength={6}
          />
        </div>

        <button
          className={`button ${loading ? 'disabled' : ''}`}
          onClick={handleVerifyOTP}
          disabled={loading}
        >
          {loading ? 'Verifying...' : 'Verify OTP'}
        </button>
      </div>
    </div>
  );
}

// Order Details Screen
function OrderDetailsScreen({ order, onBack }) {
  const [currentOrder, setCurrentOrder] = useState(order);
  const [loading, setLoading] = useState(false);

  const updateOrderStatus = async (newStatus) => {
    setLoading(true);
    try {
      await ApiService.put(`/api/orders/${currentOrder.id}`, {
        status: newStatus
      });
      setCurrentOrder({ ...currentOrder, status: newStatus });
      alert(`Order status updated to ${newStatus}`);
    } catch (error) {
      alert('Failed to update order status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen">
      <div className="header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <h2>Order Details</h2>
      </div>
      
      <div className="content">
        <h1>📦 Order Details</h1>
        
        <div className="details-card">
          <div className="detail-row">
            <span className="detail-label">Tracking Number:</span>
            <span className="detail-value">{currentOrder.trackingNumber}</span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Status:</span>
            <span className="detail-value status">{currentOrder.status}</span>
          </div>
          
          {currentOrder.slotId && (
            <div className="detail-row">
              <span className="detail-label">Assigned Slot:</span>
              <span className="detail-value">{currentOrder.slotId}</span>
            </div>
          )}
          
          {currentOrder.otp && (
            <div className="detail-row">
              <span className="detail-label">OTP:</span>
              <span className="detail-value">{currentOrder.otp}</span>
            </div>
          )}
        </div>

        <div className="action-buttons">
          <button
            className="button green"
            onClick={() => updateOrderStatus('picked_up')}
            disabled={loading}
          >
            Mark as Picked Up
          </button>
          
          <button
            className="button blue"
            onClick={() => updateOrderStatus('delivered')}
            disabled={loading}
          >
            Mark as Delivered
          </button>
        </div>
      </div>
    </div>
  );
}

// Rider Home Screen
function RiderHomeScreen({ onNavigate }) {
  return (
    <div className="screen">
      <div className="content">
        <h1>🚴 Rider Dashboard</h1>
        <p>Manage pickups and deliveries</p>
        
        <div className="section">
          <button 
            className="button blue"
            onClick={() => onNavigate('qr')}
          >
            📱 Scan QR Code
          </button>
          
          <button 
            className="button green"
            onClick={() => onNavigate('otp')}
          >
            🔢 Enter OTP
          </button>
        </div>
      </div>
    </div>
  );
}

// Staff Home Screen
function StaffHomeScreen({ onNavigate }) {
  const [stats, setStats] = useState({
    totalSlots: 10,
    occupiedSlots: 7,
    pendingOrders: 5
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const slotsData = await ApiService.get('/api/slots');
      const ordersData = await ApiService.get('/api/orders?status=pending');
      
      setStats({
        totalSlots: slotsData?.length || 10,
        occupiedSlots: slotsData?.filter(slot => slot.status === 'occupied').length || 7,
        pendingOrders: ordersData?.length || 5
      });
    } catch (error) {
      console.log('Using default stats');
    }
  };

  return (
    <div className="screen">
      <div className="content">
        <h1>🏢 Staff Dashboard</h1>
        <p>Manage slots and assignments</p>
        
        <div className="stats-container">
          <div className="stat-card">
            <div className="stat-number">{stats.totalSlots}</div>
            <div className="stat-label">Total Slots</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.occupiedSlots}</div>
            <div className="stat-label">Occupied</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.pendingOrders}</div>
            <div className="stat-label">Pending Orders</div>
          </div>
        </div>
        
        <div className="section">
          <button 
            className="button orange"
            onClick={() => onNavigate('slots')}
          >
            🗂️ Manage Slots
          </button>
          
          <button 
            className="button purple"
            onClick={() => onNavigate('assignments')}
          >
            📦 Assign Orders
          </button>
        </div>
      </div>
    </div>
  );
}

// Slot Management Screen
function SlotManagementScreen({ onBack }) {
  const [slots, setSlots] = useState([
    { id: '1', status: 'occupied', orderId: 'ORD001' },
    { id: '2', status: 'empty' },
    { id: '3', status: 'occupied', orderId: 'ORD002' },
    { id: '4', status: 'empty' },
    { id: '5', status: 'reserved' },
  ]);

  const toggleSlotStatus = async (slotId) => {
    try {
      setSlots(slots.map(slot => 
        slot.id === slotId 
          ? { ...slot, status: 'empty', orderId: undefined }
          : slot
      ));
      alert('Slot emptied successfully');
    } catch (error) {
      alert('Failed to update slot');
    }
  };

  return (
    <div className="screen">
      <div className="header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <h2>Slot Management</h2>
      </div>
      
      <div className="content">
        <h1>🗂️ Slot Management</h1>
        
        {slots.map((slot) => (
          <div key={slot.id} className="slot-card">
            <div className="slot-header">
              <span className="slot-id">Slot {slot.id}</span>
              <span className={`status-badge ${slot.status}`}>{slot.status}</span>
            </div>
            
            {slot.orderId && (
              <div className="order-info">Order: {slot.orderId}</div>
            )}
            
            {slot.status === 'occupied' && (
              <button
                className="button red"
                onClick={() => toggleSlotStatus(slot.id)}
              >
                Empty Slot
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Order Assignment Screen
function OrderAssignmentScreen({ onBack }) {
  const orders = [
    { id: '1', trackingNumber: 'TRK001', status: 'pending' },
    { id: '2', trackingNumber: 'TRK002', status: 'pending' },
    { id: '3', trackingNumber: 'TRK003', status: 'pending' },
  ];
  const slots = [
    { id: '2', status: 'empty' },
    { id: '4', status: 'empty' },
    { id: '6', status: 'empty' },
  ];

  const assignOrderToSlot = async (orderId, slotId) => {
    try {
      await ApiService.post('/api/orders/assign-slot', { orderId, slotId });
      alert('Order assigned to slot successfully');
    } catch (error) {
      alert('Failed to assign order');
    }
  };

  return (
    <div className="screen">
      <div className="header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <h2>Order Assignment</h2>
      </div>
      
      <div className="content">
        <h1>📦 Order Assignment</h1>
        
        {orders.length === 0 ? (
          <p className="empty-text">No pending orders</p>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="order-card">
              <div className="order-title">Order {order.trackingNumber}</div>
              <div className="order-status">Status: {order.status}</div>
              
              <div className="slot-selection">
                <p>Assign to slot:</p>
                <div className="slot-buttons">
                  {slots.map((slot) => (
                    <button
                      key={slot.id}
                      className="slot-button"
                      onClick={() => assignOrderToSlot(order.id, slot.id)}
                    >
                      Slot {slot.id}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;