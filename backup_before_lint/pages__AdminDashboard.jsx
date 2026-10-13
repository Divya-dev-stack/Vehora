import { useEffect, useState } from 'react';
import { BarChart3, ClipboardList, LogOut, Users, Wrench } from 'lucide-react';
import useAuth from '../hooks/useAuth';
import {
  getStats,
  listMechanics,
  listRequests,
  listUsers,
  setMechanicVerified,
  setUserActive,
} from '../services/adminApi';
import { getErrorMessage } from '../services/api';
import './Dashboard.css';
import './Vehicles.css';
import './Phase3.css';
import './Admin.css';

const TABS = [
  { key: 'overview', label: 'Overview', Icon: BarChart3 },
  { key: 'mechanics', label: 'Mechanics', Icon: Wrench },
  { key: 'users', label: 'Users', Icon: Users },
  { key: 'requests', label: 'Requests', Icon: ClipboardList },
];

const LOADERS = {
  overview: getStats,
  mechanics: listMechanics,
  users: listUsers,
  requests: listRequests,
};

const STATUS_BADGE = {
  open: 'vh-badge--warning',
  accepted: 'vh-badge--success',
  completed: 'vh-badge--success',
  cancelled: 'vh-badge--danger',
};

const ROLE_LABEL = { user: 'Owner', mechanic: 'Mechanic', admin: 'Admin' };

const fmt = (v) => (v ? new Date(v).toLocaleDateString() : '-');

const TARGET = {
  'Vehicle owners': 'users',
  Mechanics: 'mechanics',
  'Verified mechanics': 'mechanics',
  'Awaiting verification': 'mechanics',
  'Assistance requests': 'requests',
  'SOS requests': 'requests',
};

function Overview({ s, onOpen }) {
  const tiles = [
    ['Vehicle owners', s.users.owners],
    ['Mechanics', s.users.mechanics],
    ['Verified mechanics', s.mechanics.verified],
    ['Awaiting verification', s.mechanics.unverified],
    ['Vehicles', s.vehicles],
    ['Service records', s.service_records],
    ['Reminders', s.reminders],
    ['Assistance requests', s.assistance.total],
    ['SOS requests', s.assistance.sos],
    ['Complaints analysed', s.complaints.total],
  ];
  const cats = s.complaints.by_category;
  const max = Math.max(1, ...cats.map((c) => c.count));

  return (
    <div>
      <div className="adm-stats">
        {tiles.map(([label, num]) => (
          <div className={'adm-stat' + (TARGET[label] ? ' adm-stat--link' : '')} key={label} role={TARGET[label] ? 'button' : undefined} tabIndex={TARGET[label] ? 0 : undefined} onClick={TARGET[label] ? () => onOpen(TARGET[label]) : undefined} onKeyDown={TARGET[label] ? (e) => { if (e.key === 'Enter') onOpen(TARGET[label]); } : undefined}>
            <div className="adm-stat__num">{num}</div>
            <div className="adm-stat__label">{label}</div>
          </div>
        ))}
      </div>

      <section className="vh-card">
        <h2 className="dash__card-title">Assistance requests by status</h2>
        <p className="p3-item__meta">
          Open {s.assistance.open} | Accepted {s.assistance.accepted} | Completed {s.assistance.completed} | Cancelled {s.assistance.cancelled}
        </p>
      </section>

      <section className="vh-card" style={{ marginTop: 16 }}>
        <h2 className="dash__card-title">Complaint categories (AI assistant)</h2>
        {cats.length === 0 ? (
          <p className="p3-item__meta">No complaints analysed yet.</p>
        ) : (
          cats.map((c) => (
            <div className="adm-bar-row" key={c.category}>
              <span>{c.label}</span>
              <div className="adm-bar"><div className="adm-bar__fill" style={{ width: Math.round((c.count / max) * 100) + '%' }} /></div>
              <span>{c.count}</span>
            </div>
          ))
        )}
        <p className="adm-note">Counts come from complaints typed into the AI assistant. The classifier is an estimate, not a diagnosis.</p>
      </section>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('overview');
  const [result, setResult] = useState(null);
  const data = result && result.tab === tab ? result.value : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    
    LOADERS[tab]()
      .then((res) => {
        if (active) {
          setResult({ tab, value: res });
          setError('');
        }
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, reload]);

  const act = async (id, fn, okMessage) => {
    setBusy(id);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(okMessage);
      setReload((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const switchTab = (key) => {
    setTab(key);
    setNotice('');
    setError('');
  };

  return (
    <main className="dash">
      <div className="dash__inner">
        <header className="dash__top">
          <img className="dash__logo" src="/logo/icon-round-192.png" alt="VEHORA" />
          <div>
            <p className="dash__brand">VEHORA ADMIN</p>
            <h1 className="dash__greeting">Hello, {user.full_name}</h1>
          </div>
          <button className="vh-btn vh-btn--ghost vh-btn--sm dash__logout" onClick={logout}>
            <LogOut size={16} /> Log out
          </button>
        </header>

        <nav className="adm-tabs" aria-label="Admin sections">
          {TABS.map(({ key, label, Icon }) => (
            <button key={key} type="button" className="adm-tab" aria-pressed={tab === key} onClick={() => switchTab(key)}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        {notice && <div className="veh-alert veh-alert--success" role="status">{notice}</div>}
        {error && <div className="veh-alert" role="alert">{error}</div>}
        {loading && <div className="veh-state"><div className="vh-spinner" aria-label="Loading" /></div>}

        {!loading && data && tab === 'overview' && <Overview s={data} onOpen={switchTab} />}

        {!loading && data && tab === 'mechanics' && (
          <section className="vh-card">
            <h2 className="dash__card-title"><Wrench size={20} /> Mechanics</h2>
            {data.length === 0 ? (
              <p className="p3-item__meta">No mechanics have registered yet.</p>
            ) : (
              <ul className="p3-list">
                {data.map((m) => (
                  <li key={m.id} className="p3-item">
                    <div className="p3-item__main">
                      <h3 className="p3-item__title">{m.shop_name}</h3>
                      <p className="p3-item__meta">{m.city} | {m.phone} | {m.email || 'no email'}</p>
                      <div className="adm-badges">
                        <span className={'vh-badge ' + (m.verified ? 'vh-badge--success' : 'vh-badge--warning')}>
                          {m.verified ? 'Verified' : 'Not verified'}
                        </span>
                        <span className={'vh-badge ' + (m.is_available ? 'vh-badge--success' : 'vh-badge--danger')}>
                          {m.is_available ? 'Available' : 'Unavailable'}
                        </span>
                        <span className="vh-badge">{m.has_location ? 'Location shared' : 'No location'}</span>
                      </div>
                    </div>
                    <div className="p3-item__side">
                      <button
                        className={'vh-btn vh-btn--sm ' + (m.verified ? 'vh-btn--ghost' : 'vh-btn--primary')}
                        disabled={busy === m.id}
                        onClick={() =>
                          act(
                            m.id,
                            () => setMechanicVerified(m.id, !m.verified),
                            m.verified ? 'Verification removed.' : 'Mechanic verified.'
                          )
                        }
                      >
                        {m.verified ? 'Remove verification' : 'Verify'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="adm-note">Verify a mechanic only after checking the shop details, for example by calling the phone number.</p>
          </section>
        )}

        {!loading && data && tab === 'users' && (
          <section className="vh-card">
            <h2 className="dash__card-title"><Users size={20} /> Users</h2>
            <ul className="p3-list">
              {data.map((u) => (
                <li key={u.id} className="p3-item">
                  <div className="p3-item__main">
                    <h3 className="p3-item__title">{u.full_name}</h3>
                    <p className="p3-item__meta">{u.email} | Joined {fmt(u.created_at)}</p>
                    <div className="adm-badges">
                      <span className="vh-badge">{ROLE_LABEL[u.role] || u.role}</span>
                      <span className={'vh-badge ' + (u.is_active ? 'vh-badge--success' : 'vh-badge--danger')}>
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </div>
                  </div>
                  <div className="p3-item__side">
                    {u.role !== 'admin' && u.id !== user.id && (
                      <button
                        className="vh-btn vh-btn--ghost vh-btn--sm"
                        disabled={busy === u.id}
                        onClick={() =>
                          act(
                            u.id,
                            () => setUserActive(u.id, !u.is_active),
                            u.is_active ? 'Account deactivated.' : 'Account activated.'
                          )
                        }
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!loading && data && tab === 'requests' && (
          <section className="vh-card">
            <h2 className="dash__card-title"><ClipboardList size={20} /> Recent assistance requests</h2>
            {data.length === 0 ? (
              <p className="p3-item__meta">No requests yet.</p>
            ) : (
              <ul className="p3-list">
                {data.map((r) => (
                  <li key={r.id} className="p3-item">
                    <div className="p3-item__main">
                      <h3 className="p3-item__title">{r.service_label}</h3>
                      <p className="p3-item__meta">
                        {r.vehicle_label || 'Vehicle not given'} | {fmt(r.created_at)}
                        {r.mechanic_shop ? ' | ' + r.mechanic_shop : ''}
                      </p>
                    </div>
                    <div className="p3-item__side">
                      {r.is_sos && <span className="vh-badge vh-badge--danger">SOS</span>}
                      <span className={'vh-badge ' + (STATUS_BADGE[r.status] || '')}>{r.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="adm-note">Contact numbers and exact locations are not shown to administrators here.</p>
          </section>
        )}
      </div>
    </main>
  );
}


