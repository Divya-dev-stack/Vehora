import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import {
  createVehicle,
  getVehicle,
  getVehicleMeta,
  updateVehicle,
} from '../services/vehicleApi';
import { getErrorMessage } from '../services/api';
import { prettyFuel } from '../utils/vehicle';
import './Dashboard.css';
import './Vehicles.css';

const MAX_YEAR = new Date().getFullYear() + 1;
const REG_RE = /^[A-Za-z0-9 -]{4,15}$/;

const EMPTY = {
  vehicle_type: '',
  make: '',
  model: '',
  year: '',
  registration_number: '',
  fuel_type: '',
  mileage_km: '',
  last_service_date: '',
};

function todayLocal() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function Field({ id, label, error, children }) {
  return (
    <div className="vh-field">
      <label className="vh-label" htmlFor={id}>{label}</label>
      {children}
      {error && <span className="vh-error-text">{error}</span>}
    </div>
  );
}

export default function VehicleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    let active = true;
    const jobs = [getVehicleMeta()];
    if (id) jobs.push(getVehicle(id));
    Promise.all(jobs)
      .then(([m, v]) => {
        if (!active) return;
        setMeta(m);
        if (v) {
          setForm({
            vehicle_type: v.vehicle_type,
            make: v.make,
            model: v.model,
            year: String(v.year),
            registration_number: v.registration_number || '',
            fuel_type: v.fuel_type,
            mileage_km: String(v.mileage_km),
            last_service_date: v.last_service_date || '',
          });
        }
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
  }, [id]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.vehicle_type) e.vehicle_type = 'Choose a vehicle type.';
    if (!form.make.trim()) e.make = 'Enter the make (brand).';
    if (!form.model.trim()) e.model = 'Enter the model.';
    const y = Number(form.year);
    if (!Number.isInteger(y) || y < 1980 || y > MAX_YEAR) {
      e.year = 'Enter a year between 1980 and ' + MAX_YEAR + '.';
    }
    if (!form.fuel_type) e.fuel_type = 'Choose the fuel type.';
    const km = Number(form.mileage_km);
    if (form.mileage_km === '' || !Number.isInteger(km) || km < 0 || km > 2000000) {
      e.mileage_km = 'Enter the odometer reading in whole km.';
    }
    const reg = form.registration_number.trim();
    if (reg && !REG_RE.test(reg)) {
      e.registration_number = 'Use letters, numbers, spaces or hyphens (4 to 15 characters).';
    }
    if (form.last_service_date && form.last_service_date > todayLocal()) {
      e.last_service_date = 'Service date cannot be in the future.';
    }
    return e;
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setServerError('');
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = {
      vehicle_type: form.vehicle_type,
      make: form.make.trim(),
      model: form.model.trim(),
      year: Number(form.year),
      registration_number: form.registration_number.trim() || null,
      fuel_type: form.fuel_type,
      mileage_km: Number(form.mileage_km),
      last_service_date: form.last_service_date || null,
    };

    setSaving(true);
    try {
      if (editing) await updateVehicle(id, payload);
      else await createVehicle(payload);
      navigate('/vehicles', {
        state: { notice: editing ? 'Vehicle updated.' : 'Vehicle added.' },
        replace: true,
      });
    } catch (err) {
      setServerError(getErrorMessage(err));
      setSaving(false);
    }
  };

  const title = editing ? 'Edit vehicle' : 'Add vehicle';

  if (loading) {
    return (
      <main className="dash">
        <div className="dash__inner">
          <PageHeader title={title} backTo="/vehicles" backLabel="Vehicles" />
          <div className="veh-state"><div className="vh-spinner" aria-label="Loading" /></div>
        </div>
      </main>
    );
  }

  if (!meta) {
    return (
      <main className="dash">
        <div className="dash__inner">
          <PageHeader title={title} backTo="/vehicles" backLabel="Vehicles" />
          <div className="veh-alert" role="alert">{serverError || 'Could not load the form.'}</div>
        </div>
      </main>
    );
  }

  const cls = (name) => 'vh-input' + (errors[name] ? ' vh-input--error' : '');

  return (
    <main className="dash">
      <div className="dash__inner">
        <PageHeader title={title} backTo="/vehicles" backLabel="Vehicles" />

        <form className="vh-card veh-form" onSubmit={onSubmit} noValidate>
          {serverError && <div className="veh-alert" role="alert">{serverError}</div>}

          <Field id="vehicle_type" label="Vehicle type" error={errors.vehicle_type}>
            <select id="vehicle_type" name="vehicle_type" className={cls('vehicle_type')} value={form.vehicle_type} onChange={onChange}>
              <option value="">Select type</option>
              {meta.types.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </Field>

          <div className="veh-form__row">
            <Field id="make" label="Make (brand)" error={errors.make}>
              <input id="make" name="make" className={cls('make')} placeholder="Honda" value={form.make} onChange={onChange} />
            </Field>
            <Field id="model" label="Model" error={errors.model}>
              <input id="model" name="model" className={cls('model')} placeholder="Shine" value={form.model} onChange={onChange} />
            </Field>
          </div>

          <div className="veh-form__row">
            <Field id="year" label="Year" error={errors.year}>
              <input id="year" name="year" type="number" inputMode="numeric" className={cls('year')} placeholder="2021" value={form.year} onChange={onChange} />
            </Field>
            <Field id="fuel_type" label="Fuel type" error={errors.fuel_type}>
              <select id="fuel_type" name="fuel_type" className={cls('fuel_type')} value={form.fuel_type} onChange={onChange}>
                <option value="">Select fuel</option>
                {meta.fuel_types.map((f) => (
                  <option key={f} value={f}>{prettyFuel(f)}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field id="registration_number" label="Registration number (optional)" error={errors.registration_number}>
            <input id="registration_number" name="registration_number" className={cls('registration_number')} placeholder="TN09AB1234" value={form.registration_number} onChange={onChange} />
          </Field>

          <div className="veh-form__row">
            <Field id="mileage_km" label="Odometer (km)" error={errors.mileage_km}>
              <input id="mileage_km" name="mileage_km" type="number" inputMode="numeric" className={cls('mileage_km')} placeholder="18500" value={form.mileage_km} onChange={onChange} />
            </Field>
            <Field id="last_service_date" label="Last service date (optional)" error={errors.last_service_date}>
              <input id="last_service_date" name="last_service_date" type="date" max={todayLocal()} className={cls('last_service_date')} value={form.last_service_date} onChange={onChange} />
            </Field>
          </div>

          <div className="veh-form__actions">
            <button className="vh-btn vh-btn--primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Add vehicle'}
            </button>
            <button className="vh-btn vh-btn--ghost" type="button" onClick={() => navigate('/vehicles')} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
