import { Bike, Car, Truck, Bus } from 'lucide-react';

const ICONS = {
  bike: Bike,
  scooter: Bike,
  electric_scooter: Bike,
  car: Car,
  auto_rickshaw: Car,
  van: Truck,
  truck: Truck,
  bus: Bus,
};

export function getVehicleIcon(type) {
  return ICONS[type] || Car;
}

export function prettyType(key) {
  const text = String(key || '').replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function prettyFuel(fuel) {
  if (fuel === 'cng' || fuel === 'lpg') return fuel.toUpperCase();
  return prettyType(fuel);
}

export function formatKm(n) {
  return Number(n).toLocaleString('en-IN') + ' km';
}

export function formatDate(iso) {
  if (!iso) return 'Not recorded';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
