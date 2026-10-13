import { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import { getAssessment } from '../services/assessmentApi';
import { getErrorMessage } from '../services/api';
import './Assessment.css';

const BADGE = { good: 'vh-badge--success', fair: 'vh-badge--warning', poor: 'vh-badge--danger' };

export default function HealthCard({ vehicle }) {
  const [result, setResult] = useState(null);
  const vehicleId = vehicle ? vehicle.id : '';
  const key = vehicle ? [vehicle.id, vehicle.mileage_km, vehicle.last_service_date, vehicle.year].join('|') : '';

  useEffect(() => {
    if (!vehicleId) return undefined;
    let active = true;
    getAssessment(vehicleId)
      .then((res) => {
        if (active) setResult({ key, data: res, error: '' });
      })
      .catch((err) => {
        if (active) setResult({ key, data: null, error: getErrorMessage(err) });
      });
    return () => {
      active = false;
    };
  }, [key, vehicleId]);

  const current = result && result.key === key ? result : null;
  const data = current ? current.data : null;
  const error = current ? current.error : '';
  const loading = Boolean(vehicleId) && current === null;

  return (
    <section className="vh-card" aria-labelledby="health-title">
      <h2 className="dash__card-title" id="health-title">
        <Gauge size={20} /> Vehicle health assessment
      </h2>
      <span className="vh-badge vh-badge--warning">Estimate only</span>

      {!vehicle && (
        <div className="dash__empty">
          <h3>No assessment yet</h3>
          <p>Add a vehicle to see a health estimate based on its service history and reminders.</p>
        </div>
      )}

      {vehicle && loading && !data && (
        <div className="veh-state"><div className="vh-spinner" aria-label="Loading" /></div>
      )}

      {error && <div className="veh-alert" role="alert">{error}</div>}

      {data && (
        <div>
          <div className="hc-top">
            <div className="hc-score">{data.score}<small> / 100</small></div>
            <span className={'vh-badge ' + (BADGE[data.status] || '')}>{data.status_label}</span>
          </div>
          <div className="hc-bar" aria-hidden="true">
            <div className="hc-bar__fill" style={{ width: data.score + '%' }} />
          </div>

          <ul className="hc-list">
            {data.factors.map((f) => (
              <li className="hc-row" key={f.key}>
                <span>
                  {f.label}
                  <span className="hc-detail">{f.detail}</span>
                </span>
                <span>{f.points === 0 ? 'OK' : f.points}</span>
              </li>
            ))}
          </ul>

          <ul className="hc-recs">
            {data.recommendations.map((r) => <li key={r}>{r}</li>)}
          </ul>

          {data.data_quality === 'limited' && (
            <p className="hc-note">Limited data: add service records for a more reliable estimate.</p>
          )}
          <p className="hc-note">{data.method}</p>
          <p className="hc-note">{data.disclaimer}</p>
        </div>
      )}
    </section>
  );
}
