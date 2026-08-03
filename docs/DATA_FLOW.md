# Data Flow

End-to-end walkthrough of the agentic execution loop with native tool calling, replacing the legacy `<!--ACTION-->` regex pattern.

## Flow 1: Requesting Today's Workout

```
User: "today's workout"
    │
    ▼
ChatContext.sendMessage("today's workout")
    ├─ Checks: hasApiKey? → yes
    ├─ Adds user message to state
    │
    ▼
buildContext() gathers live state → buildSystemPrompt() assembles prompt
    │
    ▼
┌─ Execution Loop (iteration 1) ──────────────────────────┐
│  POST to DeepSeek with 13 tool definitions + message    │
│  Body: { model:"deepseek-chat", messages:[...],          │
│          tools:[...], tool_choice:"auto" }               │
│      ↓                                                   │
│  Response: { finish_reason: "stop", content: "..." }    │
│  → No tool calls needed, exit loop                      │
└──────────────────────────────────────────────────────────┘
    │
    ▼
Final response displayed: workout table with exercises, weights, form cues
ChatView renders with markdown, no action badges (no tools called)
```

## Flow 2: Logging a Completed Workout (with substitution)

```
User: "workout complete — swapped incline DB for plate-loaded incline press at 90lbs"
    │
    ▼
ChatContext.sendMessage(...) → buildContext() includes today's Push A plan
    │
    ▼
┌─ Execution Loop (iteration 1) ──────────────────────────┐
│  POST to DeepSeek with tools + message                  │
│      ↓                                                   │
│  Response: finish_reason: "tool_calls"                   │
│  tool_calls: [{                                          │
│    function: { name: "log_session", arguments: {         │
│      planName: "Push A", sessionType: "standard",       │
│      exercises: [                                        │
│        {name:"Machine Chest Press", sets:[{weight:80,...}]},
│        {name:"Plate-Loaded Incline Press", sets:[{weight:90,...}]}
│      ],                                                  │
│      substitutions: [{                                   │
│        planned: "Incline Dumbbell Press",                │
│        actual: "Plate-Loaded Incline Press"              │
│      }]                                                  │
│    }}                                                    │
│  }]                                                      │
│      ↓                                                   │
│  executeToolCall("log_session", args):                   │
│      ├─ db.sessions.add(...) → sessionId: 7             │
│      ├─ db.sessionExercises.add(...) per exercise       │
│      ├─ Substitution tracked with session               │
│      ├─ app.completeSession(7)                          │
│      └─ app.refreshSessions()                           │
│      ↓                                                   │
│  Tool result appended to conversation → continue loop   │
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Execution Loop (iteration 2) ──────────────────────────┐
│  POST to DeepSeek (AI sees tool result in context)      │
│      ↓                                                   │
│  Response: finish_reason: "stop"                         │
│  Content: "Push A logged! Noted the substitution.        │
│  If you prefer plate-loaded going forward, I can         │
│  update the plan template. 💪"                           │
│  → Exit loop                                             │
└──────────────────────────────────────────────────────────┘
    │
    ▼
UI updates: Chat shows response + ✓ badge, History shows actual exercises (not template)
```

## Flow 3: Getting Recommendations (multi-tool chain)

```
User: "any suggestions?"
    │
    ▼
┌─ Execution Loop (iteration 1) ──────────────────────────┐
│  POST to DeepSeek                                        │
│      ↓                                                   │
│  tool_calls: [{                                          │
│    function: { name: "query_sessions",                   │
│      arguments: { limit: 20 } }                          │
│  }]                                                      │
│      ↓                                                   │
│  executeToolCall → returns 20 sessions with exercise data│
│  Result appended to conversation                         │
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Execution Loop (iteration 2) ──────────────────────────┐
│  POST to DeepSeek (AI now sees 20 sessions)              │
│      ↓                                                   │
│  tool_calls: [{                                          │
│    function: { name: "compute",                          │
│      arguments: { formula: "plateau_detect", weeks: 4 }  │
│    }                                                     │
│  }]                                                      │
│      ↓                                                   │
│  executeToolCall → "Machine Chest Press: 3 sessions at 80lb"│
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Execution Loop (iteration 3) ──────────────────────────┐
│  POST to DeepSeek (AI has plateau analysis)              │
│      ↓                                                   │
│  tool_calls: [{                                          │
│    function: { name: "save_recommendation",              │
│      arguments: { type:"weight_increase",                │
│        exercise:"Machine Chest Press",                   │
│        message:"Hit 3×10 at 80lb — time for 85lb" }     │
│    }                                                     │
│  }]                                                      │
│      ↓                                                   │
│  executeToolCall → saves recommendation to DB            │
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Execution Loop (iteration 4) ──────────────────────────┐
│  Response: finish_reason: "stop"                         │
│  Content: "Here's what I see: Chest Press at 80lb for    │
│  3 sessions — time for 85lb. DB Curl holding at 10lb     │
│  with strict form is exactly right..."                   │
│  → Exit loop                                             │
└──────────────────────────────────────────────────────────┘
    │
    ▼
Recommendation saved + analysis shown — all in one user turn
```

## Flow 4: Editing a Past Session

```
User: "fix my bench press on Monday to 85lbs"
    │
    ▼
┌─ Execution Loop (iteration 1) ──────────────────────────┐
│  tool_calls: [{                                          │
│    function: { name: "query_sessions",                   │
│      arguments: { planName: "Push A" }                   │
│    }                                                     │
│  }]                                                      │
│      ↓                                                   │
│  executeToolCall → returns sessions, AI identifies #7    │
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Execution Loop (iteration 2) ──────────────────────────┐
│  tool_calls: [{                                          │
│    function: { name: "update_session",                   │
│      arguments: { sessionId: 7, exercises: [             │
│        {name:"Machine Chest Press", sets:[{weight:85,...}]}
│      ]}                                                  │
│    }                                                     │
│  }]                                                      │
│      ↓                                                   │
│  executeToolCall → deletes old exercises, inserts updated│
│  db.sessions.update(7, ...), app.refreshSessions()       │
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Execution Loop (iteration 3) ──────────────────────────┐
│  Response: finish_reason: "stop"                         │
│  "Updated your Monday Push A session. Chest Press        │
│  corrected to 85lbs. History tab reflects the change."   │
│  → Exit loop                                             │
└──────────────────────────────────────────────────────────┘
```

## Flow 5: Querying and Analyzing (same-turn, no "ok" needed)

```
User: "analyze my chest press RPE trend and suggest weight changes"
    │
    ▼
┌─ Execution Loop (iteration 1) ──────────────────────────┐
│  tool_calls: [{                                          │
│    function: { name: "get_rpe_trend",                    │
│      arguments: { exerciseName: "Machine Chest Press" }  │
│    }                                                     │
│  }]                                                      │
│      ↓                                                   │
│  executeToolCall → RPE data: avg 7.2, 6 sessions        │
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Execution Loop (iteration 2) ──────────────────────────┐
│  tool_calls: [{                                          │
│    function: { name: "compute",                          │
│      arguments: {                                        │
│        formula: "progression_rate",                      │
│        exercise: "Machine Chest Press", weeks: 4         │
│      }                                                   │
│    }                                                     │
│  }]                                                      │
│      ↓                                                   │
│  executeToolCall → +5 lbs over 4 weeks, 1.25 lbs/week   │
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Execution Loop (iteration 3) ──────────────────────────┐
│  Response: finish_reason: "stop"                         │
│  Content: "Your Chest Press RPE has been 7-8 for 3 weeks │
│  with steady progression (+5lbs/month). I recommend      │
│  adding 5lbs next session. Suggestion saved."            │
│  → Exit loop                                             │
└──────────────────────────────────────────────────────────┘
```

**Key difference**: No more "ok" follow-up. The AI queried → computed → responded all in one turn.

## Key Data Relationships During Flow

```
User message "today's workout"
    ↓ reads
workoutPlans[dayOfWeek=1] → Push A template
    ↓ references
exercises[id=1,3,5,6,...] → Machine Chest Press, Incline DB Press, ...
    ↓ builds
System prompt with full context (20 sessions + 10 recs)
    ↓ sent to
DeepSeek API (with 13 tool definitions as JSON Schema)
    ↓ returns
Structured response (content + optional tool_calls)

User message "workout complete" (with substitution)
    ↓ AI calls
log_session tool (with substitutions field)
    ↓ writes
sessions[id=7] + sessionExercises[...] with actual exercise names
    ↓ refreshes
AppContext.sessions → UI updates with correct (not template) exercises

User message "any suggestions?"
    ↓ AI chains in one turn
query_sessions → compute(plateau_detect) → save_recommendation
    ↓
Recommendations saved + analysis shown

User message "show RPE trends"
    ↓ AI chains in one turn
get_rpe_trend → compute(progression_rate)
    ↓
Full analysis returned — no "ok" needed
```

## Execution Loop Pattern (replaces all legacy flows)

```
User sends message
    ↓
buildContext() + buildSystemPrompt()
    ↓
while (iteration < 10):
    POST to DeepSeek (messages + tools)
    ↓
    if finish_reason == "stop": break → show final content
    if finish_reason == "tool_calls":
        for each tool_call:
            executeToolCall(name, args)  ← toolRegistry lookup
            append {role:"tool", content:result}
        continue loop (AI sees results)
    ↓
Final response displayed with ActionResult badges
```

---

*Last updated: 2026-08-02 · Complete rewrite for native tool calling, execution loop, same-turn queries, exercise substitutions*
