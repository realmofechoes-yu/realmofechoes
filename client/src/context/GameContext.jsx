import { createContext, useContext, useState } from 'react';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [currentCharacter, setCurrentCharacterState] = useState(null);
  const [lastSingleplayerCharId, setLastSingleplayerCharIdState] = useState(() => localStorage.getItem('lastSingleplayerCharId'));
  const [lastMode, setLastModeState] = useState(() => localStorage.getItem('lastMode') || 'singleplayer');
  
  const [combatState, setCombatState] = useState(null);
  const [dungeonState, setDungeonState] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [skills, setSkills] = useState(null);

  // Initialize co-op state from localStorage
  const [coopSessionId, setCoopSessionIdState] = useState(() => localStorage.getItem('coopSessionId'));
  const [coopCharacterId, setCoopCharacterIdState] = useState(() => localStorage.getItem('coopCharacterId'));
  const [coopCombatState, setCoopCombatState] = useState(null);
  const [partyPlayers, setPartyPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);

  const setLastMode = (mode) => {
    setLastModeState(mode);
    localStorage.setItem('lastMode', mode);
  };

  const setCurrentCharacter = (char) => {
    setCurrentCharacterState(char);
    if (char?.id) {
      const idStr = char.id.toString();
      setLastSingleplayerCharIdState(idStr);
      localStorage.setItem('lastSingleplayerCharId', idStr);
    }
  };

  const setCoopSessionId = (id) => {
    setCoopSessionIdState(id);
    if (id) localStorage.setItem('coopSessionId', id);
    else localStorage.removeItem('coopSessionId');
  };

  const setCoopCharacterId = (id) => {
    setCoopCharacterIdState(id);
    if (id) localStorage.setItem('coopCharacterId', id.toString());
    else localStorage.removeItem('coopCharacterId');
  };

  const clearGameState = () => {
    setCurrentCharacterState(null);
    setCombatState(null);
    setDungeonState(null);
    setInventory([]);
    setSkills(null);
    setCoopCombatState(null);
    // Note: We don't clear lastSingleplayerCharId or coopSessionId here
    // as they are needed for navigation persistence.
  };

  const abandonSession = () => {
    setCoopSessionId(null);
    setCoopCharacterId(null);
    setCoopCombatState(null);
    setPartyPlayers([]);
    setIsHost(false);
  };

  return (
    <GameContext.Provider value={{
      currentCharacter, setCurrentCharacter,
      lastSingleplayerCharId,
      lastMode, setLastMode,
      combatState, setCombatState,
      dungeonState, setDungeonState,
      inventory, setInventory,
      skills, setSkills,
      coopSessionId, setCoopSessionId,
      coopCharacterId, setCoopCharacterId,
      coopCombatState, setCoopCombatState,
      partyPlayers, setPartyPlayers,
      isHost, setIsHost,
      clearGameState, abandonSession
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}

export default GameContext;
