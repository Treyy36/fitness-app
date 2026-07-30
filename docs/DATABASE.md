# Database Schema

IndexedDB (via Dexie.js) schema for GymTracker AI. All data stored locally on device.

## Tables

### `exercises` — Exercise Catalog

Master catalog of available exercises.

| Field | Type | Index | Description |
|---|---|---|---|
| `id` | `++` (auto) | Primary | Auto-increment ID |
| `name` | `string` | Yes | Exercise name (e.g., "Leg Press") |
| `category` | `MuscleGroup` | Yes | chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, abs, other |
| `defaultSets` | `number` | — | Default sets for this exercise |
| `defaultReps` | `number` | — | Default reps for this exercise |
| `notes` | `string?` | — | Optional notes (e.g., "Seconds" for planks) |

**Seed data**: 17 Planet Fitness exercises.

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
```

## CRUD Access Patterns

| Operation | Method | Example |
|---|---|---|
| Get today's plan | `useWorkoutPlans().getPlanForDay(new Date().getDay())` | Synchronous from state |
| Create session | `useSessions().createSession({planName, date, ...})` | Returns new session ID |
| Log exercise sets | `useSessions().addSessionExercise({sessionId, exerciseId, exerciseName, sets})` | Writes to sessionExercises |
| Get last session's weight | `useSessions().getLastSessionExercise(exerciseId)` | Finds most recent session with that exercise |
| Save API key | `upsertPreference('deepseek_api_key', key)` | Safe upsert (no duplicate key errors) |
| Get recent history | `db.sessions.orderBy('date').reverse().limit(5).toArray()` | For system prompt context |

## Seed Strategy

On first load, `seedDatabase()` runs once:
1. Checks `db.exercises.count()` — if > 0, skips
2. Inserts 17 Planet Fitness exercises
3. Inserts 5 workout plans (Push A/B, Pull A/B, Legs) mapped to weekdays
4. Inserts 6 historical sessions with actual set data
5. `AppProvider` calls `refreshPlans()`, `refreshExercises()`, `refreshSessions()` to sync hooks

To re-seed: Settings → Reset All Data → page reloads → seed runs fresh.

---

*Last updated: 2026-07-30 · Generated from codebase at commit `fc045e8`*
