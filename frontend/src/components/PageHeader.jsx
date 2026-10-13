import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PageHeader({ title, backTo = '/dashboard', backLabel = 'Dashboard' }) {
  return (
    <header className="dash__top">
      <img className="dash__logo" src="/logo/icon-round-192.png" alt="VEHORA" />
      <div>
        <p className="dash__brand">VEHORA</p>
        <h1 className="dash__greeting">{title}</h1>
      </div>
      <Link className="vh-btn vh-btn--ghost vh-btn--sm dash__logout" to={backTo}>
        <ArrowLeft size={16} /> {backLabel}
      </Link>
    </header>
  );
}
