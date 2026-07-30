# Architecture

System design, component tree, and data flow for GymTracker AI.

## Overview

```
┌─────────────────────────────────────────────────┐
│                   PWA Shell                      │
│  index.html → main.tsx → App.tsx                 │
│  (iOS meta, manifest, service worker)            │
├─────────────────────────────────────────────────┤
│                  React App                       │
│  ┌───────────┐ ┌───────────┐ ┌──────────────┐  │
│  │ ChatView  │ │ PlanList  │ │ SessionHist  │  │
│  │ (default) │ │ View      │ │ oryView      │  │
│  └─────┬─────┘ └───────────┘ └──────────────┘  │
│        │                                         │
│  ┌─────┴─────────────────────────────────────┐  │
│  │            Context Layer                    │  │
│  │  AppContext (plans, sessions, exercises)   │  │
│  │  ChatContext (messages, API key, send)     │  │
│  └─────┬───────────────────┬─────────────────┘  │
│        │                   │                     │
│  ┌─────┴─────┐   ┌────────┴──────────┐          │
│  │  Dexie.js │   │  DeepSeek API     │          │
│  │  IndexedDB│   │  (direct fetch)   │          │
│  │  6 tables │   │  api.deepseek.com │          │
│  └───────────┘   └───────────────────┘          │
└─────────────────────────────────────────────────┘
```

## Directory Structure

```
fitness-app/
├── index.html                    # PWA meta tags, iOS configuration
├── vite.config.ts                # Vite + React + Tailwind + PWA plugin
├── public/
│   ├── manifest.json             # PWA manifest (standalone, portrait)
│   ├── icon-192.png              # App icons (generated)
│   ├── icon-512.png
│   └── apple-touch-icon.png      # iOS home screen icon (180×180)
├── .github/workflows/
│   └── deploy.yml                # Auto-deploy to GitHub Pages on push
├── scripts/
│   └── generate-icons.mjs        # Sharp-based icon generator
└── src/
    ├── main.tsx                  # React entry, PWA registration
    ├── App.tsx                   # BrowserRouter + layout shell
    ├── index.css                 # Tailwind + iOS safe-area fixes
    ├── db/
    │   ├── database.ts           # Dexie schema: 6 tables, types, upsert helper
    │   └── seed.ts               # Exercise catalog, PPL plans, 6-session history
    ├── hooks/
    │   ├── useWorkoutPlans.ts    # CRUD for plans + exercises + name resolution
    │   ├── useSessions.ts        # CRUD for sessions + set data + last-session lookup
    │   └── useRecommendations.ts # CRUD for AI recommendations
    ├── context/
    │   ├── AppContext.tsx         # Global state: plans, exercises, sessions, init
    │   └── ChatContext.tsx        # Chat state, API key, sendMessage, buildContext
    ├── services/
    │   ├── deepseek.ts           # System prompt builder + DeepSeek API client
    │   ├── intentParser.ts       # <!--ACTION--> extraction + action execution
    │   └── recommendations.ts    # Local fallback progression rules (offline)
    └── components/
        ├── layout/BottomNav.tsx  # Tab bar: Chat | Plans | History | Settings
        ├── chat/
        │   ├── ChatView.tsx      # Chat UI: header, messages, input
        │   └── MessageBubble.tsx # Markdown rendering + action result badges
        ├── plans/PlanListView.tsx# Browse workout plan templates
        ├── history/SessionHistoryView.tsx # Expandable session log
        └── settings/SettingsView.tsx # API key, stats, reset
```

## Key Design Decisions

### Chat-first architecture
The Chat tab is the default route. All primary interactions happen through natural language. The Plans and History tabs are secondary views for browsing structured data.

### Agentic intent parsing
AI responses contain hidden `<!--ACTION:{"action":"log_session","data":{...}}-->` blocks. The app strips these from display text and executes them as database operations. This allows the AI to both converse naturally AND mutate application state.

### Local-first with external AI
All workout data lives in IndexedDB. The only external service is DeepSeek API. Offline: tracking works (manual logging); AI features degrade gracefully.

### Seed-on-first-load
On empty database, seeds 17 exercises, 5 workout plans, and 6 sessions of history. The seed check (`if (existing > 0) return`) prevents overwriting user data on subsequent loads.

### Session immutability from plan changes
Sessions store their own snapshots of exercise names and set data. Modifying a workout plan later does not retroactively change logged sessions.

## Component Communication

```
User types message
    ↓
ChatContext.sendMessage()
    ↓
buildContext() → reads plans, exercises, recent sessions from AppContext + DB
    ↓
buildSystemPrompt() → assembles full coaching prompt with athlete profile
    ↓
sendToDeepSeek() → POST to api.deepseek.com/v1/chat/completions
    ↓
parseActions() → extracts <!--ACTION:{...}--> blocks from response
    ↓
executeActions() → writes to IndexedDB (create session, exercises, etc.)
    ↓
refreshSessions() → updates AppContext state
    ↓
SessionHistoryView re-renders with new data
```

---

*Last updated: 2026-07-30 · Generated from codebase at commit `fc045e8`*
