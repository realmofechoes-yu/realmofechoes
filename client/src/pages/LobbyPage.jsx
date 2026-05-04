import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { useSocketEvent, useSocketEmit } from '../hooks/useSocket';
import { useGame } from '../context/GameContext';
import api from '../utils/api';
import { CLASS_INFO } from '../data/gameData';
import './LobbyPage.css';

export default function LobbyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, connected } = useSocketContext();
  const { emit, emitNoAck } = useSocketEmit();
  const { setCurrentCharacter } = useGame();

  const [mode, setMode] = useState('menu'); // menu, creating, joining, inLobby
  const [joinCode, setJoinCode] = useState('');
  const [lobbyName, setLobbyName] = useState('');
  const [lobby, setLobby] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [selectedCharId, setSelectedCharId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    try {
      const chars = await api.getCharacters();
      setCharacters(chars.filter(c => c.is_alive));
    } catch (e) { console.error(e); }
  };

  // Socket event listeners
  const handlePlayerJoined = useCallback((data) => {
    setLobby(prev => prev ? { ...prev, players: data.players } : prev);
    setChatMessages(prev => [...prev, { system: true, message: `${data.player.username} joined!` }]);
  }, []);

  const handlePlayerLeft = useCallback((data) => {
    setLobby(prev => prev ? { ...prev, players: data.players, hostUserId: data.newHostId } : prev);
    setChatMessages(prev => [...prev, { system: true, message: `${data.username} left.` }]);
  }, []);

  const handleCharacterSelected = useCallback((data) => {
    setLobby(prev => prev ? { ...prev, players: data.players } : prev);
  }, []);

  const handlePlayerReady = useCallback((data) => {
    setLobby(prev => prev ? { ...prev, players: data.players } : prev);
  }, []);

  const handleGameStarted = useCallback((data) => {
    // Notify server to register session
    emitNoAck('game:session_created', { sessionId: data.sessionId, lobbyId: data.lobbyId });

    // Navigate to co-op dungeon
    const myPlayer = data.players.find(p => p.userId === user.id);
    if (myPlayer?.characterId) {
      setCurrentCharacter(null); // Will be loaded by dungeon page
      navigate(`/dungeon/${myPlayer.characterId}?coop=${data.sessionId}`);
    }
  }, [user, navigate, emitNoAck, setCurrentCharacter]);

  const handleChatMessage = useCallback((data) => {
    setChatMessages(prev => [...prev.slice(-49), data]);
  }, []);

  useSocketEvent('lobby:player_joined', handlePlayerJoined);
  useSocketEvent('lobby:player_left', handlePlayerLeft);
  useSocketEvent('lobby:character_selected', handleCharacterSelected);
  useSocketEvent('lobby:player_ready', handlePlayerReady);
  useSocketEvent('game:started', handleGameStarted);
  useSocketEvent('lobby:chat_message', handleChatMessage);

  const createLobby = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await emit('lobby:create', { lobbyName: lobbyName || `${user.username}'s Lobby` });
      setLobby(res.lobby);
      setMode('inLobby');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const joinLobby = async () => {
    if (!joinCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await emit('lobby:join', { code: joinCode.trim().toUpperCase() });
      setLobby(res.lobby);
      setMode('inLobby');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectCharacter = async (charId) => {
    try {
      await emit('lobby:select_character', { characterId: charId });
      setSelectedCharId(charId);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleReady = async () => {
    try {
      await emit('lobby:ready', {});
    } catch (err) {
      setError(err.message);
    }
  };

  const startGame = async () => {
    try {
      await emit('lobby:start', {});
    } catch (err) {
      setError(err.message);
    }
  };

  const leaveLobby = async () => {
    try {
      await emit('lobby:leave');
    } catch (err) { /* ignore */ }
    setLobby(null);
    setMode('menu');
    setChatMessages([]);
    setSelectedCharId(null);
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    emitNoAck('lobby:chat', { message: chatInput.trim() });
    setChatInput('');
  };

  const isHost = lobby?.hostUserId === user?.id;
  const myPlayer = lobby?.players?.find(p => p.userId === user?.id);
  const allReady = lobby?.players?.every(p => p.isReady && p.characterId);

  if (!connected) {
    return (
      <div className="lobby-page animate-fade-in">
        <div className="lobby-connecting">
          <div className="loader"></div>
          <p>Connecting to server...</p>
        </div>
      </div>
    );
  }

  // Menu: Create or Join
  if (mode === 'menu') {
    return (
      <div className="lobby-page animate-fade-in">
        <h2 className="page-title">🏰 Co-Op Lobby</h2>
        <div className="lobby-menu">
          <div className="lobby-option panel" onClick={() => setMode('creating')}>
            <span className="lobby-option-icon">⚔️</span>
            <h3>Create Lobby</h3>
            <p className="text-dim">Host a new adventure for up to 4 players</p>
          </div>
          <div className="lobby-option panel" onClick={() => setMode('joining')}>
            <span className="lobby-option-icon">🚪</span>
            <h3>Join Lobby</h3>
            <p className="text-dim">Enter a lobby code to join friends</p>
          </div>
          <button className="btn btn-ghost btn-full mt-lg" onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>
        </div>
      </div>
    );
  }

  // Creating lobby
  if (mode === 'creating') {
    return (
      <div className="lobby-page animate-fade-in">
        <h2 className="page-title">⚔️ Create Lobby</h2>
        <div className="lobby-form panel">
          <label>Lobby Name (optional)</label>
          <input type="text" className="input" placeholder={`${user.username}'s Lobby`} value={lobbyName} onChange={e => setLobbyName(e.target.value)} maxLength={50} id="lobby-name-input" />
          {error && <p className="text-danger">{error}</p>}
          <button className="btn btn-gold btn-lg btn-full mt-lg" onClick={createLobby} disabled={loading} id="create-lobby-btn">
            {loading ? 'Creating...' : '🏰 Create Lobby'}
          </button>
          <button className="btn btn-ghost btn-full mt-md" onClick={() => { setMode('menu'); setError(''); }}>← Back</button>
        </div>
      </div>
    );
  }

  // Joining lobby
  if (mode === 'joining') {
    return (
      <div className="lobby-page animate-fade-in">
        <h2 className="page-title">🚪 Join Lobby</h2>
        <div className="lobby-form panel">
          <label>Enter Lobby Code</label>
          <input type="text" className="input lobby-code-input" placeholder="ABC123" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={6} id="join-code-input" />
          {error && <p className="text-danger">{error}</p>}
          <button className="btn btn-gold btn-lg btn-full mt-lg" onClick={joinLobby} disabled={loading || joinCode.length < 4} id="join-lobby-btn">
            {loading ? 'Joining...' : '🚪 Join Lobby'}
          </button>
          <button className="btn btn-ghost btn-full mt-md" onClick={() => { setMode('menu'); setError(''); }}>← Back</button>
        </div>
      </div>
    );
  }

  // In Lobby
  return (
    <div className="lobby-page animate-fade-in">
      <div className="lobby-header">
        <h2 className="page-title">🏰 {lobby?.name}</h2>
        <div className="lobby-code-display">
          <span className="text-dim">Lobby Code:</span>
          <span className="lobby-code-value">{lobby?.code}</span>
        </div>
      </div>

      <div className="lobby-content">
        {/* Player Slots */}
        <div className="lobby-players">
          <h3>Party ({lobby?.players?.length || 0}/4)</h3>
          <div className="player-slots">
            {[0, 1, 2, 3].map(slot => {
              const player = lobby?.players?.find(p => p.slotIndex === slot);
              if (!player) {
                return (
                  <div key={slot} className="player-slot empty">
                    <span className="slot-icon">👤</span>
                    <span className="slot-label">Waiting...</span>
                  </div>
                );
              }
              const ci = CLASS_INFO[player.characterClass];
              const isMe = player.userId === user.id;
              return (
                <div key={slot} className={`player-slot filled ${player.isReady ? 'ready' : ''} ${isMe ? 'is-me' : ''}`}>
                  <div className="slot-header">
                    <span className="slot-icon">{ci?.icon || '👤'}</span>
                    <span className="slot-name">{player.username}{isMe ? ' (You)' : ''}</span>
                    {player.userId === lobby.hostUserId && <span className="host-badge">👑</span>}
                  </div>
                  {player.characterName ? (
                    <div className="slot-char">
                      <span>{player.characterName}</span>
                      <span className="text-dim">Lv.{player.characterLevel} {ci?.name}</span>
                    </div>
                  ) : (
                    <span className="text-dim">No character selected</span>
                  )}
                  <span className={`ready-indicator ${player.isReady ? 'is-ready' : ''}`}>
                    {player.isReady ? '✅ Ready' : '⏳ Not Ready'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Character Select + Actions */}
        <div className="lobby-sidebar">
          {/* Character Select */}
          <div className="panel lobby-char-select">
            <h4>Select Character</h4>
            {characters.length === 0 ? (
              <p className="text-dim">No alive characters. Create one first!</p>
            ) : (
              <div className="char-list">
                {characters.map(c => {
                  const ci = CLASS_INFO[c.class];
                  return (
                    <button key={c.id} className={`char-option ${selectedCharId === c.id ? 'selected' : ''}`} onClick={() => selectCharacter(c.id)}>
                      <span className="char-icon">{ci?.icon}</span>
                      <div className="char-details">
                        <span className="char-name">{c.name}</span>
                        <span className="text-dim">Lv.{c.level} {ci?.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="lobby-actions">
            <button className="btn btn-gold btn-lg btn-full" onClick={toggleReady} disabled={!selectedCharId} id="ready-btn">
              {myPlayer?.isReady ? '⏳ Unready' : '✅ Ready Up'}
            </button>
            {isHost && (
              <button className="btn btn-ember btn-lg btn-full mt-md" onClick={startGame} disabled={!allReady || lobby?.players?.length < 1} id="start-btn">
                ⚔️ Begin Expedition
              </button>
            )}
            <button className="btn btn-ghost btn-full mt-md" onClick={leaveLobby}>🚪 Leave Lobby</button>
          </div>

          {/* Chat */}
          <div className="panel lobby-chat">
            <h4>💬 Chat</h4>
            <div className="chat-messages">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`chat-msg ${msg.system ? 'system' : ''}`}>
                  {msg.system ? (
                    <span className="text-dim">{msg.message}</span>
                  ) : (
                    <><span className="chat-user">{msg.username}:</span> {msg.message}</>
                  )}
                </div>
              ))}
            </div>
            <div className="chat-input-row">
              <input type="text" className="input" placeholder="Type..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} maxLength={200} id="chat-input" />
              <button className="btn btn-ghost btn-sm" onClick={sendChat}>Send</button>
            </div>
          </div>
        </div>
      </div>
      {error && <p className="text-danger lobby-error">{error}</p>}
    </div>
  );
}
