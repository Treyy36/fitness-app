# AI Agent

How the DeepSeek-powered coaching persona works — system prompt engineering, intent parsing, and agentic workflow.

## Architecture

```
User Message
    ↓
ChatContext.sendMessage()
    ↓
buildContext() — gathers live state
    ├── Today's date, day of week
    ├── Today's scheduled plan (from workoutPlans)
    ├── All plans (from workoutPlans)
    ├── Exercise catalog (categorized by muscle group)
    ├── Last 20 sessions (detailed ×10, condensed ×10)
    └── Last 10 recommendations (with acknowledged status)
    ↓
buildSystemPrompt() — assembles full prompt
    ├── Coaching persona ("You are my dedicated strength coach")
    ├── Athlete profile (height, weight, experience, goals)
    ├── Equipment available (Planet Fitness machines)
    ├── Current working weights per exercise
    ├── Coaching observations and philosophy
    └── Response format instructions (<!--ACTION--> blocks)
    ↓
sendToDeepSeek() — HTTP POST
    ├── model: "deepseek-chat"
    ├── system: full coaching prompt
    ├── messages: last 10 conversation turns + current message
    ├── temperature: 0.7
    └── max_tokens: 2048
    ↓
AI Response (natural language + embedded actions)
    ↓
parseActions() — regex extraction
    └── /<!--ACTION:(.*?)-->/g → ParsedAction[]
    ↓
executeActions() — database mutations + queries
    ├── Mutations: log_session, update_session, delete_session, create_plan, update_plan, add_exercise, save_recommendation
    └── Queries: get_session_history, get_recommendation_history, get_rpe_trend (return data as system messages)
    ↓
Query results injected as system messages (AI sees them next turn)
    ↓
UI updates (messages, sessions, plans refresh)
```

## System Prompt Structure

The system prompt (`buildSystemPrompt` in `src/services/deepseek.ts`) is assembled from live context on every message. Key sections:

### 1. Coaching Persona
The AI is instructed to act as a dedicated strength coach with specific responsibilities:
- Prescribe every workout (user never chooses)
- Track everything indefinitely
- Recommend weight increases only when earned
- Prioritize form over weight
- Use progressive overload conservatively (1-2 RIR target)

### 2. Athlete Profile
Hardcoded from the user's training data:
- Height, weight, experience level
- Gym: Planet Fitness
- Goal: muscle mass + long-term strength
- Training style: hypertrophy-focused

### 3. Equipment & Exercises
Lists all available Planet Fitness machines and the exercise catalog. The AI uses exact exercise names from the catalog when creating plans or logging.

### 4. Coaching Observations
Pre-loaded observations about the athlete's strengths/weaknesses:
- Chest/back strength above initial estimate
- Biceps weakest upper-body muscle group
- Athlete consistently self-regulates (lowers weight when form breaks)

### 5. Live Context (dynamic)
- Today's scheduled workout with exercise names, sets, reps
- All workout plans with day mappings
- Last **20** sessions with detailed set data (full detail for 10 most recent, condensed for older: just exercise name + avg weight)
- Last 10 recommendations with acknowledged status (closes the feedback loop)
- Session type counts (standard/test/deload)

### 6. Response Format
Explicit instructions for the `<!--ACTION:{...}-->` format with available action types and their schemas.

## Intent Parsing

### How it works

The AI embeds JSON action blocks in HTML comment syntax within its natural language response:

```
Great session! Everything logged. Chest Press is progressing well. 💪

<!--ACTION:{"action":"log_session","data":{"planName":"Push A","exercises":[...]}}-->
```

The app:
1. Receives the full response text
2. `parseActions()` extracts all `<!--ACTION:...-->` blocks via regex
3. `stripActions()` removes them for display rendering
4. `executeActions()` processes each action against the database

### Available Actions

| Action | Trigger | What it does |
|---|---|---|
| `log_session` | "workout complete", "done" | Creates session + sessionExercises with full set data. Supports `sessionType` for standard/test/deload. |
| `create_plan` | "create a PPL split", plan definition | Creates a new workoutPlan with exercise mappings |
| `update_plan` | "add X to Push A", "swap Pec Deck for..." | Updates an existing plan's exercises, name, or day mid-week |
| `update_session` | "fix my bench weight", "that was actually 85lbs" | Edits a past session's exercises, feedback, or sessionType |
| `delete_session` | "delete session 7", "remove that duplicate" | Permanently removes a session + all its exercise data |
| `add_exercise` | "add Plate-Loaded Incline Press" | Adds a new exercise to the catalog on the fly |
| `save_recommendation` | After session, "any suggestions?" | Saves a recommendation with type, message, action |
| `get_session_history` | "show my chest history", "all sessions last month" | Queries sessions by exercise, date range, plan, or sessionType. Results as system message. |
| `get_recommendation_history` | "what recs did I get?", "biceps recommendations" | Queries past recommendations by exercise or type. Results as system message. |
| `get_rpe_trend` | "show RPE trends for Chest Press" | Returns per-session RPE data for a given exercise across all history. Results as system message. |

### Agentic Logging

The AI can infer what to log from context. Examples:

| User says | AI infers |
|---|---|
| "workout complete" | All exercises in today's plan completed at prescribed weights |
| "workout complete but failed last 2 reps on bench set 3" | All exercises completed; bench set 3 marked `completed: false` |
| "swapped hammer curls for cable curls at 20lb" | Logs substitution with new exercise and weight |
| "added an extra set of lateral raises" | Logs plan exercises + bonus exercise |
| "this was a test session, trying higher reps" | Logs with `sessionType: 'test'` |
| "deload day, everything at 50%" | Logs with `sessionType: 'deload'` and reduced weights |
| "delete session 7, it was a duplicate" | Uses `delete_session` to remove + cascade |
| "fix my bench press on Monday to 85lbs" | Uses `update_session` to correct weight |

### Query Actions (two-turn pattern)

Query actions (`get_session_history`, `get_recommendation_history`, `get_rpe_trend`) work differently from mutations. The AI includes them in its response, the app executes them, and the results are injected as **system messages** that the AI sees on the **next** user message:

```
User: "show my machine chest press RPE trend"
    ↓
AI responds: "Let me look that up for you. 
<!--ACTION:{...get_rpe_trend...}-->"
    ↓
App executes query, injects system message with trend data
    ↓
User: "ok" (or any next message)
    ↓
AI now sees the RPE trend data in context and can discuss it

### Action Execution Safety

`executeActions()` in `intentParser.ts` handles each action type:
- Validates data shape before writing
- Includes the plan name in session for future reference
- Stores exercise names as snapshots (survives catalog changes)
- Catches and reports errors per-action (doesn't abort the batch)
- `delete_session` cascades to remove all associated `sessionExercises` rows
- `update_session` replaces exercise data atomically (delete old + insert new)
- Query actions return `ExecuteActionsResult` with both `results` and `queryResults` — query data is injected as system messages for the next AI turn

## Offline Behavior

When offline:
- Chat input is disabled (API key required → API unreachable)
- Plans, history, and settings tabs work (read from IndexedDB)
- Local recommendation engine (`recommendations.ts`) provides fallback suggestions based on simple rules (hit targets 2x → suggest +5lbs, failed 2x → suggest deload)

## Customization Points

To modify the AI's behavior:

| File | What to change |
|---|---|
| `src/services/deepseek.ts` | System prompt persona, coaching philosophy, athlete profile |
| `src/db/seed.ts` | Exercise catalog, workout plans, seed history |
| `src/services/intentParser.ts` | Add new action types |
| `src/services/recommendations.ts` | Modify local fallback rules |

---

*Last updated: 2026-07-30 · Updated for 10 total actions (edit/delete/query), sessionType, expanded context, two-turn query pattern*
