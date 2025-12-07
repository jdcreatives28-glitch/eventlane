import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl } from 'react-leaflet';
import { supabase } from '../supabaseClient';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Helper to calculate distance between two coordinates
function getDistance(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function LiveEventsMap() {
  const [events, setEvents] = useState([]);
  const mapRef = useRef(null);
  const navigate = useNavigate();
  const [locationFetched, setLocationFetched] = useState(false);


  useEffect(() => {
    const loadEvents = async () => {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, event_name, event_type, event_date, status, venue_id,
        theVenues ( id, name, lat, lng, image_urls )
      `)
      .eq('event_date', today)
      .in('status', ['confirmed', 'ongoing']);

    if (error) {
      console.error('❌ Error fetching live events:', error);
      return;
    }

    const withVenue = data.filter(e => e.theVenues?.lat && e.theVenues?.lng);
    setEvents(withVenue);

    // 🧭 Try to find nearest venue from user location
    navigator.geolocation.getCurrentPosition(
  (pos) => {
    const userLat = pos.coords.latitude;
    const userLng = pos.coords.longitude;

    let nearest = null;
    let minDistance = Infinity;

    for (const event of withVenue) {
      const venue = event.theVenues;
      const distance = getDistance(userLat, userLng, venue.lat, venue.lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = venue;
      }
    }

    if (nearest && mapRef.current) {
      setTimeout(() => {
        mapRef.current.flyTo([nearest.lat, nearest.lng], 14, {
          duration: 1.5,
        });
      }, 300);
    }

    setLocationFetched(true); // ✅ Moved here
  },
  (err) => {
    console.warn('📡 Geolocation failed:', err.message);
    setLocationFetched(true); // ✅ Still mark as fetched
  },
  { enableHighAccuracy: true, timeout: 5000 }
);

  };

  loadEvents();
}, []);

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      {/* 🔙 Back Button */}
       <button
        onClick={() => navigate(-1)}
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 1000,
          background: '#ffffff',
          border: '1px solid #ccc',
          borderRadius: '50%',
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 3px rgba(0,0,0,0.2)',
          cursor: 'pointer',
        }}
      >
        <FaArrowLeft size={18} color="#333" />
      </button>

      <MapContainer
        center={[14.5702, 120.5363]}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        whenCreated={(mapInstance) => {
          mapRef.current = mapInstance;
        }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="topright" />

        {events.map((event) => {
          const venue = event.theVenues;

          const div = document.createElement('div');
          div.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
              <img src="${venue.image_urls?.[0] || 'https://placehold.co/60'}"
                style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.3);margin-bottom:4px;" />

              <div style="display:inline-flex;align-items:center;gap:6px;background:white;padding:4px 8px;border-radius:6px;border:1px solid #ccc;font-size:12px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.15);">
                <img src="https://cdn-icons-png.flaticon.com/512/684/684908.png" style="width:16px;height:16px;" />
                <span style="color:#333;">${venue.name}</span>
              </div>

              <div style="margin-top:4px;background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;">
                <span style="width:8px;height:8px;background:#dc2626;border-radius:50%;display:inline-block;"></span>
                 ${event.event_type || 'Event'}
              </div>
            </div>
          `;

          const icon = L.divIcon({
            html: div,
            className: '',
            iconAnchor: [24, 60],
          });

          return (
            <Marker
              key={event.id}
              position={[venue.lat, venue.lng]}
              icon={icon}
              eventHandlers={{
                click: () => navigate(`/venue/${venue.id}`),
              }}
            />
          );
        })}
      </MapContainer>

      {/* 💤 No Events Message */}
      {locationFetched && events.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255,255,255,0.95)',
            padding: '20px 30px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 999,
            textAlign: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18, color: '#333' }}>
            No live events at the moment
          </h3>
          <p style={{ marginTop: 6, fontSize: 14, color: '#777' }}>
            Check back again later!
          </p>
        </div>
      )}
    </div>
  );
}
