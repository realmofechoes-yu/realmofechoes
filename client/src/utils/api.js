const VITE_API_URL = import.meta.env.VITE_API_URL || '';
const API_BASE = VITE_API_URL.endsWith('/') ? `${VITE_API_URL}api` : `${VITE_API_URL}/api`;

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('roe_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (username, email, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }),
  getProfile: () => request('/auth/profile'),

  // Characters
  createCharacter: (name, characterClass, mode = 'singleplayer') => request('/characters', { method: 'POST', body: JSON.stringify({ name, characterClass, mode }) }),
  getCharacters: (mode) => request(`/characters${mode ? `?mode=${mode}` : ''}`),
  getCharacter: (id) => request(`/characters/${id}`),
  updateCharacter: (id, stats) => request(`/characters/${id}`, { method: 'PUT', body: JSON.stringify(stats) }),
  deleteCharacter: (id) => request(`/characters/${id}`, { method: 'DELETE' }),

  // Dungeon
  enterDungeon: (characterId) => request('/dungeon/enter', { method: 'POST', body: JSON.stringify({ characterId }) }),
  getFloor: (charId) => request(`/dungeon/${charId}/floor`),
  moveRoom: (characterId, roomIndex) => request('/dungeon/move', { method: 'POST', body: JSON.stringify({ characterId, roomIndex }) }),
  nextFloor: (characterId) => request('/dungeon/next-floor', { method: 'POST', body: JSON.stringify({ characterId }) }),
  saveDungeon: (characterId) => request('/dungeon/save', { method: 'POST', body: JSON.stringify({ characterId }) }),

  // Combat
  startCombat: (characterId, enemy) => request('/combat/start', { method: 'POST', body: JSON.stringify({ characterId, enemy }) }),
  combatAction: (characterId, action, skillKey, itemId) => request('/combat/action', { method: 'POST', body: JSON.stringify({ characterId, action, skillKey, itemId }) }),
  flee: (characterId) => request('/combat/flee', { method: 'POST', body: JSON.stringify({ characterId }) }),
  getActiveCombat: (characterId) => request(`/combat/active/${characterId}`),
  getCombatLogs: (charId) => request(`/combat/${charId}/log`),
  revive: (characterId) => request('/combat/revive', { method: 'POST', body: JSON.stringify({ characterId }) }),

  // Inventory
  getInventory: (charId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/inventory/${charId}${query ? '?' + query : ''}`);
  },
  equipItem: (characterId, itemId) => request('/inventory/equip', { method: 'POST', body: JSON.stringify({ characterId, itemId }) }),
  unequipItem: (characterId, itemId) => request('/inventory/unequip', { method: 'POST', body: JSON.stringify({ characterId, itemId }) }),
  useItem: (characterId, itemId) => request('/inventory/use', { method: 'POST', body: JSON.stringify({ characterId, itemId }) }),
  discardItem: (itemId) => request(`/inventory/${itemId}`, { method: 'DELETE' }),

  // Leaderboard
  getLeaderboard: () => request('/leaderboard'),
  getAchievements: (userId) => request(`/leaderboard/achievements/${userId}`),
};

export default api;
