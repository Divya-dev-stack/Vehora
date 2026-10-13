import { LogOut } from 'lucide-react';
import useAuth from '../hooks/useAuth';
import './Dashboard.css';

export default function RoleHome({ title, note }) {
  const { user, logout } = useAuth();

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

        <section className="vh-card">
          <span className="vh-badge vh-badge--warning">{user.role}</span>
          <h2 style={{ marginTop: 12 }}>{title}</h2>
          <p>{note}</p>
        </section>
      </div>
    </main>
  );
}
