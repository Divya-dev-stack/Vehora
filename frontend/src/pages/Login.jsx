import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { getErrorMessage } from '../services/api';
import useAuth from '../hooks/useAuth';
import { homeForRole } from '../utils/roles';
import './Auth.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: '' }));
  };

  const validate = () => {
    const next = {};
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (!form.password) next.password = 'Enter your password.';
    return next;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const loggedIn = await login(form.email.trim(), form.password);
      navigate(homeForRole(loggedIn.role), { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth">
      <section className="vh-card auth__card">
        <div className="auth__brand">
          <img className="auth__logo" src="/logo/icon-round-192.png" alt="VEHORA" />
          <h1 className="auth__title">Welcome back</h1>
          <p className="auth__subtitle">Log in to continue with VEHORA</p>
        </div>

        {serverError && <div className="auth__alert" role="alert">{serverError}</div>}

        <form onSubmit={onSubmit} noValidate>
          <div className="vh-field">
            <label className="vh-label" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className={`vh-input ${errors.email ? 'vh-input--error' : ''}`}
              placeholder="you@example.com"
              value={form.email}
              onChange={onChange}
            />
            {errors.email && <span className="vh-error-text">{errors.email}</span>}
          </div>

          <div className="vh-field">
            <label className="vh-label" htmlFor="password">Password</label>
            <div className="auth__pw">
              <input
                id="password"
                name="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                className={`vh-input ${errors.password ? 'vh-input--error' : ''}`}
                placeholder="Your password"
                value={form.password}
                onChange={onChange}
              />
              <button
                type="button"
                className="auth__pw-toggle"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && <span className="vh-error-text">{errors.password}</span>}
          </div>

          <button className="vh-btn vh-btn--primary vh-btn--block" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="auth__footer">
          New to VEHORA? <Link to="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}

