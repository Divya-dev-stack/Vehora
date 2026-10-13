import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { homeForRole } from '../utils/roles';
import './Splash.css';

const SPLASH_DURATION_MS = 2000;

export default function Splash() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return undefined;
    const timer = setTimeout(() => {
      navigate(user ? homeForRole(user.role) : '/login', { replace: true });
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [navigate, user, loading]);

  return (
    <main className="splash">
      <div className="splash__center">
        <img className="splash__logo" src="/logo/icon-round-512.png" alt="VEHORA" />
        <h1 className="splash__name">VEHORA</h1>
      </div>
      <p className="splash__tagline">Predict. Protect. Proceed.</p>
    </main>
  );
}
