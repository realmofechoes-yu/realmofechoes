import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import './AuthPages.css';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { reconnect } = useSocketContext();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      await register(username, email, password);
      reconnect();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-effects">
        <div className="auth-orb auth-orb-1"></div>
        <div className="auth-orb auth-orb-2"></div>
        <div className="auth-orb auth-orb-3"></div>
      </div>
      <div className="auth-card animate-fade-in-up">
        <div className="auth-header">
          <div className="auth-logo">✨</div>
          <h1 className="auth-title">Begin Your Journey</h1>
          <p className="auth-subtitle">Create an account to save your progress.</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-username">Username</label>
            <input className="form-input" id="reg-username" type="text" value={username}
              onChange={e => setUsername(e.target.value)} placeholder="Choose a name" required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email</label>
            <input className="form-input" id="reg-email" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <input className="form-input" id="reg-password" type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="At least 4 characters" required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
            <input className="form-input" id="reg-confirm" type="password" value={confirm}
              onChange={e => setConfirm(e.target.value)} placeholder="Confirm your password" required />
          </div>
          <button className="btn btn-gold btn-full btn-lg" type="submit" disabled={loading} id="register-submit">
            {loading ? 'Creating...' : '✨ Forge Your Legend'}
          </button>
        </form>
        <p className="auth-footer">
          Already have an account? <Link to="/login" id="login-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
