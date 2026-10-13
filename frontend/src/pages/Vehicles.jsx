import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import VehicleFacts from '../components/VehicleFacts';
import { deleteVehicle, listVehicles } from '../services/vehicleApi';
import { getErrorMessage } from '../services/api';
import { getVehicleIcon, prettyType } from '../utils/vehicle';
import './Dashboard.css';
import './Vehicles.css';

export default function Vehicles() {
  const location = useLocation();
  const [vehicles, setVehicles] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.notice || '');
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    listVehicles()
      .then((rows) => {
        if (active) setVehicles(rows);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      });
    return () => {
      active = false;
    };
  }, []);

  const confirmDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await deleteVehicle(toDelete.id);
      setVehicles((list) => list.filter((v) => v.id !== toDelete.id));
      setNotice('Vehicle deleted.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  return (
    <main className="dash">
      <div className="dash__inner">
        <PageHeader title="My vehicles" />

        {notice && <div className="veh-alert veh-alert--success" role="status">{notice}</div>}
        {error && <div className="veh-alert" role="alert">{error}</div>}

        {vehicles === null && !error && (
          <div className="veh-state"><div className="vh-spinner" aria-label="Loading" /></div>
        )}

        {vehicles && (
          <div className="veh-toolbar">
            <p>{vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'}</p>
            <Link className="vh-btn vh-btn--primary vh-btn--sm" to="/vehicles/new">
              <Plus size={16} /> Add vehicle
            </Link>
          </div>
        )}

        {vehicles && vehicles.length === 0 && (
          <div className="vh-card veh-state">
            <h3>No vehicles yet</h3>
            <p>Add your first bike, car, auto-rickshaw or commercial vehicle.</p>
            <Link className="vh-btn vh-btn--primary" to="/vehicles/new">Add vehicle</Link>
          </div>
        )}

        {vehicles && vehicles.length > 0 && (
          <div className="veh-grid">
            {vehicles.map((v) => {
              const Icon = getVehicleIcon(v.vehicle_type);
              return (
                <article className="vh-card veh-card" key={v.id}>
                  <div className="veh-card__head">
                    <span className="veh-card__icon"><Icon size={26} /></span>
                    <div>
                      <h3 className="veh-card__title">{v.make} {v.model}</h3>
                      <p className="veh-card__sub">{prettyType(v.vehicle_type)} · {v.year}</p>
                    </div>
                  </div>
                  <VehicleFacts vehicle={v} />
                  <div className="veh-card__actions">
                    <Link className="vh-btn vh-btn--ghost vh-btn--sm" to={'/vehicles/' + v.id + '/edit'}>
                      <Pencil size={16} /> Edit
                    </Link>
                    <button className="vh-btn vh-btn--ghost vh-btn--sm" onClick={() => setToDelete(v)}>
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {toDelete && (
        <div className="veh-modal" role="dialog" aria-modal="true" aria-labelledby="del-title">
          <div className="vh-card veh-modal__box">
            <h3 id="del-title">Delete this vehicle?</h3>
            <p>
              {toDelete.make} {toDelete.model} will be removed from your account. This cannot be undone.
            </p>
            <div className="veh-modal__actions">
              <button className="vh-btn vh-btn--ghost" onClick={() => setToDelete(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="vh-btn vh-btn--danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
