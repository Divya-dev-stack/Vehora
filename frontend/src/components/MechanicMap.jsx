import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import icon2x from 'leaflet/dist/images/marker-icon-2x.png';
import icon from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: icon2x, iconUrl: icon, shadowUrl: shadow });

function FitView({ center, mechanics }) {
  const map = useMap();
  useEffect(() => {
    const pts = [[center.lat, center.lng], ...mechanics.map((m) => [m.latitude, m.longitude])];
    if (pts.length === 1) {
      map.setView(pts[0], 14);
    } else {
      map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
    }
  }, [map, center, mechanics]);
  return null;
}

export default function MechanicMap({ center, mechanics, onSelect }) {
  return (
    <MapContainer
      className="p3-map"
      center={[center.lat, center.lng]}
      zoom={13}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker
        center={[center.lat, center.lng]}
        radius={9}
        pathOptions={{ color: '#E0B86A', fillColor: '#E0B86A', fillOpacity: 0.8 }}
      >
        <Popup>You are here</Popup>
      </CircleMarker>
      {mechanics.map((m) => (
        <Marker
          key={m.id}
          position={[m.latitude, m.longitude]}
          eventHandlers={{ click: () => onSelect(m.id) }}
        >
          <Popup>
            <strong>{m.shop_name}</strong>
            <br />
            {m.distance_km} km away
          </Popup>
        </Marker>
      ))}
      <FitView center={center} mechanics={mechanics} />
    </MapContainer>
  );
}