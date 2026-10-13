import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Siren, MapPin, Phone, Plus, X } from 'lucide-react';
import TopBar from '../components/TopBar';
import useAuth from '../hooks/useAuth';
import { listVehicles } from '../services/vehicleApi';
import { getMechanicMeta } from '../services/mechanicApi';
import { createAssistance, listMyAssistance, cancelAssistance } from '../services/assistApi';
import { getPosition } from '../utils/geo';
import { friendlyError } from '../utils/errors';
import { formatDateTime } from '../utils/format';
import './Dashboard.css';
import './Vehicles.css';
import './Phase3.css';

const PHONE_RE = /^[0-9]{10}$/;

const STATUS = {
  open: { label: 'Waiting for a mechanic', badge: 'vh-badge--warning' },
  accepted: { label: 'Mechanic accepted', badge: 'vh-badge--success' },
  completed: { label: 'Completed', badge: 'vh-badge--success' },
  cancelled: { label: 'Cancelled', badge: 'vh-badge--danger' },
};

export default function AssistanceRequest() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [vehicles, setVehicles] = useState([]);
  const [meta, setMeta] = useState(null);
  const [requests, setRequests] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({
    vehicle_id: '',
    service_type: 'battery',
    description: '',
    contact_phone: user.phone || '',
    location_text: '',
    is_sos: params.get('sos') === '1',
  });
  const [pos, setPos] = useState(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([listVehicles(), getMechanicMeta(), listMyAssistance()])
      .then(([vs, m, reqs]) => {
        if (!active) return;
        setVehicles(vs);
        setMeta(m);
        setRequests(reqs);
        if (vs.length > 0) setForm((f) => ({ ...f, vehicle_id: vs[0].id }));
      })
      .catch((err) => {
        if (active) setLoadError(friendlyError(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const hasActive = Boolean(requests && requests.some((r) => r.status === 'open' || r.status === 'accepted'));

  useEffect(() => {
    if (!hasActive) return undefined;
    const timer = setInterval(() => {
      listMyAssistance().then(setRequests).catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [hasActive]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const shareLocation = async () => {
    setLocating(true);
    setError('');
    try {
      setPos(await getPosition());
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLocating(false);
    }
  };

  const validate = () => {
    if (!PHONE_RE.test(form.contact_phone.trim())) return 'Enter a 10-digit mobile number.';
    if (!form.is_sos && !form.vehicle_id) return 'Select a vehicle. Add one first if the list is empty.';
    if (!pos && form.location_text.trim().length < 3) return 'Share your location or type a landmark or address.';
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    setNotice('');
    const problem = validate();
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      await createAssistance({
        vehicle_id: form.vehicle_id || null,
        service_type: form.is_sos ? 'emergency' : form.service_type,
        description: form.description.trim() || null,
        contact_phone: form.contact_phone.trim(),
        latitude: pos ? pos.lat : null,
        longitude: pos ? pos.lng : null,
        location_text: form.location_text.trim() || null,
        is_sos: form.is_sos,
      });
      setRequests(await listMyAssistance());
      setForm((f) => ({ ...f, description: '', location_text: '' }));
      setNotice('Request sent. Nearby mechanics can now see it.');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id) => {
    if (!window.confirm('Cancel this request?')) return;
    setError('');
    try {
      await cancelAssistance(id);
      setRequests(await listMyAssistance());
      setNotice('Request cancelled.');
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  if (loading) {
    return (
      <main className="dash">
        <div className="dash__inner">
          <TopBar />
          <div className="veh-state"><div className="vh-spinner" aria-label="Loading" /></div>
        </div>
      </main>
    );
  }

  if (loadError || !meta) {
    return (
      <main className="dash">
        <div className="dash__inner">
          <TopBar />
          <div className="veh-alert" role="alert">{loadError || 'Could not load this page.'}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="dash">
      <div className="dash__inner">
        <TopBar />

        {notice && <div className="veh-alert veh-alert--success" role="status">{notice}</div>}

        <div className="dash__grid">
          <section className="vh-card" aria-labelledby="assist-title">
            <h2 className="dash__card-title" id="assist-title">
              <Siren size={20} /> Roadside assistance
            </h2>

            {hasActive ? (
              <div className="dash__empty">
                <h3>You have an active request</h3>
                <p>Track it in the list. You can send a new request after it is completed or cancelled.</p>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <label className="p3-check">
                  <input type="checkbox" name="is_sos" checked={form.is_sos} onChange={onChange} />
                  This is an emergency (SOS)
                </label>

                {form.is_sos && (
                  <div className="p3-warn" role="note">
                    For accidents, injuries or fire, call 112 first. VEHORA SOS only alerts nearby mechanics. It does not contact police or ambulance.
                  </div>
                )}

                <div className="vh-field">
                  <label className="vh-label" htmlFor="a_vehicle">Vehicle{form.is_sos ? ' (optional)' : ''}</label>
                  <select id="a_vehicle" name="vehicle_id" className="vh-input" value={form.vehicle_id} onChange={onChange}>
                    {form.is_sos && <option value="">Not selected</option>}
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>{v.make} {v.model}</option>
                    ))}
                  </select>
                  {vehicles.length === 0 && (
                    <span className="p3-note">No vehicle added yet. <Link to="/vehicles/new">Add a vehicle</Link></span>
                  )}
                </div>

                {!form.is_sos && (
                  <div className="vh-field">
                    <label className="vh-label" htmlFor="a_type">What is the problem?</label>
                    <select id="a_type" name="service_type" className="vh-input" value={form.service_type} onChange={onChange}>
                      {meta.service_types.map((s) => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="vh-field">
                  <label className="vh-label" htmlFor="a_desc">Details (optional)</label>
                  <textarea id="a_desc" name="description" className="vh-input p3-textarea" maxLength={300} placeholder="Bike stopped near the signal, will not start" value={form.description} onChange={onChange} />
                </div>

                <div className="vh-field">
                  <label className="vh-label" htmlFor="a_phone">Your contact number</label>
                  <input id="a_phone" name="contact_phone" type="tel" className="vh-input" placeholder="10-digit number" value={form.contact_phone} onChange={onChange} />
                </div>

                <div className="vh-field">
                  <span className="vh-label">Where are you?</span>
                  <div className="p3-toolbar">
                    <button className="vh-btn vh-btn--ghost vh-btn--sm" type="button" onClick={shareLocation} disabled={locating}>
                      <MapPin size={16} /> {locating ? 'Finding...' : pos ? 'Update my location' : 'Share my current location'}
                    </button>
                    {pos && <span className="vh-badge vh-badge--success">Location added</span>}
                  </div>
                  <input name="location_text" className="vh-input" placeholder="Landmark or address (optional if location is shared)" value={form.location_text} onChange={onChange} />
                </div>

                <p className="p3-note">
                  Your phone number and location are shown only to the mechanic who accepts your request.
                </p>

                {error && <div className="veh-alert" role="alert">{error}</div>}

                <div className="veh-form__actions">
                  <button className="vh-btn vh-btn--primary" type="submit" disabled={busy}>
                    <Plus size={18} /> {busy ? 'Sending...' : form.is_sos ? 'Send SOS' : 'Request help'}
                  </button>
                </div>
              </form>
            )}

            {hasActive && error && <div className="veh-alert" role="alert">{error}</div>}
          </section>

          <section className="vh-card" aria-labelledby="myreq-title">
            <h2 className="dash__card-title" id="myreq-title">
              <Siren size={20} /> My requests
            </h2>

            {!requests || requests.length === 0 ? (
              <div className="dash__empty">
                <p>No requests yet.</p>
              </div>
            ) : (
              <ul className="p3-list">
                {requests.map((r) => {
                  const st = STATUS[r.status] || STATUS.open;
                  const active = r.status === 'open' || r.status === 'accepted';
                  return (
                    <li key={r.id} className={'p3-item' + (r.is_sos ? ' p3-item--sos' : '') + (active ? '' : ' p3-item--muted')}>
                      <div className="p3-item__main">
                        <h3 className="p3-item__title">{r.is_sos ? 'SOS' : r.service_label}</h3>
                        <p className="p3-item__meta">
                          {r.vehicle_label ? r.vehicle_label + ' | ' : ''}{formatDateTime(r.created_at)}
                        </p>
                        {r.description && <p className="p3-item__meta">{r.description}</p>}
                        {r.status === 'accepted' && (
                          <p className="p3-item__meta">
                            Accepted by <strong>{r.mechanic_shop}</strong>
                          </p>
                        )}
                        <div className="p3-actions">
                          {r.status === 'accepted' && r.mechanic_phone && (
                            <a className="vh-btn vh-btn--primary vh-btn--sm" href={'tel:' + r.mechanic_phone}>
                              <Phone size={16} /> Call {r.mechanic_phone}
                            </a>
                          )}
                          {active && (
                            <button className="vh-btn vh-btn--ghost vh-btn--sm" type="button" onClick={() => cancel(r.id)}>
                              <X size={16} /> Cancel
                            </button>
                          )}
                        </div>
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
        </div>
      </div>
    </main>
  );
}