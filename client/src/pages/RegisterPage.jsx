import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { useAudio } from '../context/AudioContext';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { reconnect } = useSocketContext();
  const { playTrack } = useAudio();
  const navigate = useNavigate();

  useEffect(() => {
    playTrack('title.mp3');
  }, [playTrack]);

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
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-dark-bg">
      {/* Animated Background Orbs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute w-96 h-96 rounded-full bg-primary/20 blur-[100px] top-10 left-10 animate-float" style={{ animationDelay: '0s' }}></div>
        <div className="absolute w-80 h-80 rounded-full bg-gold/15 blur-[100px] bottom-10 right-10 animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute w-64 h-64 rounded-full bg-health/15 blur-[80px] top-1/2 left-2/3 animate-float" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="w-full max-w-md panel panel-arcane relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4 drop-shadow-lg">✨</div>
          <h1 className="text-3xl font-title font-bold bg-gradient-to-br from-gold to-gold-bright bg-clip-text text-transparent drop-shadow-sm mb-2">
            Begin Your Journey
          </h1>
          <p className="text-gray-400 text-sm font-serif italic">Create an account to save your progress.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-1">
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm text-center mb-4">
              {error}
            </div>
          )}
          
          <div className="form-group mb-4">
            <label className="form-label" htmlFor="reg-username">Username</label>
            <input className="form-input" id="reg-username" type="text" value={username}
              onChange={e => setUsername(e.target.value)} placeholder="Choose a name" required />
          </div>
          
          <div className="form-group mb-4">
            <label className="form-label" htmlFor="reg-email">Email</label>
            <input className="form-input" id="reg-email" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
          </div>
          
          <div className="form-group mb-4">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <input className="form-input" id="reg-password" type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="At least 4 characters" required />
          </div>
          
          <div className="form-group mb-8">
            <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
            <input className="form-input" id="reg-confirm" type="password" value={confirm}
              onChange={e => setConfirm(e.target.value)} placeholder="Confirm your password" required />
          </div>
          
          <button className="btn btn-gold w-full !py-3 !text-base" type="submit" disabled={loading} id="register-submit">
            {loading ? 'Creating...' : '✨ Forge Your Legend'}
          </button>
        </form>
        
        <p className="text-center mt-6 text-gray-400 text-sm">
          Already have an account? <Link to="/login" className="text-primary hover:text-primary-hover hover:underline transition-colors font-medium" id="login-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
