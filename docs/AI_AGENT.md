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
    └── Last 5 sessions (from sessions + sessionExercises)
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
executeActions() — database mutations
    ├── log_session → creates session + sessionExercises
    ├── create_plan → creates workoutPlan
    ├── save_recommendation → creates recommendation
    └── Other actions as needed
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
- Last 5 sessions with detailed set data (weights, reps, completions, RPE)

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
| `log_session` | "workout complete", "done" | Creates session + sessionExercises with full set data |
| `create_plan` | "create a PPL split", plan definition | Creates a new workoutPlan with exercise mappings |
| `update_plan` | "add X to Push A" | Updates an existing plan's exercises |
| `save_recommendation` | After session, "any suggestions?" | Saves a recommendation with type, message, action |

### Agentic Logging

The AI can infer what to log from context. Examples:

| User says | AI infers |
|---|---|
| "workout complete" | All exercises in today's plan completed at prescribed weights |
| "workout complete but failed last 2 reps on bench set 3" | All exercises completed; bench set 3 marked `completed: false` |
| "swapped hammer curls for cable curls at 20lb" | Logs substitution with new exercise and weight |
| "added an extra set of lateral raises" | Logs plan exercises + bonus exercise |

### Action Execution Safety

`executeActions()` in `intentParser.ts` handles each action type:
- Validates data shape before writing
- Includes the plan name in session for future reference
- Stores exercise names as snapshots (survives catalog changes)
- Catches and reports errors per-action (doesn't abort the batch)

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

*Last updated: 2026-07-30 · Generated from codebase at commit `fc045e8`*
