import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GameProvider } from './context/GameContext';
import { SocketProvider } from './context/SocketContext';
import { AudioProvider } from './context/AudioContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CharacterCreatePage from './pages/CharacterCreatePage';
import DungeonPage from './pages/DungeonPage';
import CombatPage from './pages/CombatPage';
import InventoryPage from './pages/InventoryPage';
import LevelUpPage from './pages/LevelUpPage';
import RunSummaryPage from './pages/RunSummaryPage';
import LeaderboardPage from './pages/LeaderboardPage';
import LobbyPage from './pages/LobbyPage';
import AppLayout from './components/Layout/AppLayout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loader-container"><div className="loader"></div><p>Loading...</p></div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loader-container"><div className="loader"></div></div>;
  if (user) return <Navigate to="/dashboard" />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AudioProvider>
        <AuthProvider>
          <SocketProvider>
            <GameProvider>
              <Routes>
                <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/create" element={<CharacterCreatePage />} />
                  <Route path="/lobby" element={<LobbyPage />} />
                  <Route path="/dungeon/:charId" element={<DungeonPage />} />
                  <Route path="/combat/:charId" element={<CombatPage />} />
                  <Route path="/inventory/:charId" element={<InventoryPage />} />
                  <Route path="/levelup/:charId" element={<LevelUpPage />} />
                  <Route path="/summary/:charId" element={<RunSummaryPage />} />
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" />} />
              </Routes>
            </GameProvider>
          </SocketProvider>
        </AuthProvider>
      </AudioProvider>
    </BrowserRouter>
  );
}

export default App;
