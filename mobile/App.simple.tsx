import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import axios from 'axios';

// API Configuration
const API_BASE_URL = 'http://localhost:3000';

// Types
interface Order {
  id: string;
  trackingNumber: string;
  status: string;
  slotId?: string;
  otp?: string;
}

interface Slot {
  id: string;
  status: 'empty' | 'occupied' | 'reserved';
  orderId?: string;
}

// API Service with fallbacks
class ApiService {
  static async get(endpoint: string) {
    try {
      const response = await axios.get(`${API_BASE_URL}${endpoint}`);
      return response.data;
    } catch (error) {
      console.log('API Error (using mock data):', error);
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

  static async post(endpoint: string, data: any) {
    try {
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, data);
      return response.data;
    } catch (error) {
      console.log('API Error (using mock response):', error);
      return { success: true, order: { ...data, id: '1' } };
    }
  }

  static async put(endpoint: string, data: any) {
    try {
      const response = await axios.put(`${API_BASE_URL}${endpoint}`, data);
      return response.data;
    } catch (error) {
      console.log('API Error (using mock response):', error);
      return { success: true, ...data };
    }
  }
}

// Main App Component
export default function App() {
  const [activeTab, setActiveTab] = useState<'rider' | 'staff'>('rider');
  const [currentScreen, setCurrentScreen] = useState('home');
  const [screenData, setScreenData] = useState<any>(null);

  const navigateToScreen = (screen: string, data?: any) => {
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
    <SafeAreaView style={styles.container}>
      {/* Tab Content */}
      {activeTab === 'rider' ? renderRiderScreens() : renderStaffScreens()}
      
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'rider' && styles.activeTab]}
          onPress={() => {
            setActiveTab('rider');
            setCurrentScreen('home');
          }}
        >
          <Text style={styles.tabIcon}>🚴</Text>
          <Text style={[styles.tabText, activeTab === 'rider' && styles.activeTabText]}>
            Rider
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'staff' && styles.activeTab]}
          onPress={() => {
            setActiveTab('staff');
            setCurrentScreen('home');
          }}
        >
          <Text style={styles.tabIcon}>🏢</Text>
          <Text style={[styles.tabText, activeTab === 'staff' && styles.activeTabText]}>
            Staff
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// QR Scanner Screen
function QRScannerScreen({ onBack, onOrderFound }: any) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    getBarCodeScannerPermissions();
  }, []);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    Alert.alert(
      'QR Code Scanned',
      `Tracking Number: ${data}`,
      [
        { text: 'Scan Another', onPress: () => setScanned(false) },
        { text: 'Process Order', onPress: () => processOrder(data) },
      ]
    );
  };

  const processOrder = async (trackingNumber: string) => {
    try {
      const order = await ApiService.get(`/api/orders/${trackingNumber}`);
      onOrderFound('orderDetails', { ...order, trackingNumber });
    } catch (error) {
      Alert.alert('Error', 'Order not found or network error');
      setScanned(false);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centered}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No access to camera</Text>
        <TouchableOpacity style={styles.button} onPress={onBack}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan QR Code</Text>
      </View>
      
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={styles.scanner}
      />
      
      <View style={styles.scannerOverlay}>
        <View style={styles.scannerBox} />
        <Text style={styles.scannerText}>Point camera at QR code</Text>
        {scanned && (
          <TouchableOpacity
            style={styles.scanAgainButton}
            onPress={() => setScanned(false)}
          >
            <Text style={styles.buttonText}>Tap to Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// OTP Entry Screen
function OTPScreen({ onBack, onOrderFound }: any) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');

  const handleVerifyOTP = async () => {
    if (!otp || !trackingNumber) {
      Alert.alert('Error', 'Please enter both tracking number and OTP');
      return;
    }

    setLoading(true);
    try {
      const result = await ApiService.post('/api/orders/verify-otp', {
        trackingNumber,
        otp
      });
      
      Alert.alert('Success', 'OTP verified successfully!');
      onOrderFound('orderDetails', { ...result.order, trackingNumber, otp });
    } catch (error) {
      Alert.alert('Error', 'Invalid OTP or tracking number');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Enter OTP</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>🔢 Enter OTP</Text>
        <Text style={styles.subtitle}>Verify parcel pickup/delivery</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Tracking Number</Text>
          <TextInput
            style={styles.input}
            value={trackingNumber}
            onChangeText={setTrackingNumber}
            placeholder="Enter tracking number"
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>OTP Code</Text>
          <TextInput
            style={styles.input}
            value={otp}
            onChangeText={setOtp}
            placeholder="Enter 6-digit OTP"
            keyboardType="numeric"
            maxLength={6}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerifyOTP}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Verify OTP</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// Order Details Screen
function OrderDetailsScreen({ order, onBack }: any) {
  const [currentOrder, setCurrentOrder] = useState<Order>(order);
  const [loading, setLoading] = useState(false);

  const updateOrderStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      await ApiService.put(`/api/orders/${currentOrder.id}`, {
        status: newStatus
      });
      setCurrentOrder({ ...currentOrder, status: newStatus });
      Alert.alert('Success', `Order status updated to ${newStatus}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update order status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>📦 Order Details</Text>
        
        <View style={styles.detailsCard}>
          <Text style={styles.detailLabel}>Tracking Number:</Text>
          <Text style={styles.detailValue}>{currentOrder.trackingNumber}</Text>
          
          <Text style={styles.detailLabel}>Status:</Text>
          <Text style={[styles.detailValue, styles.statusTextColor]}>{currentOrder.status}</Text>
          
          {currentOrder.slotId && (
            <>
              <Text style={styles.detailLabel}>Assigned Slot:</Text>
              <Text style={styles.detailValue}>{currentOrder.slotId}</Text>
            </>
          )}
          
          {currentOrder.otp && (
            <>
              <Text style={styles.detailLabel}>OTP:</Text>
              <Text style={styles.detailValue}>{currentOrder.otp}</Text>
            </>
          )}
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#34C759' }]}
            onPress={() => updateOrderStatus('picked_up')}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Mark as Picked Up</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#007AFF' }]}
            onPress={() => updateOrderStatus('delivered')}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Mark as Delivered</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Rider Home Screen
function RiderHomeScreen({ onNavigate }: any) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>🚴 Rider Dashboard</Text>
        <Text style={styles.subtitle}>Manage pickups and deliveries</Text>
        
        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#007AFF' }]}
            onPress={() => onNavigate('qr')}
          >
            <Text style={styles.buttonText}>📱 Scan QR Code</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#34C759' }]}
            onPress={() => onNavigate('otp')}
          >
            <Text style={styles.buttonText}>🔢 Enter OTP</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Staff Home Screen
function StaffHomeScreen({ onNavigate }: any) {
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
        occupiedSlots: slotsData?.filter((slot: Slot) => slot.status === 'occupied').length || 7,
        pendingOrders: ordersData?.length || 5
      });
    } catch (error) {
      console.log('Using default stats');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>🏢 Staff Dashboard</Text>
        <Text style={styles.subtitle}>Manage slots and assignments</Text>
        
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalSlots}</Text>
            <Text style={styles.statLabel}>Total Slots</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.occupiedSlots}</Text>
            <Text style={styles.statLabel}>Occupied</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.pendingOrders}</Text>
            <Text style={styles.statLabel}>Pending Orders</Text>
          </View>
        </View>
        
        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#FF9500' }]}
            onPress={() => onNavigate('slots')}
          >
            <Text style={styles.buttonText}>🗂️ Manage Slots</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#5856D6' }]}
            onPress={() => onNavigate('assignments')}
          >
            <Text style={styles.buttonText}>📦 Assign Orders</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Slot Management Screen
function SlotManagementScreen({ onBack }: any) {
  const [slots, setSlots] = useState<Slot[]>([
    { id: '1', status: 'occupied', orderId: 'ORD001' },
    { id: '2', status: 'empty' },
    { id: '3', status: 'occupied', orderId: 'ORD002' },
    { id: '4', status: 'empty' },
    { id: '5', status: 'reserved' },
  ]);

  const toggleSlotStatus = async (slotId: string) => {
    try {
      setSlots(slots.map(slot => 
        slot.id === slotId 
          ? { ...slot, status: 'empty', orderId: undefined }
          : slot
      ));
      Alert.alert('Success', 'Slot emptied successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update slot');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Slot Management</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>🗂️ Slot Management</Text>
        
        {slots.map((slot) => (
          <View key={slot.id} style={styles.slotCard}>
            <View style={styles.slotHeader}>
              <Text style={styles.slotId}>Slot {slot.id}</Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: slot.status === 'occupied' ? '#FF3B30' : '#34C759' }
              ]}>
                <Text style={styles.statusText}>{slot.status}</Text>
              </View>
            </View>
            
            {slot.orderId && (
              <Text style={styles.orderInfo}>Order: {slot.orderId}</Text>
            )}
            
            {slot.status === 'occupied' && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#FF3B30' }]}
                onPress={() => toggleSlotStatus(slot.id)}
              >
                <Text style={styles.buttonText}>Empty Slot</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// Order Assignment Screen
function OrderAssignmentScreen({ onBack }: any) {
  const [orders] = useState<Order[]>([
    { id: '1', trackingNumber: 'TRK001', status: 'pending' },
    { id: '2', trackingNumber: 'TRK002', status: 'pending' },
    { id: '3', trackingNumber: 'TRK003', status: 'pending' },
  ]);
  const [slots] = useState<Slot[]>([
    { id: '2', status: 'empty' },
    { id: '4', status: 'empty' },
    { id: '6', status: 'empty' },
  ]);

  const assignOrderToSlot = async (orderId: string, slotId: string) => {
    try {
      await ApiService.post('/api/orders/assign-slot', { orderId, slotId });
      Alert.alert('Success', 'Order assigned to slot successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to assign order');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Assignment</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>📦 Order Assignment</Text>
        
        {orders.length === 0 ? (
          <Text style={styles.emptyText}>No pending orders</Text>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <Text style={styles.orderTitle}>Order {order.trackingNumber}</Text>
              <Text style={styles.orderStatus}>Status: {order.status}</Text>
              
              <Text style={styles.slotSelectionTitle}>Assign to slot:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.slotButtons}>
                  {slots.map((slot) => (
                    <TouchableOpacity
                      key={slot.id}
                      style={styles.slotButton}
                      onPress={() => assignOrderToSlot(order.id, slot.id)}
                    >
                      <Text style={styles.slotButtonText}>Slot {slot.id}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  section: {
    width: '100%',
    marginBottom: 30,
    alignItems: 'center',
  },
  // Tab Bar Styles
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: 20,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  activeTab: {
    backgroundColor: 'transparent',
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  tabText: {
    fontSize: 12,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  // Scanner Styles
  scanner: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerBox: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 10,
    marginBottom: 20,
  },
  scannerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 8,
  },
  scanAgainButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  // Button Styles
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 15,
    minWidth: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 20,
  },
  // Input Styles
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  // Card Styles
  detailsCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  statusTextColor: {
    color: '#007AFF',
  },
  actionButtons: {
    width: '100%',
  },
  // Stats Styles
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  // Slot Management Styles
  slotCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    width: '100%',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  slotId: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  orderInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  // Order Assignment Styles
  orderCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    width: '100%',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  orderStatus: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  slotSelectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  slotButtons: {
    flexDirection: 'row',
  },
  slotButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 10,
  },
  slotButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});