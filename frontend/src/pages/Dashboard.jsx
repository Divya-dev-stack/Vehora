import { createElement, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bike, Car, Truck, Bus, Bot, MapPin, Siren,
  Wrench, Bell, ClipboardList, LogOut, Plus, Pencil,
} from 'lucide-react';
import useAuth from '../hooks/useAuth';
import VehicleFacts from '../components/VehicleFacts';
import HealthCard from '../components/HealthCard';
import { listVehicles } from '../services/vehicleApi';
import { listReminders, listServiceRecords } from '../services/careApi';
import { getErrorMessage } from '../services/api';
import { getVehicleIcon, prettyType } from '../utils/vehicle';
import { formatDate, formatKm, REMINDER_STATUS, reminderDue } from '../utils/format';
import './Dashboard.css';
import './Vehicles.css';
import './Phase3.css';

const SHORTCUTS = [
  { title: 'AI assistant', text: 'Describe a problem in your own words.', Icon: Bot, to: '/assistant' },
  { title: 'Find mechanic', text: 'Mechanics near you for the problem.', Icon: MapPin, to: '/find-mechanic' },
  { title: 'Emergency help', text: 'Request roadside assistance.', Icon: Siren, to: '/assistance?sos=1' },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [vehicles, setVehicles] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reminders, setReminders] = useState(null);
  const [records, setRecords] = useState(null);

  useEffect(() => {
    let active = true;
    listVehicles()
      .then((rows) => {
        if (active) setVehicles(rows);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      });
    listReminders(false)
      .then((rows) => {
        if (active) setReminders(rows);
      })
      .catch(() => {
        if (active) setReminders([]);
      });
    listServiceRecords()
      .then((rows) => {
        if (active) setRecords(rows);
      })
      .catch(() => {
        if (active) setRecords([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const hasVehicles = Boolean(vehicles && vehicles.length > 0);
  const selected = hasVehicles
    ? vehicles.find((v) => v.id === selectedId) || vehicles[0]
    : null;


  return (
    <main className="dash">
      <div className="dash__inner">
        <header className="dash__top">
          <img className="dash__logo" src="/logo/icon-round-192.png" alt="VEHORA" />
          <div>
            <p className="dash__brand">VEHORA</p>
            <h1 className="dash__greeting">Hello, {user.full_name}</h1>
          </div>
          <button className="vh-btn vh-btn--ghost vh-btn--sm dash__logout" onClick={logout}>
            <LogOut size={16} /> Log out
          </button>
        </header>

        <div className="dash__grid">
          <section className="vh-card" aria-labelledby="vehicle-title">
            <h2 className="dash__card-title" id="vehicle-title">
              <Car size={20} /> My vehicle
            </h2>

            <select
              className="vh-input dash__select"
              aria-label="Select vehicle"
              value={selected ? selected.id : ''}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={!hasVehicles}
            >
              {hasVehicles ? (
                vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.make} {v.model} ({v.registration_number || prettyType(v.vehicle_type)})
                  </option>
                ))
              ) : (
                <option value="">
                  {vehicles === null && !error ? 'Loading...' : 'No vehicles added yet'}
                </option>
              )}
            </select>

            {error && <div className="veh-alert" role="alert">{error}</div>}

            {vehicles === null && !error && (
              <div className="veh-state"><div className="vh-spinner" aria-label="Loading" /></div>
            )}

            {vehicles && vehicles.length === 0 && (
              <div className="dash__empty">
                <div className="dash__types" aria-hidden="true">
                  <Bike size={32} />
                  <Car size={32} />
                  <Truck size={32} />
                  <Bus size={32} />
                </div>
                <h3>No vehicle yet</h3>
                <p>
                  Bikes, scooters, cars, auto-rickshaws and commercial vehicles are supported.
                  Add your first vehicle to get started.
                </p>
                <Link className="vh-btn vh-btn--primary" to="/vehicles/new">
                  <Plus size={18} /> Add vehicle
                </Link>
              </div>
            )}

            {selected && (
              <div className="veh-selected">
                <div className="veh-card__head">
                  <span className="veh-card__icon">{createElement(getVehicleIcon(selected.vehicle_type), { size: 26 })}</span>
                  <div>
                    <h3 className="veh-card__title">{selected.make} {selected.model}</h3>
                    <p className="veh-card__sub">
                      {prettyType(selected.vehicle_type)} | {selected.year}
                    </p>
                  </div>
                </div>
                <VehicleFacts vehicle={selected} />
                <div className="veh-card__actions">
                  <Link className="vh-btn vh-btn--ghost vh-btn--sm" to={'/vehicles/' + selected.id + '/edit'}>
                    <Pencil size={16} /> Edit
                  </Link>
                  <Link className="vh-btn vh-btn--ghost vh-btn--sm" to="/vehicles">All vehicles</Link>
                  <Link className="vh-btn vh-btn--primary vh-btn--sm" to="/vehicles/new">
                    <Plus size={16} /> Add vehicle
                  </Link>
                </div>
              </div>
            )}
          </section>

          <HealthCard vehicle={selected} />

          <section className="dash__span-2" aria-label="Shortcuts">
            <div className="dash__shortcuts">
              {SHORTCUTS.map(({ title, text, Icon, to }) =>
                to ? (
                  <Link className="dash__tile" key={title} to={to} style={{ textDecoration: 'none' }}>
                    <Icon size={28} />
                    <span className="dash__tile-title">{title}</span>
                    <span className="dash__tile-text">{text}</span>
                  </Link>
                ) : (
                  <div className="dash__tile" key={title} aria-disabled="true">
                    <span className="dash__soon">Soon</span>
                    <Icon size={28} />
                    <span className="dash__tile-title">{title}</span>
                    <span className="dash__tile-text">{text}</span>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="vh-card" aria-labelledby="reminders-title">
            <h2 className="dash__card-title" id="reminders-title">
              <Bell size={20} /> Maintenance reminders
            </h2>
            {reminders === null ? (
              <div className="veh-state"><div className="vh-spinner" aria-label="Loading" /></div>
            ) : reminders.length === 0 ? (
              <div className="dash__empty">
                <p>No reminders yet. Add a service record with a next service date, or create a reminder.</p>
                {hasVehicles && (
                  <Link className="vh-btn vh-btn--ghost vh-btn--sm" to="/maintenance">Open maintenance</Link>
                )}
              </div>
            ) : (
              <>
                <ul className="p3-list">
                  {reminders.slice(0, 3).map((r) => {
                    const st = REMINDER_STATUS[r.status] || REMINDER_STATUS.upcoming;
                    return (
                      <li key={r.id} className="p3-item">
                        <div className="p3-item__main">
                          <h3 className="p3-item__title">{r.title}</h3>
                          <p className="p3-item__meta">{r.vehicle_label} | {reminderDue(r)}</p>
                        </div>
                        <div className="p3-item__side">
                          <span className={'vh-badge ' + st.badge}>{st.label}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="p3-actions">
                  <Link className="vh-btn vh-btn--ghost vh-btn--sm" to="/maintenance">View all</Link>
                </div>
              </>
            )}
          </section>

          <section className="vh-card" aria-labelledby="history-title">
            <h2 className="dash__card-title" id="history-title">
              <ClipboardList size={20} /> Recent service history
            </h2>
            {records === null ? (
              <div className="veh-state"><div className="vh-spinner" aria-label="Loading" /></div>
            ) : records.length === 0 ? (
              <div className="dash__empty">
                <Wrench size={28} color="#E0B86A" />
                <p>No service records yet.</p>
                {hasVehicles && (
                  <Link className="vh-btn vh-btn--ghost vh-btn--sm" to="/maintenance">Add service record</Link>
                )}
              </div>
            ) : (
              <>
                <ul className="p3-list">
                  {records.slice(0, 3).map((r) => (
                    <li key={r.id} className="p3-item">
                      <div className="p3-item__main">
                        <h3 className="p3-item__title">{r.service_label}</h3>
                        <p className="p3-item__meta">
                          {r.vehicle_label} | {formatDate(r.service_date)} | {formatKm(r.odometer_km)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="p3-actions">
                  <Link className="vh-btn vh-btn--ghost vh-btn--sm" to="/maintenance">View all</Link>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
