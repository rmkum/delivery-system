import React from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Container, 
  Grid, 
  Card, 
  CardContent,
  Box,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { 
  Dashboard as DashboardIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

// Mock data for demonstration
const mockData = {
  slots: [
    { id: 1, status: 'occupied', orderId: 'ORD-001', rider: 'John Doe' },
    { id: 2, status: 'empty', orderId: null, rider: null },
    { id: 3, status: 'occupied', orderId: 'ORD-002', rider: 'Jane Smith' },
    { id: 4, status: 'empty', orderId: null, rider: null },
    { id: 5, status: 'occupied', orderId: 'ORD-003', rider: 'Bob Wilson' },
    { id: 6, status: 'error', orderId: null, rider: null },
  ],
  stats: {
    totalSlots: 6,
    occupiedSlots: 3,
    availableSlots: 2,
    errorSlots: 1,
    todayPickups: 24,
    avgPickupTime: '12s'
  },
  recentEvents: [
    { time: '14:23', event: 'Parcel picked up', slot: 2, order: 'ORD-001' },
    { time: '14:15', event: 'Parcel assigned', slot: 5, order: 'ORD-003' },
    { time: '14:10', event: 'Unlock failed', slot: 3, order: 'ORD-002' },
    { time: '14:05', event: 'Parcel assigned', slot: 3, order: 'ORD-002' },
  ]
};

function SlotCard({ slot }: { slot: any }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'occupied': return 'primary';
      case 'empty': return 'success';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'occupied': return <LockIcon />;
      case 'empty': return <LockOpenIcon />;
      case 'error': return <WarningIcon />;
      default: return <CheckCircleIcon />;
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Slot {slot.id}</Typography>
          <Chip 
            icon={getStatusIcon(slot.status)}
            label={slot.status.toUpperCase()} 
            color={getStatusColor(slot.status) as any}
            size="small"
          />
        </Box>
        {slot.orderId && (
          <>
            <Typography variant="body2" color="text.secondary">
              Order: {slot.orderId}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Rider: {slot.rider}
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatsCard({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) {
  return (
    <Card>
      <CardContent>
        <Typography color="text.secondary" gutterBottom variant="body2">
          {title}
        </Typography>
        <Typography variant="h4" component="div">
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function App() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <DashboardIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Delivery Security Dashboard
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Statistics Overview */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard 
              title="Total Slots" 
              value={mockData.stats.totalSlots}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard 
              title="Occupied" 
              value={mockData.stats.occupiedSlots}
              subtitle="parcels waiting"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard 
              title="Available" 
              value={mockData.stats.availableSlots}
              subtitle="slots ready"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard 
              title="Today's Pickups" 
              value={mockData.stats.todayPickups}
              subtitle={`avg ${mockData.stats.avgPickupTime}`}
            />
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          {/* Slot Status Grid */}
          <Grid item xs={12} md={8}>
            <Typography variant="h5" gutterBottom>
              Slot Status
            </Typography>
            <Grid container spacing={2}>
              {mockData.slots.map((slot) => (
                <Grid item xs={12} sm={6} md={4} key={slot.id}>
                  <SlotCard slot={slot} />
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Recent Events */}
          <Grid item xs={12} md={4}>
            <Typography variant="h5" gutterBottom>
              Recent Events
            </Typography>
            <Paper sx={{ height: 400, overflow: 'auto' }}>
              <List>
                {mockData.recentEvents.map((event, index) => (
                  <ListItem key={index} divider>
                    <ListItemText
                      primary={event.event}
                      secondary={`${event.time} - Slot ${event.slot} - ${event.order}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default App;