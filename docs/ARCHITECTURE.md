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
│  │  IndexedDB│   │  (native func.)   │          │
│  │  7 tables │   │  api.deepseek.com │          │
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
    │   ├── database.ts           # Dexie schema: 7 tables (v3), types, upsert helper
    │   └── seed.ts               # Exercise catalog, PPL plans, 6-session history
    ├── hooks/
    │   ├── useWorkoutPlans.ts    # CRUD for plans + exercises + addExercise
    │   ├── useSessions.ts        # CRUD for sessions (create, update, delete) + set data
    │   └── useRecommendations.ts # CRUD for AI recommendations
    ├── context/
    │   ├── AppContext.tsx         # Global state: plans, exercises, sessions, init
    │   └── ChatContext.tsx        # Chat state, API key, sendMessage, execution loop
    ├── services/
    │   ├── deepseek.ts           # System prompt builder + DeepSeek API (tools support)
    │   ├── toolRegistry.ts       # Tool definitions (JSON Schema) + handler dispatch
    │   ├── intentParser.ts       # [DEPRECATED] Replaced by toolRegistry.ts
    │   └── recommendations.ts    # Local fallback progression rules (offline)
    └── components/
        ├── layout/BottomNav.tsx  # Tab bar: Chat | Plans | History | Settings
        ├── chat/
        │   ├── ChatView.tsx      # Chat UI: header, messages, input
        │   └── MessageBubble.tsx # Markdown rendering + action result badges
        ├── plans/PlanListView.tsx# Browse workout plan templates
        ├── history/SessionHistoryView.tsx # Session log with type filters, edit/delete UI
        └── settings/
            ├── SettingsView.tsx  # API key, stats, reset, capability requests
            └── CapabilityRequestsView.tsx # AI-filed infrastructure requests
```

## Key Design Decisions

### Chat-first architecture
The Chat tab is the default route. All primary interactions happen through natural language. The Plans and History tabs are secondary views for browsing structured data.

### Native tool calling + execution loop
The AI uses DeepSeek's native function-calling API (`tools` array + `tool_choice: "auto"`). A `while(true)` execution loop in `ChatContext.sendMessage()` allows the AI to chain multiple tool calls in a single user turn — query data, analyze it, mutate the database, and respond — all without follow-up messages. Max 10 iterations per turn for safety. Tool definitions live in `src/services/toolRegistry.ts` with JSON Schema definitions and handler functions.

### 13 tools: specific + generic primitives
7 mutation/query tools cover common operations (log_session, create_plan, query_sessions, etc.). 3 generic primitives (`db_query`, `db_mutate`, `compute`) give the AI unbounded capabilities — it can query any table, mutate any record, and run analytical computations by composing these primitives. A meta tool (`request_capability`) lets the AI file structured requests when it hits a capability gap.

### Local-first with external AI
All workout data lives in IndexedDB. The only external service is DeepSeek API. Offline: tracking works (manual logging); AI features degrade gracefully.

### Seed-on-first-load
On empty database, seeds 17 exercises, 5 workout plans, and 6 sessions of history. The seed check (`if (existing > 0) return`) prevents overwriting user data on subsequent loads.

### Session immutability from plan changes
Sessions store their own snapshots of exercise names and set data. Modifying a workout plan later does not retroactively change logged sessions. However, sessions can now be edited directly via `update_session` or removed via `delete_session` (both from chat and History tab UI).

### Session type tagging
Sessions carry an optional `sessionType` field (`'standard'` | `'test'` | `'deload'`). This distinguishes normal workouts from experimental sessions and reduced-volume deload days, enabling cleaner trend analysis. Filter chips in the History tab allow viewing by type.

### Same-turn query resolution
Query tools (`query_sessions`, `get_rpe_trend`, `db_query`, `compute`) return results within the execution loop. The AI receives data in the same iteration and can immediately act on it — query → analyze → respond → mutate, all in one user message. No more two-turn "ok" follow-ups.

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
┌─ Execution Loop ──────────────────────────────────┐
│  sendToDeepSeek() → POST with tools array          │
│      ↓                                             │
│  if tool_calls: executeToolCall() → IndexedDB      │
│      ↓                                             │
│  tool results fed back → loop (AI sees results)     │
│      ↓                                             │
│  if stop: exit loop with final text                │
└────────────────────────────────────────────────────┘
    ↓
Final response displayed in ChatView
    ↓
refreshSessions() → updates AppContext state
    ↓
SessionHistoryView re-renders with new data
```

---

*Last updated: 2026-08-02 · Rewritten for native tool calling, execution loop, toolRegistry (13 tools), 7 tables, same-turn queries, capability requests*
