import { createContext, useContext, useState } from 'react';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [currentCharacter, setCurrentCharacter] = useState(null);
  const [combatState, setCombatState] = useState(null);
  const [dungeonState, setDungeonState] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [skills, setSkills] = useState(null);

  // Co-op state
  const [coopSessionId, setCoopSessionId] = useState(null);
  const [coopCombatState, setCoopCombatState] = useState(null);
  const [partyPlayers, setPartyPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);

  const clearGameState = () => {
    setCurrentCharacter(null);
    setCombatState(null);
    setDungeonState(null);
    setInventory([]);
    setSkills(null);
    setCoopSessionId(null);
    setCoopCombatState(null);
    setPartyPlayers([]);
    setIsHost(false);
  };

  return (
    <GameContext.Provider value={{
      currentCharacter, setCurrentCharacter,
      combatState, setCombatState,
      dungeonState, setDungeonState,
      inventory, setInventory,
      skills, setSkills,
      coopSessionId, setCoopSessionId,
      coopCombatState, setCoopCombatState,
      partyPlayers, setPartyPlayers,
      isHost, setIsHost,
      clearGameState
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
