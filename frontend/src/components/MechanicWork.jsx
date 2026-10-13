import { useCallback, useEffect, useState } from 'react';
import { Inbox, MapPin, ClipboardList, Phone } from 'lucide-react';
import { getPosition } from '../utils/geo';
import { friendlyError } from '../utils/errors';
import { formatDateTime } from '../utils/format';
import {
  listOpenRequests,
  listMyJobs,
  acceptRequest,
  completeRequest,
  releaseRequest,
  getMyLocation,
  saveMyLocation,
  removeMyLocation,
} from '../services/assistApi';

const JOB_STATUS = {
  accepted: { label: 'In progress', badge: 'vh-badge--warning' },
  completed: { label: 'Completed', badge: 'vh-badge--success' },
  cancelled: { label: 'Cancelled by customer', badge: 'vh-badge--danger' },
};

export default function MechanicWork({ hasProfile, available }) {
  const [requests, setRequests] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [loc, setLoc] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const [r, j, l] = await Promise.all([listOpenRequests(), listMyJobs(), getMyLocation()]);
    setRequests(r);
    setJobs(j);
    setLoc(l);
  }, []);

  useEffect(() => {
    if (!hasProfile) return undefined;
    let active = true;
    Promise.all([listOpenRequests(), listMyJobs(), getMyLocation()])
      .then(([r, j, l]) => {
        if (active) {
          setRequests(r);
          setJobs(j);
          setLoc(l);
        }
      })
      .catch((err) => {
        if (active) setError(friendlyError(err));
      });
    const timer = setInterval(() => {
      Promise.all([listOpenRequests(), listMyJobs()])
        .then(([r, j]) => {
          if (active) {
            setRequests(r);
            setJobs(j);
          }
        })
        .catch(() => {});
    }, 20000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [hasProfile, available]);

  const run = async (key, fn, okMessage) => {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await fn();
      await load();
      if (okMessage) setNotice(okMessage);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy('');
    }
  };

  const shareLocation = () =>
    run(
      'loc',
      async () => {
        const p = await getPosition();
        await saveMyLocation({ latitude: p.lat, longitude: p.lng, consent: true });
      },
      'Shop location saved. Vehicle owners can now find you on the map.'
    );

  const stopSharing = () => run('loc', () => removeMyLocation(), 'Location sharing stopped.');

  const alerts = (
    <>
      {notice && <div className="veh-alert veh-alert--success" role="status">{notice}</div>}
      {error && <div className="veh-alert" role="alert">{error}</div>}
    </>
  );

  if (!hasProfile) {
    return (
      <section className="vh-card" aria-labelledby="requests-title">
        <h2 className="dash__card-title" id="requests-title">
          <Inbox size={20} /> Assistance requests
        </h2>
        <div className="dash__empty">
          <h3>Set up your shop profile first</h3>
          <p>After saving your profile you can share your location and receive requests.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="vh-card" aria-labelledby="requests-title">
        <h2 className="dash__card-title" id="requests-title">
          <Inbox size={20} /> Assistance requests
        </h2>
        {alerts}

        {!available ? (
          <div className="dash__empty">
            <h3>You are unavailable</h3>
            <p>Set yourself as available to see and accept requests.</p>
          </div>
        ) : requests === null ? (
          <div className="veh-state"><div className="vh-spinner" aria-label="Loading" /></div>
        ) : requests.length === 0 ? (
          <div className="dash__empty">
            <h3>No open requests</h3>
            <p>Requests that match your vehicles and services appear here. This list refreshes automatically.</p>
          </div>
        ) : (
          <ul className="p3-list">
            {requests.map((r) => (
              <li key={r.id} className={'p3-item' + (r.is_sos ? ' p3-item--sos' : '')}>
                <div className="p3-item__main">
                  <h3 className="p3-item__title">{r.is_sos ? 'SOS emergency' : r.service_label}</h3>
                  <p className="p3-item__meta">
                    {r.vehicle_label ? r.vehicle_label + ' | ' : ''}
                    {r.distance_km !== null && r.distance_km !== undefined ? r.distance_km + ' km away | ' : ''}
                    {formatDateTime(r.created_at)}
                  </p>
                  {r.description && <p className="p3-item__meta">{r.description}</p>}
                  <div className="p3-actions">
                    <button
                      className="vh-btn vh-btn--primary vh-btn--sm"
                      type="button"
                      disabled={busy !== ''}
                      onClick={() => run('a' + r.id, () => acceptRequest(r.id), 'Request accepted. Contact details are shown under Assigned jobs.')}
                    >
                      Accept
                    </button>
                  </div>
                </div>
                <div className="p3-item__side">
                  {r.is_sos && <span className="vh-badge vh-badge--danger">SOS</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="p3-note">The customer phone number and exact location are shown only after you accept.</p>
      </section>

      <section className="vh-card" aria-labelledby="location-title">
        <h2 className="dash__card-title" id="location-title">
          <MapPin size={20} /> Shop location
        </h2>

        {loc && loc.shared ? (
          <p>
            <span className="vh-badge vh-badge--success">Visible on the map</span>
            <br />
            Saved position: {Number(loc.latitude).toFixed(4)}, {Number(loc.longitude).toFixed(4)}
          </p>
        ) : (
          <p>
            <span className="vh-badge vh-badge--warning">Not shared</span>
            <br />
            Vehicle owners cannot find you on the map yet.
          </p>
        )}

        <label className="p3-check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          I agree to show my shop location, shop name and contact number to vehicle owners looking for help.
        </label>

        <div className="p3-actions">
          <button className="vh-btn vh-btn--primary vh-btn--sm" type="button" onClick={shareLocation} disabled={!consent || busy !== ''}>
            <MapPin size={16} /> {busy === 'loc' ? 'Saving...' : loc && loc.shared ? 'Update with my current location' : 'Share my current location'}
          </button>
          {loc && loc.shared && (
            <button className="vh-btn vh-btn--ghost vh-btn--sm" type="button" onClick={stopSharing} disabled={busy !== ''}>
              Stop sharing
            </button>
          )}
        </div>
        <p className="p3-note">Do this while you are at your shop, so the saved position is accurate.</p>
      </section>

      <section className="vh-card dash__span-2" aria-labelledby="jobs-title">
        <h2 className="dash__card-title" id="jobs-title">
          <ClipboardList size={20} /> Assigned jobs
        </h2>

        {jobs === null ? (
          <div className="veh-state"><div className="vh-spinner" aria-label="Loading" /></div>
        ) : jobs.length === 0 ? (
          <div className="dash__empty">
            <p>No jobs yet. Accepted requests appear here with the customer contact details.</p>
          </div>
        ) : (
          <ul className="p3-list">
            {jobs.map((j) => {
              const st = JOB_STATUS[j.status] || JOB_STATUS.accepted;
              const inProgress = j.status === 'accepted';
              return (
                <li key={j.id} className={'p3-item' + (j.is_sos ? ' p3-item--sos' : '') + (inProgress ? '' : ' p3-item--muted')}>
                  <div className="p3-item__main">
                    <h3 className="p3-item__title">{j.is_sos ? 'SOS emergency' : j.service_label}</h3>
                    <p className="p3-item__meta">
                      {j.vehicle_label ? j.vehicle_label + ' | ' : ''}{formatDateTime(j.created_at)}
                    </p>
                    {j.description && <p className="p3-item__meta">{j.description}</p>}
                    {inProgress && j.location_text && <p className="p3-item__meta">Location note: {j.location_text}</p>}
                    {inProgress && (
                      <div className="p3-actions">
                        {j.contact_phone && (
                          <a className="vh-btn vh-btn--primary vh-btn--sm" href={'tel:' + j.contact_phone}>
                            <Phone size={16} /> Call {j.contact_phone}
                          </a>
                        )}
                        {j.latitude !== null && j.latitude !== undefined && (
                          <a
                            className="vh-btn vh-btn--ghost vh-btn--sm"
                            href={'https://www.google.com/maps/dir/?api=1&destination=' + j.latitude + ',' + j.longitude}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Directions
                          </a>
                        )}
                        <button className="vh-btn vh-btn--ghost vh-btn--sm" type="button" disabled={busy !== ''} onClick={() => run('c' + j.id, () => completeRequest(j.id), 'Job marked as completed.')}>
                          Mark completed
                        </button>
                        <button className="vh-btn vh-btn--ghost vh-btn--sm" type="button" disabled={busy !== ''} onClick={() => run('r' + j.id, () => releaseRequest(j.id), 'Job released. Other mechanics can accept it.')}>
                          Release
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="p3-item__side">
                    <span className={'vh-badge ' + st.badge}>{st.label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}