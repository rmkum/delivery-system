import React from 'react';

function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🚚 Delivery Security System</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', backgroundColor: '#f9f9f9' }}>
          <h3>Total Slots</h3>
          <div style={{ fontSize: '2em', color: '#1976d2' }}>6</div>
        </div>
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', backgroundColor: '#f9f9f9' }}>
          <h3>Occupied</h3>
          <div style={{ fontSize: '2em', color: '#ed6c02' }}>3</div>
          <div style={{ fontSize: '0.8em', color: '#666' }}>parcels waiting</div>
        </div>
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', backgroundColor: '#f9f9f9' }}>
          <h3>Available</h3>
          <div style={{ fontSize: '2em', color: '#2e7d32' }}>2</div>
          <div style={{ fontSize: '0.8em', color: '#666' }}>slots ready</div>
        </div>
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', backgroundColor: '#f9f9f9' }}>
          <h3>Today's Pickups</h3>
          <div style={{ fontSize: '2em', color: '#1976d2' }}>24</div>
          <div style={{ fontSize: '0.8em', color: '#666' }}>avg 12s</div>
        </div>
      </div>

      <h2>Slot Status</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
        {[
          { id: 1, status: 'occupied', orderId: 'ORD-001', rider: 'John Doe' },
          { id: 2, status: 'empty', orderId: null, rider: null },
          { id: 3, status: 'occupied', orderId: 'ORD-002', rider: 'Jane Smith' },
          { id: 4, status: 'empty', orderId: null, rider: null },
          { id: 5, status: 'occupied', orderId: 'ORD-003', rider: 'Bob Wilson' },
          { id: 6, status: 'error', orderId: null, rider: null },
        ].map(slot => (
          <div key={slot.id} style={{ 
            border: '1px solid #ddd', 
            borderRadius: '8px', 
            padding: '16px',
            backgroundColor: slot.status === 'occupied' ? '#e3f2fd' : 
                           slot.status === 'empty' ? '#e8f5e8' : '#ffebee'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4>Slot {slot.id}</h4>
              <span style={{ 
                padding: '4px 8px', 
                borderRadius: '12px', 
                fontSize: '0.7em',
                backgroundColor: slot.status === 'occupied' ? '#1976d2' : 
                               slot.status === 'empty' ? '#2e7d32' : '#d32f2f',
                color: 'white'
              }}>
                {slot.status.toUpperCase()}
              </span>
            </div>
            {slot.orderId && (
              <>
                <div style={{ fontSize: '0.9em', color: '#666' }}>Order: {slot.orderId}</div>
                <div style={{ fontSize: '0.9em', color: '#666' }}>Rider: {slot.rider}</div>
              </>
            )}
          </div>
        ))}
      </div>

      <h2>Recent Events</h2>
      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', maxHeight: '300px', overflow: 'auto' }}>
        {[
          { time: '14:23', event: 'Parcel picked up', slot: 2, order: 'ORD-001' },
          { time: '14:15', event: 'Parcel assigned', slot: 5, order: 'ORD-003' },
          { time: '14:10', event: 'Unlock failed', slot: 3, order: 'ORD-002' },
          { time: '14:05', event: 'Parcel assigned', slot: 3, order: 'ORD-002' },
        ].map((event, index) => (
          <div key={index} style={{ 
            padding: '8px 0', 
            borderBottom: index < 3 ? '1px solid #eee' : 'none'
          }}>
            <div style={{ fontWeight: 'bold' }}>{event.event}</div>
            <div style={{ fontSize: '0.8em', color: '#666' }}>
              {event.time} - Slot {event.slot} - {event.order}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#e8f5e8', borderRadius: '8px' }}>
        <h3>🎉 System Status</h3>
        <p>✅ Backend API: Running on <a href="http://localhost:3000/health" target="_blank" rel="noopener noreferrer">http://localhost:3000</a></p>
        <p>✅ Dashboard: Active</p>
        <p>🔧 Test API: <a href="http://localhost:3000/api/stats" target="_blank" rel="noopener noreferrer">View Stats</a> | <a href="http://localhost:3000/api/slots" target="_blank" rel="noopener noreferrer">View Slots</a></p>
      </div>
    </div>
  );
}

export default App;