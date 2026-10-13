import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ClipboardList, Plus, Trash2, Check } from 'lucide-react';
import TopBar from '../components/TopBar';
import { listVehicles } from '../services/vehicleApi';
import { getMechanicMeta } from '../services/mechanicApi';
import {
  listServiceRecords,
  createServiceRecord,
  deleteServiceRecord,
  listReminders,
  createReminder,
  completeReminder,
  deleteReminder,
} from '../services/careApi';
import { friendlyError } from '../utils/errors';
import {
  todayIso,
  formatDate,
  formatKm,
  formatMoney,
  REMINDER_STATUS,
  reminderDue,
} from '../utils/format';
import './Dashboard.css';
import './Vehicles.css';
import './Phase3.css';

function emptyRecord(vehicle) {
  return {
    vehicle_id: vehicle ? vehicle.id : '',
    service_date: todayIso(),
    service_type: 'oil_service',
    odometer_km: vehicle ? String(vehicle.mileage_km) : '',
    cost: '',
    workshop: '',
    notes: '',
    next_due_date: '',
    next_due_km: '',
  };
}

function emptyReminder(vehicle) {
  return { vehicle_id: vehicle ? vehicle.id : '', title: '', due_date: '', due_km: '' };
}

export default function Maintenance() {
  const [vehicles, setVehicles] = useState([]);
  const [meta, setMeta] = useState(null);
  const [records, setRecords] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rec, setRec] = useState(emptyRecord(null));
  const [rem, setRem] = useState(emptyReminder(null));
  const [recError, setRecError] = useState('');
  const [remError, setRemError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([listVehicles(), getMechanicMeta(), listServiceRecords(), listReminders(true)])
      .then(([vs, m, recs, rems]) => {
        if (!active) return;
        setVehicles(vs);
        setMeta(m);
        setRecords(recs);
        setReminders(rems);
        const first = vs.length > 0 ? vs[0] : null;
        setRec(emptyRecord(first));
        setRem(emptyReminder(first));
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

  const refreshAll = async () => {
    const [vs, recs, rems] = await Promise.all([listVehicles(), listServiceRecords(), listReminders(true)]);
    setVehicles(vs);
    setRecords(recs);
    setReminders(rems);
  };

  const onRec = (e) => {
    const { name, value } = e.target;
    setRec((r) => ({ ...r, [name]: value }));
  };

  const onRecVehicle = (e) => {
    const value = e.target.value;
    const v = vehicles.find((x) => x.id === value);
    setRec((r) => ({ ...r, vehicle_id: value, odometer_km: v ? String(v.mileage_km) : r.odometer_km }));
  };

  const onRem = (e) => {
    const { name, value } = e.target;
    setRem((r) => ({ ...r, [name]: value }));
  };

  const submitRecord = async (e) => {
    e.preventDefault();
    setNotice('');
    setRecError('');
    if (!rec.vehicle_id) {
      setRecError('Select a vehicle.');
      return;
    }
    if (!rec.service_date) {
      setRecError('Choose the service date.');
      return;
    }
    if (rec.odometer_km === '' || Number(rec.odometer_km) < 0) {
      setRecError('Enter the odometer reading in km.');
      return;
    }
    setBusy(true);
    try {
      await createServiceRecord({
        vehicle_id: rec.vehicle_id,
        service_date: rec.service_date,
        service_type: rec.service_type,
        odometer_km: Number(rec.odometer_km),
        cost: rec.cost === '' ? null : Number(rec.cost),
        workshop: rec.workshop.trim() || null,
        notes: rec.notes.trim() || null,
        next_due_date: rec.next_due_date || null,
        next_due_km: rec.next_due_km === '' ? null : Number(rec.next_due_km),
      });
      await refreshAll();
      setRec((r) => ({ ...emptyRecord(null), vehicle_id: r.vehicle_id, odometer_km: '' }));
      setNotice('Service record added.');
    } catch (err) {
      setRecError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const removeRecord = async (id) => {
    if (!window.confirm('Delete this service record?')) return;
    setNotice('');
    try {
      await deleteServiceRecord(id);
      await refreshAll();
      setNotice('Service record deleted.');
    } catch (err) {
      setRecError(friendlyError(err));
    }
  };

  const submitReminder = async (e) => {
    e.preventDefault();
    setNotice('');
    setRemError('');
    if (!rem.vehicle_id) {
      setRemError('Select a vehicle.');
      return;
    }
    if (rem.title.trim().length < 2) {
      setRemError('Enter a reminder title.');
      return;
    }
    if (!rem.due_date && rem.due_km === '') {
      setRemError('Set a due date, a due odometer reading, or both.');
      return;
    }
    setBusy(true);
    try {
      await createReminder({
        vehicle_id: rem.vehicle_id,
        title: rem.title.trim(),
        due_date: rem.due_date || null,
        due_km: rem.due_km === '' ? null : Number(rem.due_km),
      });
      await refreshAll();
      setRem((r) => ({ ...emptyReminder(null), vehicle_id: r.vehicle_id }));
      setShowReminderForm(false);
      setNotice('Reminder added.');
    } catch (err) {
      setRemError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const markDone = async (id) => {
    setNotice('');
    try {
      await completeReminder(id);
      await refreshAll();
    } catch (err) {
      setRemError(friendlyError(err));
    }
  };

  const removeReminder = async (id) => {
    if (!window.confirm('Delete this reminder?')) return;
    try {
      await deleteReminder(id);
      await refreshAll();
    } catch (err) {
      setRemError(friendlyError(err));
    }
  };

  const shownReminders = showDone ? reminders : reminders.filter((r) => !r.done);

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

  if (vehicles.length === 0) {
    return (
      <main className="dash">
        <div className="dash__inner">
          <TopBar />
          <section className="vh-card">
            <div className="dash__empty">
              <h3>Add a vehicle first</h3>
              <p>Service records and reminders belong to a vehicle.</p>
              <Link className="vh-btn vh-btn--primary" to="/vehicles/new">
                <Plus size={18} /> Add vehicle
              </Link>
            </div>
          </section>
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
          <section className="vh-card" aria-labelledby="add-record-title">
            <h2 className="dash__card-title" id="add-record-title">
              <ClipboardList size={20} /> Add service record
            </h2>
            <form onSubmit={submitRecord} noValidate>
              <div className="vh-field">
                <label className="vh-label" htmlFor="r_vehicle">Vehicle</label>
                <select id="r_vehicle" className="vh-input" value={rec.vehicle_id} onChange={onRecVehicle}>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.make} {v.model}</option>
                  ))}
                </select>
              </div>

              <div className="p3-row">
                <div className="vh-field">
                  <label className="vh-label" htmlFor="r_date">Service date</label>
                  <input id="r_date" name="service_date" type="date" max={todayIso()} className="vh-input" value={rec.service_date} onChange={onRec} />
                </div>
                <div className="vh-field">
                  <label className="vh-label" htmlFor="r_type">Service type</label>
                  <select id="r_type" name="service_type" className="vh-input" value={rec.service_type} onChange={onRec}>
                    {meta.service_types.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p3-row">
                <div className="vh-field">
                  <label className="vh-label" htmlFor="r_odo">Odometer (km)</label>
                  <input id="r_odo" name="odometer_km" type="number" min="0" inputMode="numeric" className="vh-input" value={rec.odometer_km} onChange={onRec} />
                </div>
                <div className="vh-field">
                  <label className="vh-label" htmlFor="r_cost">Cost in rupees (optional)</label>
                  <input id="r_cost" name="cost" type="number" min="0" inputMode="numeric" className="vh-input" value={rec.cost} onChange={onRec} />
                </div>
              </div>

              <div className="vh-field">
                <label className="vh-label" htmlFor="r_workshop">Workshop (optional)</label>
                <input id="r_workshop" name="workshop" className="vh-input" placeholder="Ravi Auto Works" value={rec.workshop} onChange={onRec} />
              </div>

              <div className="vh-field">
                <label className="vh-label" htmlFor="r_notes">Notes (optional)</label>
                <textarea id="r_notes" name="notes" className="vh-input p3-textarea" maxLength={300} value={rec.notes} onChange={onRec} />
              </div>

              <div className="p3-row">
                <div className="vh-field">
                  <label className="vh-label" htmlFor="r_next_date">Next service date (optional)</label>
                  <input id="r_next_date" name="next_due_date" type="date" min={rec.service_date} className="vh-input" value={rec.next_due_date} onChange={onRec} />
                </div>
                <div className="vh-field">
                  <label className="vh-label" htmlFor="r_next_km">Next service at km (optional)</label>
                  <input id="r_next_km" name="next_due_km" type="number" min="0" inputMode="numeric" className="vh-input" value={rec.next_due_km} onChange={onRec} />
                </div>
              </div>
              <p className="p3-note">If you set a next service date or km, a reminder is created automatically.</p>

              {recError && <div className="veh-alert" role="alert">{recError}</div>}

              <div className="veh-form__actions">
                <button className="vh-btn vh-btn--primary" type="submit" disabled={busy}>
                  {busy ? 'Saving...' : 'Add record'}
                </button>
              </div>
            </form>
          </section>

          <section className="vh-card" aria-labelledby="reminders-title">
            <h2 className="dash__card-title" id="reminders-title">
              <Bell size={20} /> Maintenance reminders
            </h2>

            <div className="p3-toolbar">
              <button className="vh-btn vh-btn--primary vh-btn--sm" type="button" onClick={() => setShowReminderForm((s) => !s)}>
                <Plus size={16} /> {showReminderForm ? 'Close' : 'New reminder'}
              </button>
              <label className="p3-check" style={{ margin: 0 }}>
                <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
                Show completed
              </label>
            </div>

            {showReminderForm && (
              <form onSubmit={submitReminder} noValidate className="p3-section-gap">
                <div className="vh-field">
                  <label className="vh-label" htmlFor="m_vehicle">Vehicle</label>
                  <select id="m_vehicle" name="vehicle_id" className="vh-input" value={rem.vehicle_id} onChange={onRem}>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>{v.make} {v.model}</option>
                    ))}
                  </select>
                </div>
                <div className="vh-field">
                  <label className="vh-label" htmlFor="m_title">Reminder</label>
                  <input id="m_title" name="title" className="vh-input" placeholder="Insurance renewal, chain lubrication..." value={rem.title} onChange={onRem} />
                </div>
                <div className="p3-row">
                  <div className="vh-field">
                    <label className="vh-label" htmlFor="m_date">Due date</label>
                    <input id="m_date" name="due_date" type="date" className="vh-input" value={rem.due_date} onChange={onRem} />
                  </div>
                  <div className="vh-field">
                    <label className="vh-label" htmlFor="m_km">Due at km</label>
                    <input id="m_km" name="due_km" type="number" min="0" inputMode="numeric" className="vh-input" value={rem.due_km} onChange={onRem} />
                  </div>
                </div>
                {remError && <div className="veh-alert" role="alert">{remError}</div>}
                <div className="veh-form__actions">
                  <button className="vh-btn vh-btn--primary" type="submit" disabled={busy}>Save reminder</button>
                </div>
              </form>
            )}

            {!showReminderForm && remError && <div className="veh-alert" role="alert">{remError}</div>}

            {shownReminders.length === 0 ? (
              <div className="dash__empty">
                <p>No reminders yet. Add a service record with a next service date, or create a reminder.</p>
              </div>
            ) : (
              <ul className="p3-list">
                {shownReminders.map((r) => {
                  const st = REMINDER_STATUS[r.status] || REMINDER_STATUS.upcoming;
                  return (
                    <li key={r.id} className={'p3-item' + (r.done ? ' p3-item--muted' : '')}>
                      <div className="p3-item__main">
                        <h3 className="p3-item__title">{r.title}</h3>
                        <p className="p3-item__meta">{r.vehicle_label} | {reminderDue(r)}</p>
                        <div className="p3-actions">
                          {!r.done && (
                            <button className="vh-btn vh-btn--ghost vh-btn--sm" type="button" onClick={() => markDone(r.id)}>
                              <Check size={16} /> Mark done
                            </button>
                          )}
                          <button className="vh-btn vh-btn--ghost vh-btn--sm" type="button" onClick={() => removeReminder(r.id)}>
                            <Trash2 size={16} /> Delete
                          </button>
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

          <section className="vh-card dash__span-2" aria-labelledby="history-title">
            <h2 className="dash__card-title" id="history-title">
              <ClipboardList size={20} /> Service history
            </h2>
            {records.length === 0 ? (
              <div className="dash__empty">
                <p>No service records yet. Add your first record above.</p>
              </div>
            ) : (
              <ul className="p3-list">
                {records.map((r) => (
                  <li key={r.id} className="p3-item">
                    <div className="p3-item__main">
                      <h3 className="p3-item__title">{r.service_label}</h3>
                      <p className="p3-item__meta">
                        {r.vehicle_label} | {formatDate(r.service_date)} | {formatKm(r.odometer_km)}
                        {r.cost !== null && r.cost !== undefined ? ' | ' + formatMoney(r.cost) : ''}
                      </p>
                      {r.workshop && <p className="p3-item__meta">Workshop: {r.workshop}</p>}
                      {r.notes && <p className="p3-item__meta">{r.notes}</p>}
                    </div>
                    <div className="p3-item__side">
                      <button className="vh-btn vh-btn--ghost vh-btn--sm" type="button" onClick={() => removeRecord(r.id)}>
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}