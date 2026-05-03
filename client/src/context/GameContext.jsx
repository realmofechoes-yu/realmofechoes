import { createContext, useContext, useState } from 'react';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [currentCharacter, setCurrentCharacter] = useState(null);
  const [combatState, setCombatState] = useState(null);
  const [dungeonState, setDungeonState] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [skills, setSkills] = useState(null);

  const clearGameState = () => {
    setCurrentCharacter(null);
    setCombatState(null);
    setDungeonState(null);
    setInventory([]);
    setSkills(null);
  };

  return (
    <GameContext.Provider value={{
      currentCharacter, setCurrentCharacter,
      combatState, setCombatState,
      dungeonState, setDungeonState,
      inventory, setInventory,
      skills, setSkills,
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
