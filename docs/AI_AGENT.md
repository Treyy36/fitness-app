# AI Agent

How the DeepSeek-powered coaching persona works — system prompt engineering, native tool calling, and the agentic execution loop.

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
    └── Tool usage instructions (13 available tools)
    ↓
┌─ Execution Loop (while true, max 10 iterations) ──────────┐
│                                                            │
│  sendToDeepSeek() — HTTP POST with tools array             │
│      ├── model: "deepseek-chat"                            │
│      ├── system: full coaching prompt                      │
│      ├── messages: conversation history + current message  │
│      ├── tools: 13 function definitions (JSON Schema)      │
│      ├── tool_choice: "auto"                               │
│      ├── temperature: 0.7                                  │
│      └── max_tokens: 2048                                  │
│      ↓                                                     │
│  DeepSeek Response                                         │
│      ├── finish_reason: "stop" → exit loop                 │
│      └── finish_reason: "tool_calls" →                     │
│          ├── executeToolCall() per tool                    │
│          ├── Append tool results to conversation           │
│          └── Continue loop (AI sees results)               │
│                                                            │
└────────────────────────────────────────────────────────────┘
    ↓
Final AI Response (natural language)
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

### 6. Tool Instructions
The AI is given access to 13 function tools via DeepSeek's native function-calling API. Tool schemas are defined as JSON Schema in `src/services/toolRegistry.ts`. The AI is instructed to use tools proactively — query before claiming, mutate when confirmed.

## Tool Calling & Execution Loop

### How it works

Instead of embedding `<!--ACTION-->` blocks in text, the AI uses DeepSeek's native function-calling API. The app sends a `tools` array with JSON Schema definitions, and the AI returns structured `tool_calls` with `name` and `arguments`.

The execution loop (`ChatContext.sendMessage()`) wraps this in a `while(true)`:

1. Call DeepSeek with conversation history + tools
2. If `finish_reason === "stop"` → break; show final text response
3. If `finish_reason === "tool_calls"` → for each tool call:
   - Look up the handler in `toolRegistry`
   - Execute against IndexedDB
   - Append `{role: "tool", tool_call_id, content: result}` to conversation
   - Continue loop (AI sees tool results and can call more tools or respond)
4. Safety: max 10 iterations per turn

This means the AI can chain multiple operations in a single user message — query data, analyze it, mutate the database, and respond — all without the user sending follow-up messages.

### Available Tools (13 total)

**Mutation Tools:**

| Tool | Purpose |
|---|---|
| `log_session` | Log a completed workout with exercises, sets, reps, weight, RPE, substitutions |
| `create_plan` | Create a new workout plan template |
| `update_plan` | Modify an existing plan's exercises, name, or day |
| `update_session` | Edit a past session's exercises, feedback, or sessionType |
| `delete_session` | Permanently remove a session + all exercise data |
| `add_exercise` | Add a new exercise to the catalog on the fly |
| `save_recommendation` | Save a coaching recommendation |

**Query Tools:**

| Tool | Purpose |
|---|---|
| `query_sessions` | Query session history with filters (exercise, date, type, plan) |
| `query_recommendations` | Query past recommendations by exercise, type, or status |
| `get_rpe_trend` | RPE trend analysis across all sessions for an exercise |

**Generic Primitives (composeable — unbounded capabilities):**

| Tool | Purpose |
|---|---|
| `db_query` | Read any table with filters, joins, sorting, date ranges |
| `db_mutate` | Create/update/delete records in any table |
| `compute` | Run analytics: progression_rate, estimated_1rm, plateau_detect, muscle_balance |

**Meta Tool:**

| Tool | Purpose |
|---|---|
| `request_capability` | File a request for new infrastructure when the AI hits a capability gap |

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

### Query Resolution (same-turn)

Unlike the old two-turn pattern, query tools resolve in the same user message. The execution loop feeds query results back to the AI within the same iteration, so the AI can query → analyze → respond all in one turn:

```
User: "analyze my chest press RPE trend and suggest weight changes"
    ↓
AI calls: get_rpe_trend("Machine Chest Press")
    ↓ (same iteration)
AI receives RPE data, calls: compute(formula="progression_rate", exercise="Machine Chest Press")
    ↓ (same iteration)
AI receives progression data, responds: "Your RPE has been 7-8 for 3 weeks.
Time to add 5lbs. I've saved a recommendation."
AI calls: save_recommendation(...)
    ↓
Final response shown to user with all analysis complete
```

No more "ok" follow-up messages needed.

### Exercise Substitutions

The `log_session` tool supports a `substitutions` field for tracking when the athlete deviates from the plan template. The system prompt explicitly instructs the AI to log what was ACTUALLY done, not what the plan says.

| User says | AI logs |
|---|---|
| "workout complete" | All exercises in today's plan at prescribed weights |
| "workout complete but failed last set on bench" | All exercises; bench set 3 marked `completed: false` |
| "swapped incline DB for plate-loaded incline press at 90lbs" | Logs substitution: `{planned: "Incline DB Press", actual: "Plate-Loaded Incline Press"}` |
| "added an extra set of lateral raises" | Logs plan exercises + bonus exercise |
| "deload day, everything at 50%" | Logs with `sessionType: 'deload'` and reduced weights |

If the athlete consistently substitutes an exercise (3+ sessions), the AI is instructed to suggest permanently updating the plan template via `update_plan`.

### Tool Execution Safety

`executeToolCall()` in `toolRegistry.ts` handles each tool:
- Validates table names against a whitelist (prevents arbitrary DB access)
- Resolves exercise names to IDs for plan/session operations
- Catches and reports errors per-tool (doesn't abort the batch)
- `delete_session` cascades to remove all associated `sessionExercises`
- `update_session` replaces exercise data atomically (delete old + insert new)
- `db_mutate` validates operations against whitelisted tables
- Query tools return structured data that the AI reasons about in the same turn

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
| `src/services/toolRegistry.ts` | Add new tool definitions + handlers, modify existing tool behavior |
| `src/db/seed.ts` | Exercise catalog, workout plans, seed history |
| `src/services/recommendations.ts` | Modify local fallback rules |

## Capability Requests

The AI can self-diagnose gaps in its toolset and file formal capability requests via the `request_capability` tool. These appear in Settings → Capability Requests, where you can approve, dismiss, or copy them as prompts for VS Code Copilot to implement.

---

*Last updated: 2026-08-02 · Complete rewrite for native tool calling, execution loop, 13 tools, generic primitives, same-turn queries, exercise substitutions, capability requests*
