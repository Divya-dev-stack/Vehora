import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import './Auth.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9]{10}$/;

export default function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState('user');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  });
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
    if (form.full_name.trim().length < 2) next.full_name = 'Enter your full name.';
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (form.phone && !PHONE_RE.test(form.phone.trim())) next.phone = 'Enter a 10-digit mobile number.';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      next.password = 'Use at least 8 characters with a letter and a number.';
    }
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.';
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
      await api.post('/auth/register', {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        password: form.password,
        role,
      });
      navigate('/login');
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
          <h1 className="auth__title">Create your account</h1>
          <p className="auth__subtitle">Predict. Protect. Proceed.</p>
        </div>

        {serverError && <div className="auth__alert" role="alert">{serverError}</div>}

        <div className="auth__roles" role="group" aria-label="Account type">
          <button
            type="button"
            className={`auth__role ${role === 'user' ? 'auth__role--active' : ''}`}
            onClick={() => setRole('user')}
          >
            Vehicle owner
          </button>
          <button
            type="button"
            className={`auth__role ${role === 'mechanic' ? 'auth__role--active' : ''}`}
            onClick={() => setRole('mechanic')}
          >
            Mechanic
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="vh-field">
            <label className="vh-label" htmlFor="full_name">Full name</label>
            <input
              id="full_name"
              name="full_name"
              autoComplete="name"
              className={`vh-input ${errors.full_name ? 'vh-input--error' : ''}`}
              placeholder="Your name"
              value={form.full_name}
              onChange={onChange}
            />
            {errors.full_name && <span className="vh-error-text">{errors.full_name}</span>}
          </div>

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
            <label className="vh-label" htmlFor="phone">Mobile number (optional)</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              className={`vh-input ${errors.phone ? 'vh-input--error' : ''}`}
              placeholder="10-digit number"
              value={form.phone}
              onChange={onChange}
            />
            {errors.phone && <span className="vh-error-text">{errors.phone}</span>}
          </div>

          <div className="vh-field">
            <label className="vh-label" htmlFor="password">Password</label>
            <div className="auth__pw">
              <input
                id="password"
                name="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                className={`vh-input ${errors.password ? 'vh-input--error' : ''}`}
                placeholder="At least 8 characters"
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

          <div className="vh-field">
            <label className="vh-label" htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              name="confirm"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              className={`vh-input ${errors.confirm ? 'vh-input--error' : ''}`}
              placeholder="Re-enter password"
              value={form.confirm}
              onChange={onChange}
            />
            {errors.confirm && <span className="vh-error-text">{errors.confirm}</span>}
          </div>

          <button className="vh-btn vh-btn--primary vh-btn--block" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="auth__footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}
