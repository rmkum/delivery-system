import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';

const app: Application = express();

// Basic middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3002'],
  credentials: true
}));
app.use(compression());
app.use(express.json());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mock data for demonstration
const mockData = {
  slots: [
    { id: 1, status: 'occupied', orderId: 'ORD001', lockerNumber: 1 },
    { id: 2, status: 'available', orderId: null, lockerNumber: 2 },
    { id: 3, status: 'occupied', orderId: 'ORD003', lockerNumber: 3 },
    { id: 4, status: 'available', orderId: null, lockerNumber: 4 },
    { id: 5, status: 'maintenance', orderId: null, lockerNumber: 5 },
  ],
  orders: [
    { 
      id: 'ORD001', 
      status: 'delivered', 
      slotId: 1, 
      riderId: 'rider123',
      deliveredAt: new Date().toISOString(),
      customerPhone: '+1234567890'
    },
    { 
      id: 'ORD003', 
      status: 'delivered', 
      slotId: 3, 
      riderId: 'rider456',
      deliveredAt: new Date().toISOString(),
      customerPhone: '+1234567891'
    }
  ],
  events: [
    {
      id: 1,
      timestamp: new Date().toISOString(),
      type: 'SLOT_ASSIGNED',
      description: 'Order ORD001 assigned to slot 1',
      metadata: { orderId: 'ORD001', slotId: 1 }
    },
    {
      id: 2,
      timestamp: new Date().toISOString(),
      type: 'DOOR_OPENED',
      description: 'Slot 1 door opened by customer',
      metadata: { slotId: 1, actor: 'customer' }
    }
  ]
};

// API Routes
app.get('/api/slots', (req: Request, res: Response) => {
  res.json({ data: mockData.slots });
});

app.get('/api/orders', (req: Request, res: Response) => {
  res.json({ data: mockData.orders });
});

app.get('/api/events', (req: Request, res: Response) => {
  res.json({ data: mockData.events });
});

app.get('/api/stats', (req: Request, res: Response) => {
  const stats = {
    totalSlots: mockData.slots.length,
    occupiedSlots: mockData.slots.filter(s => s.status === 'occupied').length,
    availableSlots: mockData.slots.filter(s => s.status === 'available').length,
    maintenanceSlots: mockData.slots.filter(s => s.status === 'maintenance').length,
    totalOrders: mockData.orders.length,
    deliveredToday: mockData.orders.filter(o => o.status === 'delivered').length,
    averageDeliveryTime: '12 min'
  };
  res.json({ data: stats });
});

// Authentication endpoints
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  // Mock authentication
  if (email && password) {
    res.json({
      success: true,
      token: 'mock-jwt-token',
      user: { id: 1, email, role: 'admin' }
    });
  } else {
    res.status(400).json({ error: 'Email and password required' });
  }
});

// Slot management
app.post('/api/slots/:id/assign', (req: Request, res: Response) => {
  const slotId = parseInt(req.params.id);
  const { orderId } = req.body;
  
  const slot = mockData.slots.find(s => s.id === slotId);
  if (!slot) {
    return res.status(404).json({ error: 'Slot not found' });
  }
  
  if (slot.status !== 'available') {
    return res.status(400).json({ error: 'Slot not available' });
  }
  
  slot.status = 'occupied';
  slot.orderId = orderId;
  
  // Add event
  mockData.events.push({
    id: mockData.events.length + 1,
    timestamp: new Date().toISOString(),
    type: 'SLOT_ASSIGNED',
    description: `Order ${orderId} assigned to slot ${slotId}`,
    metadata: { orderId, slotId }
  });
  
  return res.json({ data: slot });
});

app.post('/api/slots/:id/open', (req: Request, res: Response) => {
  const slotId = parseInt(req.params.id);
  const { actor } = req.body;
  
  const slot = mockData.slots.find(s => s.id === slotId);
  if (!slot) {
    return res.status(404).json({ error: 'Slot not found' });
  }
  
  // Add event
  mockData.events.push({
    id: mockData.events.length + 1,
    timestamp: new Date().toISOString(),
    type: 'DOOR_OPENED',
    description: `Slot ${slotId} door opened by ${actor || 'unknown'}`,
    metadata: { slotId, actor: actor || 'unknown' }
  });
  
  // If customer opens, mark as collected
  if (actor === 'customer') {
    slot.status = 'available';
    slot.orderId = null;
    
    mockData.events.push({
      id: mockData.events.length + 1,
      timestamp: new Date().toISOString(),
      type: 'ORDER_COLLECTED',
      description: `Order collected from slot ${slotId}`,
      metadata: { slotId, actor: 'customer' }
    });
  }
  
  return res.json({ message: 'Slot opened successfully', data: slot });
});

// Error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Delivery Security System Backend running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:3001`);
  console.log(`🔗 API Health: http://localhost:${PORT}/health`);
  console.log(`📱 Mobile API: http://localhost:${PORT}/api`);
  console.log('✅ Server ready - no external dependencies required');
});

export default app;