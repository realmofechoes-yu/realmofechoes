# 🗡️ Realm of Echoes

A browser-based, turn-based RPG dungeon crawler where players explore themed dungeon floors, engage in tactical combat, collect loot, and level up. Every session is saved so players can continue their run later.

## ⚡ Quick Start

### Prerequisites
- **Node.js** v18+ installed

### Setup & Run

1. **Environment Setup**
   ```bash
   cd server
   cp .env.example .env
   # Open .env and add a unique JWT_SECRET
   cd ..
   ```

2. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**
   ```bash
   cd ../client
   npm install
   ```

4. **Start the backend** (from server/ directory)
   ```bash
   cd ../server
   npm start
   # Server runs on http://localhost:5000
   ```

5. **Start the frontend** (from client/ directory, in a new terminal)
   ```bash
   cd ../client
   npm run dev
   # Frontend runs on http://localhost:5173
   ```

Then open **http://localhost:5173** in your browser.

## 🎮 How to Play

1. **Register** an account and **log in**
2. **Create a character** — choose from Warrior, Mage, or Ranger
3. **Enter the dungeon** — navigate through rooms on each floor
4. **Engage in combat** — use attacks, skills, defend, or items
5. **Collect loot** — equip gear, use consumables
6. **Level up** — allocate stat points (STR/INT/DEX/VIT)
7. **Save & continue** — your progress is always saved
8. **Climb the leaderboard** — deepest floor + gold earned

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Styling | Vanilla CSS (Dark Fantasy Theme) |
| Backend | Express.js (Node.js) |
| Database | SQLite (better-sqlite3) |
| Auth | JWT + bcryptjs |

## 📁 Project Structure

```
web_final/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── context/     # Auth & Game state
│   │   ├── data/        # Static game data
│   │   ├── pages/       # Route pages
│   │   └── utils/       # API helpers
│   └── ...
├── server/          # Express backend
│   ├── db/          # SQLite schema & connection
│   ├── game/        # Combat engine, loot, floors
│   ├── middleware/   # JWT auth
│   └── routes/      # REST API endpoints
└── PLAN.md
```

## 🔌 API Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/register` | POST | Create account |
| `/api/auth/login` | POST | Login (returns JWT) |
| `/api/auth/profile` | GET | Get user profile |
| `/api/characters` | GET/POST | List / Create characters |
| `/api/characters/:id` | GET/PUT/DELETE | Read / Update / Delete character |
| `/api/dungeon/enter` | POST | Enter dungeon floor |
| `/api/dungeon/move` | POST | Move to next room |
| `/api/combat/start` | POST | Start combat encounter |
| `/api/combat/action` | POST | Submit combat action |
| `/api/inventory/:charId` | GET | Get inventory (with filters) |
| `/api/inventory/equip` | POST | Equip item |
| `/api/leaderboard` | GET | Global leaderboard |

## ⚔️ Classes

| Class | HP | SP | Primary Stat | Skill 1 | Skill 2 | Passive |
|-------|-----|-----|-------------|---------|---------|---------|
| Warrior | 120 | 40 | STR | Cleave | Shield Bash | Iron Skin (+10% DEF) |
| Mage | 80 | 80 | INT | Fireball | Frost Nova | Arcane Focus (+15% spell dmg) |
| Ranger | 100 | 60 | DEX | Power Shot | Smoke Bomb | Eagle Eye (+10% crit) |
