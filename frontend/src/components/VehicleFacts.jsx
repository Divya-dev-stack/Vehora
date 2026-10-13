import { formatDate, formatKm, prettyFuel } from '../utils/vehicle';

function Fact({ label, value }) {
  return (
    <div className="veh-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function VehicleFacts({ vehicle }) {
  return (
    <dl className="veh-card__facts">
      <Fact label="Registration" value={vehicle.registration_number || 'Not added'} />
      <Fact label="Fuel" value={prettyFuel(vehicle.fuel_type)} />
      <Fact label="Odometer" value={formatKm(vehicle.mileage_km)} />
      <Fact label="Last service" value={formatDate(vehicle.last_service_date)} />
    </dl>
  );
}
