import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { useSocketEvent, useSocketEmit } from '../hooks/useSocket';
import { useGame } from '../context/GameContext';
import api from '../utils/api';
import { CLASS_INFO } from '../data/gameData';

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
      <div className="max-w-5xl mx-auto p-8 animate-fade-in text-center flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-dark-border border-t-gold rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-serif italic">Connecting to server...</p>
      </div>
    );
  }

  // Menu: Create or Join
  if (mode === 'menu') {
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-8 animate-fade-in">
        <h2 className="text-3xl font-title font-bold text-gold drop-shadow-md mb-8 flex items-center gap-3">
          <span className="text-4xl">🏰</span> Co-Op Lobby
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          <div className="panel flex flex-col items-center justify-center cursor-pointer group" onClick={() => setMode('creating')}>
            <span className="text-5xl mb-4 group-hover:-translate-y-2 group-hover:scale-110 transition-transform duration-300 drop-shadow-lg">⚔️</span>
            <h3 className="text-xl font-title font-bold text-gray-200 mb-2">Create Lobby</h3>
            <p className="text-gray-400 text-sm text-center font-serif italic">Host a new adventure for up to 4 players</p>
          </div>
          <div className="panel flex flex-col items-center justify-center cursor-pointer group" onClick={() => setMode('joining')}>
            <span className="text-5xl mb-4 group-hover:-translate-y-2 group-hover:scale-110 transition-transform duration-300 drop-shadow-lg">🚪</span>
            <h3 className="text-xl font-title font-bold text-gray-200 mb-2">Join Lobby</h3>
            <p className="text-gray-400 text-sm text-center font-serif italic">Enter a lobby code to join friends</p>
          </div>
          <div className="panel flex flex-col items-center justify-center cursor-pointer group !border-dark-border/50 hover:!border-primary-glow" onClick={() => navigate('/dashboard')}>
            <span className="text-3xl mb-4 group-hover:-translate-x-2 transition-transform duration-300">←</span>
            <h3 className="text-xl font-title font-bold text-gray-300 mb-2">Back to Dashboard</h3>
          </div>
        </div>
      </div>
    );
  }

  // Creating lobby
  if (mode === 'creating') {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-8 animate-fade-in">
        <h2 className="text-3xl font-title font-bold text-gold drop-shadow-md mb-8 flex items-center justify-center gap-3">
          <span className="text-4xl">⚔️</span> Create Lobby
        </h2>
        <div className="panel bg-dark-surface/80 border-gold/20">
          <div className="form-group">
            <label className="form-label">Lobby Name (optional)</label>
            <input type="text" className="form-input" placeholder={`${user.username}'s Lobby`} value={lobbyName} onChange={e => setLobbyName(e.target.value)} maxLength={50} id="lobby-name-input" />
          </div>
          {error && <p className="text-red-400 bg-red-900/30 p-3 rounded text-sm mb-4 border border-red-500/50">{error}</p>}
          <button className="btn btn-gold w-full !py-4 !text-lg shadow-glow-gold mb-4" onClick={createLobby} disabled={loading} id="create-lobby-btn">
            {loading ? 'Creating...' : '🏰 Create Lobby'}
          </button>
          <button className="btn btn-ghost w-full" onClick={() => { setMode('menu'); setError(''); }}>← Back</button>
        </div>
      </div>
    );
  }

  // Joining lobby
  if (mode === 'joining') {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-8 animate-fade-in">
        <h2 className="text-3xl font-title font-bold text-gold drop-shadow-md mb-8 flex items-center justify-center gap-3">
          <span className="text-4xl">🚪</span> Join Lobby
        </h2>
        <div className="panel bg-dark-surface/80 border-gold/20">
          <div className="form-group">
            <label className="form-label text-center">Enter Lobby Code</label>
            <input type="text" className="form-input text-center text-3xl font-title tracking-[0.3em] uppercase !py-6" placeholder="ABC123" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={6} id="join-code-input" />
          </div>
          {error && <p className="text-red-400 bg-red-900/30 p-3 rounded text-sm mb-4 border border-red-500/50">{error}</p>}
          <button className="btn btn-gold w-full !py-4 !text-lg shadow-glow-gold mb-4" onClick={joinLobby} disabled={loading || joinCode.length < 4} id="join-lobby-btn">
            {loading ? 'Joining...' : '🚪 Join Lobby'}
          </button>
          <button className="btn btn-ghost w-full" onClick={() => { setMode('menu'); setError(''); }}>← Back</button>
        </div>
      </div>
    );
  }

  // In Lobby
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <h2 className="text-3xl font-title font-bold text-gold drop-shadow-md flex items-center gap-3">
          <span className="text-4xl">🏰</span> {lobby?.name}
        </h2>
        <div className="flex items-center gap-3 bg-dark-surface/60 px-6 py-3 rounded-xl border border-dark-border/50 shadow-inner">
          <span className="text-gray-400 font-serif italic text-sm">Lobby Code:</span>
          <span className="font-title font-bold text-2xl text-gold tracking-widest">{lobby?.code}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Player Slots */}
        <div className="lg:col-span-2">
          <h3 className="font-title text-xl font-bold text-gray-200 mb-4 border-b border-dark-border pb-2">Party ({lobby?.players?.length || 0}/4)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map(slot => {
              const player = lobby?.players?.find(p => p.slotIndex === slot);
              if (!player) {
                return (
                  <div key={slot} className="panel flex flex-col items-center justify-center p-8 opacity-50 border-dashed border-dark-border border-2 bg-transparent shadow-none hover:transform-none hover:shadow-none hover:border-dark-border">
                    <span className="text-4xl mb-2 grayscale">👤</span>
                    <span className="text-gray-500 font-serif italic">Waiting...</span>
                  </div>
                );
              }
              
              const ci = CLASS_INFO[player.characterClass];
              const isMe = player.userId === user.id;
              
              return (
                <div key={slot} className={`panel relative border-2 ${isMe ? 'border-gold shadow-glow-gold bg-gold/5' : 'border-dark-border'} ${player.isReady ? '!border-green-500 shadow-[0_0_15px_rgba(46,213,115,0.2)]' : ''}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl drop-shadow-sm">{ci?.icon || '👤'}</span>
                    <span className="font-bold text-lg text-gray-200">{player.username}{isMe ? ' (You)' : ''}</span>
                    {player.userId === lobby.hostUserId && <span className="ml-auto text-xl drop-shadow-md" title="Host">👑</span>}
                  </div>
                  
                  {player.characterName ? (
                    <div className="flex flex-col gap-1 mb-4 bg-dark-bg/60 p-3 rounded border border-dark-border/50">
                      <span className="font-title font-bold text-gray-100">{player.characterName}</span>
                      <span className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Lv.{player.characterLevel} {ci?.name}</span>
                    </div>
                  ) : (
                    <div className="text-gray-500 italic font-serif text-sm mb-4 h-[60px] flex items-center justify-center bg-dark-bg/30 rounded border border-dark-border/30">
                      No character selected
                    </div>
                  )}
                  
                  <div className={`text-sm font-bold text-center py-1.5 rounded-full ${player.isReady ? 'bg-green-900/40 text-green-400 border border-green-500/50' : 'bg-dark-bg text-gray-500 border border-dark-border'}`}>
                    {player.isReady ? '✅ Ready' : '⏳ Not Ready'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Character Select + Actions + Chat */}
        <div className="flex flex-col gap-6">
          {/* Character Select */}
          <div className="panel bg-dark-surface/80 border-gold/10 p-5">
            <h4 className="font-title text-sm font-bold text-gold uppercase tracking-widest mb-4 border-b border-dark-border pb-2">Select Character</h4>
            {characters.length === 0 ? (
              <p className="text-gray-500 italic font-serif text-sm">No alive characters. Create one first!</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                {characters.map(c => {
                  const ci = CLASS_INFO[c.class];
                  const isSelected = selectedCharId === c.id;
                  return (
                    <button 
                      key={c.id} 
                      className={`flex items-center gap-3 p-3 rounded border-2 transition-all duration-200 text-left ${isSelected ? 'border-gold bg-gold/10' : 'border-dark-border bg-dark-bg hover:border-gray-500'}`} 
                      onClick={() => selectCharacter(c.id)}
                    >
                      <span className="text-2xl drop-shadow-sm">{ci?.icon}</span>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-200">{c.name}</span>
                        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Lv.{c.level} {ci?.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button className={`btn w-full !py-3 !text-base shadow-lg ${myPlayer?.isReady ? 'btn-ghost border-yellow-600/50 hover:border-yellow-500 text-yellow-500' : 'btn-gold shadow-glow-gold'}`} onClick={toggleReady} disabled={!selectedCharId} id="ready-btn">
              {myPlayer?.isReady ? '⏳ Unready' : '✅ Ready Up'}
            </button>
            {isHost && (
              <button className="btn btn-ember w-full !py-3 !text-base shadow-glow-health mt-2" onClick={startGame} disabled={!allReady || lobby?.players?.length < 1} id="start-btn">
                ⚔️ Begin Expedition
              </button>
            )}
            <button className="btn btn-ghost w-full mt-2 border border-dark-border/50 hover:bg-red-900/20 hover:text-red-400 hover:border-red-900/50" onClick={leaveLobby}>
              🚪 Leave Lobby
            </button>
          </div>

          {/* Chat */}
          <div className="panel bg-dark-surface/80 border-gold/10 p-0 flex flex-col h-[280px]">
            <h4 className="font-title text-sm font-bold text-gray-300 uppercase tracking-widest p-4 border-b border-dark-border bg-dark-bg/50">💬 Chat</h4>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 custom-scrollbar">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`text-sm ${msg.system ? 'text-gray-500 italic font-serif text-center my-1' : 'text-gray-300'}`}>
                  {msg.system ? (
                    msg.message
                  ) : (
                    <><span className="font-bold text-gold mr-2">{msg.username}:</span>{msg.message}</>
                  )}
                </div>
              ))}
            </div>
            <div className="p-3 bg-dark-bg/80 border-t border-dark-border flex gap-2">
              <input type="text" className="form-input !py-2 !px-3 text-sm flex-1 bg-dark-surface border-dark-border" placeholder="Type message..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} maxLength={200} id="chat-input" />
              <button className="btn btn-gold !px-4 !py-2 !text-xs" onClick={sendChat}>Send</button>
            </div>
          </div>
        </div>
      </div>
      {error && <p className="text-red-400 text-center mt-6 bg-red-900/30 py-2 rounded border border-red-500/50">{error}</p>}
    </div>
  );
}
