import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { useAudio } from '../context/AudioContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { reconnect } = useSocketContext();
  const { playTrack } = useAudio();
  const navigate = useNavigate();

  useEffect(() => {
    playTrack('title.mp3');
  }, [playTrack]);

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
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-dark-bg">
      {/* Animated Background Orbs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute w-96 h-96 rounded-full bg-primary/20 blur-[100px] top-10 left-10 animate-float" style={{ animationDelay: '0s' }}></div>
        <div className="absolute w-80 h-80 rounded-full bg-gold/15 blur-[100px] bottom-10 right-10 animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute w-64 h-64 rounded-full bg-health/15 blur-[80px] top-1/2 left-2/3 animate-float" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="w-full max-w-md panel panel-glow relative z-10 animate-fade-in-up">
        <div className="text-center mb-10">
          <div className="text-5xl mb-6 drop-shadow-lg">🗡️</div>
          <h1 className="text-3xl font-title font-bold bg-gradient-to-br from-gold to-gold-bright bg-clip-text text-transparent drop-shadow-sm mb-2">
            Realm of Echoes
          </h1>
          <p className="text-gray-400 text-sm font-serif italic">Enter the dungeon. Forge your legend.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm text-center mb-4">
              {error}
            </div>
          )}
          
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">Username</label>
            <input className="form-input" id="login-username" type="text" value={username}
              onChange={e => setUsername(e.target.value)} placeholder="Enter your username" required />
          </div>
          
          <div className="form-group mb-8">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input className="form-input" id="login-password" type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
          </div>
          
          <button className="btn btn-gold w-full !py-3 !text-base" type="submit" disabled={loading} id="login-submit">
            {loading ? 'Entering...' : '⚔️ Enter the Realm'}
          </button>
        </form>
        
        <p className="text-center mt-8 text-gray-400 text-sm">
          No account? <Link to="/register" className="text-gold hover:text-gold-bright hover:underline transition-colors font-medium" id="register-link">Create one</Link>
        </p>
      </div>
    </div>
  );
}
