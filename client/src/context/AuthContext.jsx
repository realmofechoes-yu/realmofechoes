import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('roe_token');
    if (token) {
      api.getProfile()
        .then(data => setUser(data))
        .catch(() => { localStorage.removeItem('roe_token'); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const data = await api.login(username, password);
    localStorage.setItem('roe_token', data.token);
    setUser(data.user);
    return data;
  };

  const register = async (username, email, password) => {
    const data = await api.register(username, email, password);
    localStorage.setItem('roe_token', data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('roe_token');
    setUser(null);
  };

  const refreshProfile = async () => {
    try {
      const data = await api.getProfile();
      setUser(data);
    } catch (e) { /* ignore */ }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
