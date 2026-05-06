# 🗡️ Realm of Echoes: Unbreakable Co-Op RPG

**Realm of Echoes** is a high-fidelity, full-stack Roguelike RPG built for **Web Programming SE 3355**. It features a rich dark-fantasy aesthetic, tactical turn-based combat, and a **non-trivial real-time multiplayer co-op system** with "unbreakable" session persistence.

---

## 🌟 Key Features

### 🏰 "Unbreakable" Multiplayer Co-Op (Non-Trivial Feature)
*   **Persistent Sessions**: Multi-player runs are immune to accidental page refreshes, navigation errors, or temporary disconnections.
*   **Intelligent Resume**: A global "Resume Journey" system detects active sessions and restores the exact state of the dungeon or combat.
*   **Real-time Synchronization**: Powered by **Socket.io**, ensuring all party members see combat logs, health updates, and floor transitions simultaneously.
*   **Lobby System**: Host private lobbies, manage party slots, and select dedicated multiplayer characters.

### ⚔️ Core RPG Mechanics
*   **Three Legend Classes**: Choose between **Warrior** (Tank/Physical), **Mage** (Burst/AoE), and **Ranger** (Crit/DEX).
*   **Dynamic Dungeon Floors**: Procedural room generation with themed floors, scaling enemies, and hidden treasures.
*   **Tactical Combat**: Turn-based engine with skills, status effects, damage reduction logic, and loot generation.
*   **Meta-Progression**: Global leaderboard and permanent achievements tied to your account.

### 🎨 Premium Aesthetics
*   **Modern UI/UX**: Built with **React + Tailwind CSS** + **Vanilla CSS** for custom glassmorphism and micro-animations.
*   **Responsive Design**: Fully playable on mobile and desktop layouts.
*   **Atmospheric Audio**: Dynamic music switching between dungeon exploration and boss battles.

---

## 🏗️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 (Vite), Tailwind CSS, Lucide Icons, Framer Motion |
| **Backend** | Node.js, Express.js |
| **Real-time** | Socket.io |
| **Database** | PostgreSQL (Neon / Production Ready) |
| **Auth** | JWT (JSON Web Tokens) + Bcrypt Encryption |

---

## 📁 Project Structure

```text
web_final/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # UI Components (Layout, Combat, Lobby)
│   │   ├── context/        # Global State (Auth, Game, Socket)
│   │   ├── hooks/          # Custom Hooks (Socket Emitters, Listeners)
│   │   ├── pages/          # Bifurcated Routing (Singleplayer vs. Multiplayer)
│   │   └── utils/          # API & Helper functions
│   └── ...
├── server/                 # Express Backend
│   ├── db/                 # PostgreSQL Connection & Schema
│   ├── game/               # Core Combat & Loot Engines
│   ├── routes/             # RESTful API Endpoints
│   ├── socket/             # Real-time Handlers (Lobby, Combat, Sync)
│   ├── scripts/            # Database Migrations
│   └── ...
└── web.txt                 # Project Requirements Reference
```

---

## 🔌 Core API Endpoints

### Authentication
*   `POST /api/auth/register` - Create a new account.
*   `POST /api/auth/login` - Authenticate and receive a JWT.

### Gameplay (CRUD)
*   `GET /api/characters` - Fetch all characters for the current mode.
*   `POST /api/characters` - Create a new hero.
*   `DELETE /api/characters/:id` - Permanently retire a hero.
*   `GET /api/inventory/:id` - Fetch item management data.

### Multiplayer (Socket.io)
*   `lobby:create` / `lobby:join` - Manage party coordination.
*   `session:sync` - Re-hydrate game state after disconnect/refresh.
*   `combat:action` - Real-time turn submission.

---

## 🚀 Getting Started

### Prerequisites
*   **Node.js** (v18+)
*   **PostgreSQL** instance (or a free **Neon.tech** account)

### Installation

1.  **Clone & Install Dependencies**
    ```bash
    git clone https://github.com/realmofechoes-yu/realmofechoes.git
    cd realmofechoes
    npm run install-all  # Installs both client and server deps
    ```

2.  **Run Development Environment**

    Open two separate terminals:

    **Terminal 1: Backend**
    ```bash
    cd server
    npm run dev
    # Backend runs on: http://localhost:5000
    ```

    **Terminal 2: Frontend**
    ```bash
    cd client
    npm run dev
    # Frontend runs on: http://localhost:5173
    ```