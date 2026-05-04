-- Realm of Echoes - PostgreSQL Database Schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  total_runs INTEGER DEFAULT 0,
  deepest_floor INTEGER DEFAULT 0,
  total_gold INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS characters (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(50) NOT NULL,
  class VARCHAR(10) NOT NULL CHECK(class IN ('warrior','mage','ranger')),
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  hp INTEGER NOT NULL,
  max_hp INTEGER NOT NULL,
  sp INTEGER NOT NULL,
  max_sp INTEGER NOT NULL,
  str INTEGER DEFAULT 5,
  intel INTEGER DEFAULT 5,
  dex INTEGER DEFAULT 5,
  vit INTEGER DEFAULT 5,
  stat_points INTEGER DEFAULT 0,
  gold INTEGER DEFAULT 0,
  current_floor INTEGER DEFAULT 1,
  current_room INTEGER DEFAULT 0,
  is_alive BOOLEAN DEFAULT TRUE,
  run_status VARCHAR(10) DEFAULT 'active' CHECK(run_status IN ('active','completed','dead')),
  rooms_cleared INTEGER DEFAULT 0,
  enemies_defeated INTEGER DEFAULT 0,
  damage_dealt_total INTEGER DEFAULT 0,
  damage_received_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK(type IN ('weapon','armor','consumable','accessory')),
  rarity VARCHAR(20) DEFAULT 'common' CHECK(rarity IN ('common','uncommon','rare','epic','legendary')),
  stats TEXT DEFAULT '{}',
  description TEXT DEFAULT '',
  is_equipped BOOLEAN DEFAULT FALSE,
  quantity INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS combat_logs (
  id SERIAL PRIMARY KEY,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  floor INTEGER NOT NULL,
  room INTEGER NOT NULL,
  enemy_name VARCHAR(100) NOT NULL,
  outcome VARCHAR(10) CHECK(outcome IN ('victory','defeat','fled')),
  turns_taken INTEGER DEFAULT 0,
  damage_dealt INTEGER DEFAULT 0,
  damage_received INTEGER DEFAULT 0,
  xp_gained INTEGER DEFAULT 0,
  gold_gained INTEGER DEFAULT 0,
  log_data TEXT DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meta_unlocks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  unlock_type VARCHAR(50) NOT NULL,
  unlock_key VARCHAR(50) NOT NULL,
  unlock_data TEXT DEFAULT '{}',
  unlocked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  achievement_key VARCHAR(50) NOT NULL,
  achievement_name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT '',
  icon VARCHAR(10) DEFAULT '*',
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_key)
);

-- Co-op: Lobby system
CREATE TABLE IF NOT EXISTS lobbies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) UNIQUE NOT NULL,
  host_user_id INTEGER REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  max_players INTEGER DEFAULT 4,
  status VARCHAR(20) DEFAULT 'waiting' CHECK(status IN ('waiting','in_progress','completed','abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Co-op: Lobby members
CREATE TABLE IF NOT EXISTS lobby_members (
  id SERIAL PRIMARY KEY,
  lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  character_id INTEGER REFERENCES characters(id),
  is_ready BOOLEAN DEFAULT FALSE,
  slot_index INTEGER NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lobby_id, user_id)
);

-- Co-op: Active dungeon sessions
CREATE TABLE IF NOT EXISTS coop_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID REFERENCES lobbies(id),
  current_floor INTEGER DEFAULT 1,
  current_room INTEGER DEFAULT -1,
  status VARCHAR(20) DEFAULT 'active' CHECK(status IN ('active','completed','failed')),
  session_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
