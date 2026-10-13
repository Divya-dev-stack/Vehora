import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Siren } from 'lucide-react';
import TopBar from '../components/TopBar';
import MechanicMap from '../components/MechanicMap';
import { getMechanicMeta } from '../services/mechanicApi';
import { findNearbyMechanics } from '../services/assistApi';
import { getPosition } from '../utils/geo';
import { friendlyError } from '../utils/errors';
import './Dashboard.css';
import './Vehicles.css';
import './Mechanic.css';
import './Phase3.css';

export default function FindMechanic() {
  const [meta, setMeta] = useState(null);
  const [pos, setPos] = useState(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [service, setService] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [radius, setRadius] = useState('25');
  const [found, setFound] = useState(null);
  const [error, setError] = useState('');
  const [focusId, setFocusId] = useState('');
  const searchKey = pos ? [pos.lat, pos.lng, service, vehicleType, radius].join('|') : '';
  const results = found ? found.rows : null;
  const searching = Boolean(pos) && (!found || found.key !== searchKey);
  const searchError = found && found.key === searchKey ? found.error : '';

  useEffect(() => {
    let active = true;
    getMechanicMeta()
      .then((m) => {
        if (active) setMeta(m);
      })
      .catch((err) => {
        if (active) setError(friendlyError(err));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!pos) return undefined;
    let active = true;

    const params = { lat: pos.lat, lng: pos.lng, radius_km: Number(radius) };
    if (service) params.service = service;
    if (vehicleType) params.vehicle_type = vehicleType;
    findNearbyMechanics(params)
      .then((rows) => {
        if (active) setFound({ key: searchKey, rows, error: '' });
      })
      .catch((err) => {
        if (active) setFound((prev) => ({ key: searchKey, rows: prev ? prev.rows : null, error: friendlyError(err) }));
      });
    return () => {
      active = false;
    };
  }, [searchKey, pos, service, vehicleType, radius]);

  const locate = async () => {
    setLocating(true);
    setGeoError('');
    try {
      setPos(await getPosition());
    } catch (err) {
      setGeoError(friendlyError(err));
    } finally {
      setLocating(false);
    }
  };

  const select = (id) => {
    setFocusId(id);
    const el = document.getElementById('m-' + id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const serviceLabel = meta ? Object.fromEntries(meta.service_types.map((s) => [s.key, s.label])) : {};

  return (
    <main className="dash">
      <div className="dash__inner">
        <TopBar />

        <section className="vh-card" aria-labelledby="find-title">
          <h2 className="dash__card-title" id="find-title">
            <MapPin size={20} /> Find a mechanic near you
          </h2>

          <div className="p3-row3">
            <div className="vh-field">
              <label className="vh-label" htmlFor="f_service">Problem</label>
              <select id="f_service" className="vh-input" value={service} onChange={(e) => setService(e.target.value)} disabled={!meta}>
                <option value="">Any problem</option>
                {meta && meta.service_types.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="vh-field">
              <label className="vh-label" htmlFor="f_vehicle">Vehicle type</label>
              <select id="f_vehicle" className="vh-input" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} disabled={!meta}>
                <option value="">Any vehicle</option>
                {meta && meta.vehicle_types.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="vh-field">
              <label className="vh-label" htmlFor="f_radius">Distance</label>
              <select id="f_radius" className="vh-input" value={radius} onChange={(e) => setRadius(e.target.value)}>
                <option value="5">Within 5 km</option>
                <option value="10">Within 10 km</option>
                <option value="25">Within 25 km</option>
                <option value="50">Within 50 km</option>
                <option value="100">Within 100 km</option>
              </select>
            </div>
          </div>

          <div className="p3-toolbar">
            <button className="vh-btn vh-btn--primary" type="button" onClick={locate} disabled={locating}>
              <MapPin size={18} /> {locating ? 'Finding your location...' : pos ? 'Update my location' : 'Use my location'}
            </button>
            <Link className="vh-btn vh-btn--ghost" to="/assistance">
              <Siren size={18} /> Request roadside assistance
            </Link>
          </div>

          <p className="p3-note">
            Your location is used only to search, and it is not stored. Mechanics appear here only after they agree to share their shop location.
          </p>

          {geoError && <div className="veh-alert" role="alert">{geoError}</div>}
          {(error || searchError) && <div className="veh-alert" role="alert">{error || searchError}</div>}
        </section>

        {pos && (
          <section className="vh-card p3-section-gap" aria-labelledby="results-title">
            <h2 className="dash__card-title" id="results-title">
              <MapPin size={20} /> Mechanics nearby
            </h2>

            {searching && !results && (
              <div className="veh-state"><div className="vh-spinner" aria-label="Searching" /></div>
            )}

            {results && (
              <>
                <MechanicMap center={pos} mechanics={results} onSelect={select} />

                {results.length === 0 ? (
                  <div className="dash__empty">
                    <h3>No mechanics found</h3>
                    <p>
                      No available mechanic has shared a location within this distance for your filters.
                      Try a larger distance or Any problem.
                    </p>
                  </div>
                ) : (
                  <ul className="p3-list">
                    {results.map((m) => (
                      <li key={m.id} id={'m-' + m.id} className={'p3-item' + (m.id === focusId ? ' p3-item--focus' : '')}>
                        <div className="p3-item__main">
                          <h3 className="p3-item__title">{m.shop_name}</h3>
                          <p className="p3-item__meta">
                            {m.distance_km} km away | {m.city}
                            {m.working_hours ? ' | ' + m.working_hours : ''}
                          </p>
                          {m.address && <p className="p3-item__meta">{m.address}</p>}
                          <div className="mech-chips" style={{ marginTop: 8 }}>
                            {m.service_types.map((k) => (
                              <span key={k} className="mech-chip mech-chip--static">{serviceLabel[k] || k}</span>
                            ))}
                          </div>
                          <div className="p3-actions">
                            <a className="vh-btn vh-btn--primary vh-btn--sm" href={'tel:' + m.phone}>
                              <Phone size={16} /> Call {m.phone}
                            </a>
                            <a
                              className="vh-btn vh-btn--ghost vh-btn--sm"
                              href={'https://www.google.com/maps/dir/?api=1&destination=' + m.latitude + ',' + m.longitude}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Directions
                            </a>
                          </div>
                        </div>
                        <div className="p3-item__side">
                          <span className={'vh-badge ' + (m.verified ? 'vh-badge--success' : 'vh-badge--warning')}>
                            {m.verified ? 'Verified' : 'Not verified yet'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}