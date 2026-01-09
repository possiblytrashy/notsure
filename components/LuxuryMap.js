// components/LuxuryMap.js
"use client";
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';

function MapUpdater({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.flyTo([lat, lng], 15);
  }, [lat, lng, map]);
  return null;
}

const luxuryIcon = typeof window !== 'undefined' ? L.divIcon({
  className: 'luxury-map-marker',
  html: `<div style="width:16px; height:16px; background:#000; border:2px solid #fff; border-radius:50%;"></div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
}) : null;

export default function LuxuryMap({ lat, lng, location }) {
  return (
    <MapContainer 
      center={[lat || 5.6037, lng || -0.1870]} 
      zoom={15} 
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
      <MapUpdater lat={lat} lng={lng} />
      {luxuryIcon && <Marker position={[lat || 5.6037, lng || -0.1870]} icon={luxuryIcon} />}
    </MapContainer>
  );
}
