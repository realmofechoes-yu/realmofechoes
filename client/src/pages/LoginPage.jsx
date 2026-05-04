import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import './AuthPages.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { reconnect } = useSocketContext();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
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
          <div className="auth-logo">🗡️</div>
          <h1 className="auth-title">Realm of Echoes</h1>
          <p className="auth-subtitle">Enter the dungeon. Forge your legend.</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">Username</label>
            <input className="form-input" id="login-username" type="text" value={username}
              onChange={e => setUsername(e.target.value)} placeholder="Enter your username" required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input className="form-input" id="login-password" type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
          </div>
          <button className="btn btn-gold btn-full btn-lg" type="submit" disabled={loading} id="login-submit">
            {loading ? 'Entering...' : '⚔️ Enter the Realm'}
          </button>
        </form>
        <p className="auth-footer">
          No account? <Link to="/register" id="register-link">Create one</Link>
        </p>
      </div>
    </div>
  );
}
