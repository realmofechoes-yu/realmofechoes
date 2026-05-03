-- Realm of Echoes - Database Schema

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  total_runs INTEGER DEFAULT 0,
  deepest_floor INTEGER DEFAULT 0,
  total_gold INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  class TEXT NOT NULL CHECK(class IN ('warrior','mage','ranger')),
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
  is_alive INTEGER DEFAULT 1,
  run_status TEXT DEFAULT 'active' CHECK(run_status IN ('active','completed','dead')),
  rooms_cleared INTEGER DEFAULT 0,
  enemies_defeated INTEGER DEFAULT 0,
  damage_dealt_total INTEGER DEFAULT 0,
  damage_received_total INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('weapon','armor','consumable','accessory')),
  rarity TEXT DEFAULT 'common' CHECK(rarity IN ('common','uncommon','rare','epic','legendary')),
  stats TEXT DEFAULT '{}',
  description TEXT DEFAULT '',
  is_equipped INTEGER DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS combat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  floor INTEGER NOT NULL,
  room INTEGER NOT NULL,
  enemy_name TEXT NOT NULL,
  outcome TEXT CHECK(outcome IN ('victory','defeat','fled')),
  turns_taken INTEGER DEFAULT 0,
  damage_dealt INTEGER DEFAULT 0,
  damage_received INTEGER DEFAULT 0,
  xp_gained INTEGER DEFAULT 0,
  gold_gained INTEGER DEFAULT 0,
  log_data TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS meta_unlocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  unlock_type TEXT NOT NULL,
  unlock_key TEXT NOT NULL,
  unlock_data TEXT DEFAULT '{}',
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  achievement_key TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '🏆',
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, achievement_key)
);
