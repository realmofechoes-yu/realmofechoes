import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GameProvider } from './context/GameContext';
import { SocketProvider } from './context/SocketContext';
import { AudioProvider } from './context/AudioContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CharacterCreatePage from './pages/CharacterCreatePage';

import SPDungeonPage from './pages/singleplayer/DungeonPage';
import SPCombatPage from './pages/singleplayer/CombatPage';
import SPInventoryPage from './pages/singleplayer/InventoryPage';
import SPLevelUpPage from './pages/singleplayer/LevelUpPage';
import SPRunSummaryPage from './pages/singleplayer/RunSummaryPage';

import MPDungeonPage from './pages/multiplayer/DungeonPage';
import MPCombatPage from './pages/multiplayer/CombatPage';
import MPInventoryPage from './pages/multiplayer/InventoryPage';
import MPLevelUpPage from './pages/multiplayer/LevelUpPage';
import MPRunSummaryPage from './pages/multiplayer/RunSummaryPage';
import LeaderboardPage from './pages/LeaderboardPage';
import LobbyPage from './pages/LobbyPage';
import ModeSelectPage from './pages/ModeSelectPage';
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
  if (user) return <Navigate to="/select-mode" />;
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
                  <Route path="/select-mode" element={<ModeSelectPage />} />
                  <Route path="/dashboard" element={<Navigate to="/select-mode" />} />
                  <Route path="/dashboard/:mode" element={<DashboardPage />} />
                  <Route path="/create/:mode" element={<CharacterCreatePage />} />
                  <Route path="/lobby" element={<LobbyPage />} />
                  
                  {/* Singleplayer Routes */}
                  <Route path="/singleplayer/dungeon/:charId" element={<SPDungeonPage />} />
                  <Route path="/singleplayer/combat/:charId" element={<SPCombatPage />} />
                  <Route path="/singleplayer/inventory/:charId" element={<SPInventoryPage />} />
                  <Route path="/singleplayer/levelup/:charId" element={<SPLevelUpPage />} />
                  <Route path="/singleplayer/summary/:charId" element={<SPRunSummaryPage />} />

                  {/* Multiplayer Routes */}
                  <Route path="/multiplayer/dungeon/:charId/:sessionId" element={<MPDungeonPage />} />
                  <Route path="/multiplayer/combat/:charId/:sessionId" element={<MPCombatPage />} />
                  <Route path="/multiplayer/inventory/:charId/:sessionId" element={<MPInventoryPage />} />
                  <Route path="/multiplayer/levelup/:charId/:sessionId" element={<MPLevelUpPage />} />
                  <Route path="/multiplayer/summary/:charId/:sessionId" element={<MPRunSummaryPage />} />
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/select-mode" />} />
              </Routes>
            </GameProvider>
          </SocketProvider>
        </AuthProvider>
      </AudioProvider>
    </BrowserRouter>
  );
}

export default App;
