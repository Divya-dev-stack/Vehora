import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Send } from 'lucide-react';
import { classifyComplaint } from '../services/assistantApi';
import { getErrorMessage } from '../services/api';
import './Dashboard.css';
import './Vehicles.css';
import './Assistant.css';

const EXAMPLES = [
  'My bike is not starting in the morning',
  'My brakes feel soft and make a noise',
  'The engine is getting very hot',
];

export default function Assistant() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const submit = async (ev) => {
    ev.preventDefault();
    const value = text.trim();
    if (value.length < 2) {
      setError('Please describe the problem in a few words.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await classifyComplaint(value));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const pct = (n) => Math.round(n * 100);

  return (
    <main className="dash">
      <div className="dash__inner">
        <header className="dash__top">
          <button className="vh-btn vh-btn--ghost vh-btn--sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <p className="dash__brand">VEHORA</p>
            <h1 className="dash__greeting">AI Assistant</h1>
          </div>
        </header>

        <section className="vh-card">
          <h2 className="dash__card-title"><Bot size={20} /> Describe your vehicle problem</h2>
          <p className="vh-muted">Describe the problem in English.</p>

          <div className="asst-examples">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="mech-chip" onClick={() => setText(ex)}>{ex}</button>
            ))}
          </div>

          <form onSubmit={submit} noValidate>
            <textarea
              className="vh-input asst-text"
              maxLength={500}
              placeholder="Example: my bike self start is not working"
              value={text}
              onChange={(e) => { setText(e.target.value); setError(''); }}
            />
            {error && <div className="veh-alert" role="alert">{error}</div>}
            <div className="veh-form__actions">
              <button className="vh-btn vh-btn--primary" type="submit" disabled={loading}>
                <Send size={16} /> {loading ? 'Checking...' : 'Analyse problem'}
              </button>
            </div>
          </form>

          {result && (
            <div className="asst-result" role="status">
              {!result.is_vehicle_problem ? (
                <h3>Not a vehicle problem</h3>
              ) : result.confident ? (
                <h3>Likely problem: {result.label}</h3>
              ) : (
                <h3>I am not sure yet</h3>
              )}

              <div className="asst-bar" aria-label="Confidence">
                <div className="asst-bar__fill" style={{ width: pct(result.confidence) + '%' }} />
              </div>
              <p className="asst-advice">{result.advice}</p>
              {result.is_vehicle_problem && (
                <div className="veh-form__actions">
                  <button type="button" className="vh-btn vh-btn--ghost vh-btn--sm" onClick={() => navigate('/find-mechanic')}>
                    Find a mechanic
                  </button>
                </div>
              )}

              {result.alternatives.map((a) => (
                <div className="asst-alt" key={a.category}>
                  <span>{a.label}</span>
                  <span>{pct(a.confidence)}%</span>
                </div>
              ))}
              <p className="mech-note vh-muted">{result.disclaimer}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}


