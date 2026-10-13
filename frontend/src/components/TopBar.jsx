import { Link } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
import useAuth from '../hooks/useAuth';

export default function TopBar({ backTo = '/dashboard', backLabel = 'Dashboard' }) {
  const { user, logout } = useAuth();
  return (
    <>
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
      <Link className="vh-btn vh-btn--ghost vh-btn--sm p3-back" to={backTo}>
        <ArrowLeft size={16} /> {backLabel}
      </Link>
    </>
  );
}