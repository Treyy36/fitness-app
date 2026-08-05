# Database Schema

Firebase Firestore. All data under `/users/{userId}/`. IDs are Firestore auto-generated strings.

## Collections

### `exercises`

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | "Machine Chest Press" |
| `category` | `MuscleGroup` | chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, abs, other |
| `defaultSets` | `number` | 3 |
| `defaultReps` | `number` | 10 |
| `prWeight?` | `number` | Heaviest weight at defaultSets × defaultReps |
| `prDate?` | `string` | ISO date when PR set |

### `workoutPlans`

| Field | Type |
|---|---|
| `name` | `string` |
| `dayOfWeek?` | `number` (0–6) |
| `exercises` | `WorkoutPlanExercise[]` embedded |
| `createdAt` | `string` ISO |

**WorkoutPlanExercise** (embedded): `exerciseId` (→ exercises), `targetSets`, `targetReps`, `notes?`

### `sessions`

| Field | Type |
|---|---|
| `planId?` | `string` → workoutPlans |
| `planName?` | `string` snapshot |
| `date` | `string` ISO "2026-08-05" |
| `completedAt?` | `string` ISO |
| `feedback?` | `string` |
| `sessionType?` | 'standard' \| 'test' \| 'deload' |

### `sessions/{id}/exercises` *(subcollection)*

| Field | Type |
|---|---|
| `sessionId` | `string` |
| `exerciseId` | `string` → exercises |
| `exerciseName` | `string` snapshot |
| `sets` | `SetRecord[]` embedded |

**SetRecord**: `setNumber`, `reps`, `weight`, `completed`, `rpe?`

### `recommendations`

`type`, `exercise?`, `message`, `action?`, `acknowledged`, `createdAt`, `sessionId?`

### `bodyWeightLogs`

`date`, `weight`, `notes?`

### `macroLogs`

`date`, `description` (required), `protein`, `carbs`, `fat`, `calories?`, `notes?`

### `userPreferences`

`key` (e.g. "protein_goal"), `value`

### `capabilityRequests`

`title`, `description`, `problem`, `blockedFeature`, `suggestedTools[]`, `priority`, `conversationContext`, `status`, `createdAt`, `deployedAt?`

## Relationship Map

```
workoutPlans[].exercises[].exerciseId → exercises
sessions.planId                       → workoutPlans
sessions/{id}/exercises[].exerciseId  → exercises
recommendations.sessionId             → sessions
```

## Notes

- **No seed data** — starts empty. Exercises and plans created by the AI via chat.
- **RPE is optional** — `cleanSets()` helper strips `undefined` before Firestore writes.
- **Timezone-aware** — dates use `toLocaleDateString('en-CA')` for local `YYYY-MM-DD`.
- **PRs** — stored on the exercise document itself, updated automatically when logging sessions.

---

*Last updated: 2026-08-05 · Firebase Firestore*


### `workoutPlans` — Workout Templates

Defines what exercises to do on which days.

| Field | Type | Index | Description |
|---|---|---|---|
| `id` | `++` (auto) | Primary | Auto-increment ID |
| `name` | `string` | Yes | Plan name (e.g., "Push A") |
| `dayOfWeek` | `number?` | Yes | 0=Sun…6=Sat. `undefined` = unscheduled |
| `exercises` | `Array` | — | Array of `{exerciseId, sets, reps, notes?}` |
| `createdAt` | `string` | — | ISO timestamp |

**Seed data**: Push A (Mon), Pull A (Tue), Legs (Wed), Push B (Thu), Pull B (Fri).

### `sessions` — Completed Workouts

One record per completed gym visit.

| Field | Type | Index | Description |
|---|---|---|---|
| `id` | `++` (auto) | Primary | Auto-increment ID |
| `planId` | `number?` | Yes | Links to workoutPlans.id |
| `planName` | `string?` | — | Snapshot of plan name at time of session |
| `date` | `string` | Yes | ISO date string (e.g., "2026-07-29") |
| `completedAt` | `string?` | — | ISO timestamp when session was marked complete |
| `notes` | `string?` | — | General notes |
| `feedback` | `string?` | — | User's post-workout freeform feedback |
| `sessionType` | `SessionType?` | Yes (v2) | `'standard'` (default), `'test'` (experiment/adjustment), or `'deload'` (reduced volume) |

**Migration (v2)**: Existing sessions are backfilled to `sessionType: 'standard'` on upgrade.

### `sessionExercises` — Per-Exercise Set Data

Actual logged data for each exercise within a session.

| Field | Type | Index | Description |
|---|---|---|---|
| `id` | `++` (auto) | Primary | Auto-increment ID |
| `sessionId` | `number` | Yes | Links to sessions.id |
| `exerciseId` | `number` | Yes | Links to exercises.id |
| `exerciseName` | `string` | — | Snapshot of exercise name (survives catalog changes) |
| `sets` | `SetRecord[]` | — | Array of set data (see below) |

**SetRecord**:
```ts
{
  setNumber: number;   // 1-based
  reps: number;        // reps completed
  weight: number;      // weight in lbs
  completed: boolean;  // true = hit target, false = failed
  rpe?: number;       // Rate of Perceived Exertion (1-10), optional
}
```

### `recommendations` — AI & Local Suggestions

Coach's suggestions based on data analysis.

| Field | Type | Index | Description |
|---|---|---|---|
| `id` | `++` (auto) | Primary | Auto-increment ID |
| `sessionId` | `number?` | Yes | Links to sessions.id |
| `type` | `string` | Yes | weight_increase, weight_decrease, exercise_swap, rest_more, form_tip, general |
| `exercise` | `string?` | — | Target exercise, if specific |
| `message` | `string` | — | Human-readable recommendation |
| `action` | `string?` | — | Suggested action (e.g., "Increase to 230lbs") |
| `acknowledged` | `boolean` | — | Whether user has seen/acted on it |
| `createdAt` | `string` | Yes | ISO timestamp |

### `userPreferences` — Settings & State

Key-value store for app configuration.

| Field | Type | Index | Description |
|---|---|---|---|
| `id` | `++` (auto) | Primary | Auto-increment ID |
| `key` | `string` | **Unique** | Preference key |
| `value` | `string` | — | Preference value |

**Stored preferences**: `deepseek_api_key`, `chat_history`.

### `capabilityRequests` — AI-Requested Infrastructure (v3)

Requests filed by the AI when it encounters a capability gap. Reviewed in Settings.

| Field | Type | Index | Description |
|---|---|---|---|
| `id` | `string` (UUID) | Primary | Unique request ID |
| `title` | `string` | — | Short title (e.g., "Scheduling Engine") |
| `description` | `string` | — | What capability is needed and why |
| `problem` | `string` | — | What task was blocked |
| `blockedFeature` | `string` | — | What user-facing feature is blocked |
| `suggestedTools` | `string[]` | — | Tool names the AI thinks would help |
| `priority` | `string` | Yes | `blocking`, `enhancement`, `nice_to_have` |
| `conversationContext` | `string` | — | The conversation that triggered the request |
| `status` | `string` | Yes | `pending` → `approved` → `building` → `deployed` or `dismissed` |
| `createdAt` | `string` | — | ISO timestamp |
| `deployedAt` | `string?` | — | When the capability was deployed |

**Migration (v3)**: Adds the `capabilityRequests` table with indexes on `status` and `priority`.

### `bodyWeightLogs` — Body Weight Tracking (v4)

Weekly weigh-in measurements for trend analysis.

| Field | Type | Index | Description |
|---|---|---|---|
| `id` | `++` (auto) | Primary | Auto-increment ID |
| `date` | `string` | Yes | ISO date of weigh-in |
| `weight` | `number` | — | Body weight in pounds |
| `notes` | `string?` | — | Optional notes (e.g., "morning, fasted") |

### `macroLogs` — Daily Nutrition Tracking (v4)

Daily macro and calorie intake for nutrition monitoring.

| Field | Type | Index | Description |
|---|---|---|---|
| `id` | `++` (auto) | Primary | Auto-increment ID |
| `date` | `string` | Yes | ISO date |
| `protein` | `number` | — | Protein in grams |
| `carbs` | `number` | — | Carbohydrates in grams |
| `fat` | `number` | — | Fat in grams |
| `calories` | `number?` | — | Total kcal (auto-computed: 4p + 4c + 9f if not provided) |
| `notes` | `string?` | — | Optional notes (e.g., meal details) |

**Migration (v4)**: Adds the `bodyWeightLogs` and `macroLogs` tables with indexes on `date`.

## Entity Relationships

```
exercises ─────────────────┐
   │ (exerciseId)          │ (exerciseId)
   ▼                       ▼
workoutPlans          sessionExercises
   │ (planId)              │ (sessionId)
   ▼                       ▼
sessions ◄─────────────────┘
   │ (sessionId)
   ▼
recommendations

userPreferences (standalone key-value)
capabilityRequests (standalone, AI-filed infrastructure requests)
bodyWeightLogs (standalone, weekly weigh-in tracking)
macroLogs (standalone, daily nutrition tracking)
```

## CRUD Access Patterns

| Operation | Method | Example |
|---|---|---|
| Get today's plan | `useWorkoutPlans().getPlanForDay(new Date().getDay())` | Synchronous from state |
| Create session | `useSessions().createSession({planName, date, ...})` | Returns new session ID |
| Log exercise sets | `useSessions().addSessionExercise({sessionId, exerciseId, exerciseName, sets})` | Writes to sessionExercises |
| Update session | `useSessions().updateSession(id, { feedback, sessionType })` | Edits session fields + optionally replaces exercises |
| Delete session | `useSessions().deleteSession(id)` | Cascades to sessionExercises |
| Add exercise | `useExercises().addExercise(name, category)` | Adds to catalog on the fly |
| Get last session's weight | `useSessions().getLastSessionExercise(exerciseId)` | Finds most recent session with that exercise |
| Save API key | `upsertPreference('deepseek_api_key', key)` | Safe upsert (no duplicate key errors) |
| Get session history | `db.sessions.orderBy('date').reverse().limit(20).toArray()` | For system prompt context |
| Query by sessionType | `db.sessions.where('sessionType').equals('deload').toArray()` | Filter sessions by type |
| AI generic query | `db_query` tool via `toolRegistry` | Any table, any filter, optional joins |
| AI generic mutate | `db_mutate` tool via `toolRegistry` | Create/update/delete any record |
| AI log weight | `log_bodyweight` tool via `toolRegistry` | Inserts into bodyWeightLogs |
| AI log macros | `log_macros` tool via `toolRegistry` | Inserts into macroLogs (auto-computes calories) |
| AI analyze weight trend | `compute(formula="weight_trend")` via `toolRegistry` | Reads bodyWeightLogs, computes delta + weekly rate |
| AI analyze macro averages | `compute(formula="macro_averages")` via `toolRegistry` | Reads macroLogs, computes daily averages |
| AI file capability request | `request_capability` tool | Inserts into capabilityRequests |
| Get pending requests | `db.capabilityRequests.where('status').equals('pending').toArray()` | Settings UI |

## Seed Strategy

On first load, `seedDatabase()` runs once:
1. Checks `db.exercises.count()` — if > 0, skips
2. Inserts 17 Planet Fitness exercises
3. Inserts 5 workout plans (Push A/B, Pull A/B, Legs) mapped to weekdays
4. Inserts 6 historical sessions with actual set data
5. `AppProvider` calls `refreshPlans()`, `refreshExercises()`, `refreshSessions()` to sync hooks

To re-seed: Settings → Reset All Data → page reloads → seed runs fresh.

---

*Last updated: 2026-08-02 · Added bodyWeightLogs + macroLogs tables (v4 migration), body/nutrition tracking tools*
