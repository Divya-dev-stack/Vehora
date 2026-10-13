import { useEffect, useState } from 'react';
import { LogOut, Pencil, Wrench } from 'lucide-react';
import useAuth from '../hooks/useAuth';
import { getMechanicMeta, getMyProfile, saveMyProfile } from '../services/mechanicApi';
import { getErrorMessage } from '../services/api';
import './Dashboard.css';
import './Vehicles.css';
import './Mechanic.css';
import './Phase3.css';
import MechanicWork from '../components/MechanicWork';

const PHONE_RE = /^[0-9]{10}$/;

function emptyForm(phone) {
  return {
    shop_name: '',
    phone: phone || '',
    city: '',
    address: '',
    vehicle_types: [],
    service_types: [],
    working_hours: '',
    is_available: true,
  };
}

function toForm(p) {
  return {
    shop_name: p.shop_name,
    phone: p.phone,
    city: p.city,
    address: p.address || '',
    vehicle_types: p.vehicle_types,
    service_types: p.service_types,
    working_hours: p.working_hours || '',
    is_available: p.is_available,
  };
}

function toPayload(f) {
  return {
    shop_name: f.shop_name.trim(),
    phone: f.phone.trim(),
    city: f.city.trim(),
    address: f.address.trim() || null,
    vehicle_types: f.vehicle_types,
    service_types: f.service_types,
    working_hours: f.working_hours.trim() || null,
    is_available: f.is_available,
  };
}

export default function MechanicDashboard() {
  const { user, logout } = useAuth();
  const [meta, setMeta] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm(user.phone));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getMechanicMeta(), getMyProfile()])
      .then(([m, p]) => {
        if (!active) return;
        setMeta(m);
        setProfile(p);
        if (p) setForm(toForm(p));
        else setEditing(true);
      })
      .catch((err) => {
        if (active) setServerError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const typeLabel = meta ? Object.fromEntries(meta.vehicle_types.map((t) => [t.key, t.label])) : {};
  const serviceLabel = meta ? Object.fromEntries(meta.service_types.map((s) => [s.key, s.label])) : {};

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    setErrors((er) => ({ ...er, [name]: '' }));
  };

  const toggleKey = (field, key) => {
    setForm((f) => {
      const has = f[field].includes(key);
      return { ...f, [field]: has ? f[field].filter((k) => k !== key) : [...f[field], key] };
    });
    setErrors((er) => ({ ...er, [field]: '' }));
  };

  const validate = () => {
    const e = {};
    if (form.shop_name.trim().length < 2) e.shop_name = 'Enter your shop or garage name.';
    if (!PHONE_RE.test(form.phone.trim())) e.phone = 'Enter a 10-digit mobile number.';
    if (form.city.trim().length < 2) e.city = 'Enter your city.';
    if (form.vehicle_types.length === 0) e.vehicle_types = 'Select at least one vehicle type.';
    if (form.service_types.length === 0) e.service_types = 'Select at least one service.';
    return e;
  };

  const save = async (payload, okMessage) => {
    setSaving(true);
    setServerError('');
    try {
      const saved = await saveMyProfile(payload);
      setProfile(saved);
      setForm(toForm(saved));
      setEditing(false);
      setNotice(okMessage);
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (ev) => {
    ev.preventDefault();
    setNotice('');
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    save(toPayload(form), 'Profile saved.');
  };

  const toggleAvailability = () => {
    setNotice('');
    const payload = { ...toPayload(toForm(profile)), is_available: !profile.is_available };
    save(payload, payload.is_available ? 'You are now available.' : 'You are now unavailable.');
  };

  const cancelEdit = () => {
    if (profile) setForm(toForm(profile));
    setErrors({});
    setServerError('');
    setEditing(false);
  };

  const cls = (name) => 'vh-input' + (errors[name] ? ' vh-input--error' : '');

  const header = (
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
  );

  if (loading) {
    return (
      <main className="dash">
        <div className="dash__inner">
          {header}
          <div className="veh-state"><div className="vh-spinner" aria-label="Loading" /></div>
        </div>
      </main>
    );
  }

  if (!meta) {
    return (
      <main className="dash">
        <div className="dash__inner">
          {header}
          <div className="veh-alert" role="alert">{serverError || 'Could not load your dashboard.'}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="dash">
      <div className="dash__inner">
        {header}

        {notice && <div className="veh-alert veh-alert--success" role="status">{notice}</div>}
        {serverError && <div className="veh-alert" role="alert">{serverError}</div>}

        <div className="dash__grid">
          <section className="vh-card" aria-labelledby="profile-title">
            <h2 className="dash__card-title" id="profile-title">
              <Wrench size={20} /> Shop profile
            </h2>

            {editing ? (
              <form onSubmit={onSubmit} noValidate>
                <div className="vh-field">
                  <label className="vh-label" htmlFor="shop_name">Shop or garage name</label>
                  <input id="shop_name" name="shop_name" className={cls('shop_name')} placeholder="Ravi Auto Works" value={form.shop_name} onChange={onChange} />
                  {errors.shop_name && <span className="vh-error-text">{errors.shop_name}</span>}
                </div>

                <div className="veh-form__row">
                  <div className="vh-field">
                    <label className="vh-label" htmlFor="phone">Contact number</label>
                    <input id="phone" name="phone" type="tel" className={cls('phone')} placeholder="10-digit number" value={form.phone} onChange={onChange} />
                    {errors.phone && <span className="vh-error-text">{errors.phone}</span>}
                  </div>
                  <div className="vh-field">
                    <label className="vh-label" htmlFor="city">City</label>
                    <input id="city" name="city" className={cls('city')} placeholder="Chennai" value={form.city} onChange={onChange} />
                    {errors.city && <span className="vh-error-text">{errors.city}</span>}
                  </div>
                </div>

                <div className="vh-field">
                  <label className="vh-label" htmlFor="address">Address (optional)</label>
                  <input id="address" name="address" className={cls('address')} placeholder="Street, area" value={form.address} onChange={onChange} />
                </div>

                <div className="vh-field">
                  <label className="vh-label" htmlFor="working_hours">Working hours (optional)</label>
                  <input id="working_hours" name="working_hours" className={cls('working_hours')} placeholder="Mon-Sat, 9 AM to 7 PM" value={form.working_hours} onChange={onChange} />
                </div>

                <div className="mech-group">
                  <h4>Vehicles you work on</h4>
                  <div className="mech-chips">
                    {meta.vehicle_types.map((t) => (
                      <button
                        type="button"
                        key={t.key}
                        className="mech-chip"
                        aria-pressed={form.vehicle_types.includes(t.key)}
                        onClick={() => toggleKey('vehicle_types', t.key)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {errors.vehicle_types && <span className="vh-error-text">{errors.vehicle_types}</span>}
                </div>

                <div className="mech-group">
                  <h4>Problems and services you handle</h4>
                  <div className="mech-chips">
                    {meta.service_types.map((s) => (
                      <button
                        type="button"
                        key={s.key}
                        className="mech-chip"
                        aria-pressed={form.service_types.includes(s.key)}
                        onClick={() => toggleKey('service_types', s.key)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {errors.service_types && <span className="vh-error-text">{errors.service_types}</span>}
                </div>

                <label className="mech-check">
                  <input type="checkbox" name="is_available" checked={form.is_available} onChange={onChange} />
                  I am available for requests
                </label>

                <div className="veh-form__actions">
                  <button className="vh-btn vh-btn--primary" type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save profile'}
                  </button>
                  {profile && (
                    <button className="vh-btn vh-btn--ghost" type="button" onClick={cancelEdit} disabled={saving}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <div>
                <h3 style={{ marginBottom: 8 }}>{profile.shop_name}</h3>
                <div className="mech-badges">
                  <span className={'vh-badge ' + (profile.verified ? 'vh-badge--success' : 'vh-badge--warning')}>
                    {profile.verified ? 'Verified' : 'Not verified yet'}
                  </span>
                  <span className={'vh-badge ' + (profile.is_available ? 'vh-badge--success' : 'vh-badge--danger')}>
                    {profile.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </div>

                <dl className="mech-facts">
                  <div className="veh-fact"><dt>Contact</dt><dd>{profile.phone}</dd></div>
                  <div className="veh-fact"><dt>City</dt><dd>{profile.city}</dd></div>
                  <div className="veh-fact"><dt>Address</dt><dd>{profile.address || 'Not added'}</dd></div>
                  <div className="veh-fact"><dt>Working hours</dt><dd>{profile.working_hours || 'Not added'}</dd></div>
                </dl>

                <div className="mech-group">
                  <h4>Vehicles you work on</h4>
                  <div className="mech-chips">
                    {profile.vehicle_types.map((k) => (
                      <span key={k} className="mech-chip mech-chip--static">{typeLabel[k] || k}</span>
                    ))}
                  </div>
                </div>

                <div className="mech-group">
                  <h4>Problems and services you handle</h4>
                  <div className="mech-chips">
                    {profile.service_types.map((k) => (
                      <span key={k} className="mech-chip mech-chip--static">{serviceLabel[k] || k}</span>
                    ))}
                  </div>
                </div>

                <div className="veh-card__actions">
                  <button className="vh-btn vh-btn--ghost vh-btn--sm" onClick={() => { setNotice(''); setEditing(true); }}>
                    <Pencil size={16} /> Edit profile
                  </button>
                  <button className="vh-btn vh-btn--ghost vh-btn--sm" onClick={toggleAvailability} disabled={saving}>
                    {profile.is_available ? 'Set unavailable' : 'Set available'}
                  </button>
                </div>

                {!profile.verified && (
                  <p className="mech-note">
                    An administrator verifies mechanics. Until then customers will see your listing as unverified.
                  </p>
                )}
              </div>
            )}
          </section>

          <MechanicWork hasProfile={Boolean(profile)} available={profile ? profile.is_available : true} />
        </div>
      </div>
    </main>
  );
}

