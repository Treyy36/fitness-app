# GymTracker AI

AI-powered PWA for gym workout tracking and coaching. Chat with your AI strength coach to prescribe workouts, log sessions, and get personalized recommendations — all data stored locally on your device.

**Live**: [treyy36.github.io/fitness-app](https://treyy36.github.io/fitness-app)

## How It Works

1. Open the app → **Settings** → paste your [DeepSeek API key](https://platform.deepseek.com)
2. Go to **Chat** → type *"today's workout"* — the AI prescribes your scheduled plan with target weights
3. Type *"workout complete"* — the AI logs everything to your local database
4. After 2+ sessions, ask *"any suggestions?"* — the AI analyzes trends and recommends weight increases, deloads, or form tips

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS 4 |
| Database | IndexedDB via Dexie.js |
| AI | DeepSeek API (`deepseek-chat`) |
| PWA | vite-plugin-pwa with Workbox |
| Hosting | GitHub Pages (auto-deploy via Actions) |
| Charts | Recharts (for progress graphs) |

## Features

- 💬 **Chat-first interface** — primary interaction through natural language
- 📋 **5-day PPL split** — Push A, Pull A, Legs, Push B, Pull B
- 🏋️ **17 Planet Fitness exercises** — seeded with your equipment catalog
- 📊 **Session tracking** — reps, weight, RPE per set, stored in structured IndexedDB tables
- 🧠 **Agentic logging** — say "workout complete" and the AI infers what to log
- 🔄 **Flexible workouts** — swap exercises, skip sets, add extras — AI adapts
- 📈 **6-session history seeded** — your real training data pre-loaded
- 📱 **iPhone PWA** — add to home screen, launches standalone with custom icon
- 🔒 **Local-first** — all data on your device, only DeepSeek API calls go external

## Quick Start

```bash
npm install
npm run dev        # opens at http://localhost:5173
npm run build      # production build to dist/
```

## Deployment

Push to `main` → GitHub Actions auto-builds and deploys to GitHub Pages. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for setup details.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — system design and component tree
- [Database](docs/DATABASE.md) — IndexedDB schema, 6 tables, relationships
- [AI Agent](docs/AI_AGENT.md) — coaching persona, system prompt, intent parsing
- [Data Flow](docs/DATA_FLOW.md) — end-to-end walkthrough from chat to database

---

*Last updated: 2026-07-30 · Generated from codebase at commit `fc045e8`*
