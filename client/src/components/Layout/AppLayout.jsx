import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { useState } from 'react';
import './AppLayout.css';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { currentCharacter, clearGameState } = useGame();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    clearGameState();
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} id="menu-toggle">☰</button>
        <div className="header-brand" onClick={() => navigate('/dashboard')}>
          <span className="brand-icon">🗡️</span>
          <h1 className="brand-title">Realm of Echoes</h1>
        </div>
        <div className="header-right">
          {currentCharacter && (
            <div className="header-char-info">
              <span className="char-name">{currentCharacter.name}</span>
              <span className="char-level">Lv.{currentCharacter.level}</span>
            </div>
          )}
          <div className="header-user">
            <span className="user-name">⚜️ {user?.username}</span>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout} id="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      <div className="app-body">
        <nav className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-nav">
            <NavLink to="/dashboard" className="nav-link" onClick={() => setSidebarOpen(false)} id="nav-dashboard">
              <span className="nav-icon">🏰</span><span className="nav-text">Dashboard</span>
            </NavLink>
            <NavLink to="/create" className="nav-link" onClick={() => setSidebarOpen(false)} id="nav-create">
              <span className="nav-icon">✨</span><span className="nav-text">New Hero</span>
            </NavLink>
            {currentCharacter && (
              <>
                <NavLink to={`/dungeon/${currentCharacter.id}`} className="nav-link" onClick={() => setSidebarOpen(false)} id="nav-dungeon">
                  <span className="nav-icon">🗺️</span><span className="nav-text">Dungeon</span>
                </NavLink>
                <NavLink to={`/inventory/${currentCharacter.id}`} className="nav-link" onClick={() => setSidebarOpen(false)} id="nav-inventory">
                  <span className="nav-icon">🎒</span><span className="nav-text">Inventory</span>
                </NavLink>
              </>
            )}
            <NavLink to="/leaderboard" className="nav-link" onClick={() => setSidebarOpen(false)} id="nav-leaderboard">
              <span className="nav-icon">🏆</span><span className="nav-text">Leaderboard</span>
            </NavLink>
          </div>
          <div className="sidebar-footer">
            <div className="sidebar-stats">
              <div className="sidebar-stat"><span>Total Runs</span><span className="text-gold">{user?.total_runs || 0}</span></div>
              <div className="sidebar-stat"><span>Deepest</span><span className="text-gold">Floor {user?.deepest_floor || 0}</span></div>
              <div className="sidebar-stat"><span>Gold</span><span className="text-gold">{user?.total_gold || 0}</span></div>
            </div>
          </div>
        </nav>
        {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)}></div>}
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
