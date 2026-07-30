# Data Flow

End-to-end walkthrough: "What happens when I type 'today's workout'?"

## Flow 1: Requesting Today's Workout

```
User: "today's workout"
    │
    ▼
ChatContext.sendMessage("today's workout")
    │
    ├─ Checks: hasApiKey? → yes
    ├─ Adds user message to state
    │
    ▼
buildContext() gathers live state:
    │
    ├─ new Date().getDay() → 1 (Monday)
    ├─ app.getPlanForDay(1) → Push A plan
    │   └─ {name:"Push A", exercises:[
    │       {exerciseId:1, sets:3, reps:10},  // Machine Chest Press
    │       {exerciseId:3, sets:3, reps:10},  // Incline DB Press
    │       ...
    │     ]}
    ├─ app.plans → all 5 plans
    ├─ app.exercises → 17 exercises grouped by category
    ├─ db.sessions (last 20) → recent history (full detail for 10 most recent, condensed for older)
    ├─ db.recommendations (last 10) → past recommendations with acknowledged status
    │
    ▼
buildSystemPrompt({
    today: "Monday",
    todayDayIndex: 1,
    todaysPlan: {
        name: "Push A",
        exercises: [
            "Machine Chest Press — 3 sets x 10 reps",
            "Incline Dumbbell Press — 3 sets x 10 reps",
            ...
        ]
    },
    allPlans: "Push A [Mon]: Machine Chest Press (3x10), ...",
    exerciseCatalog: "chest: Machine Chest Press, Incline DB Press, Pec Deck\n...",
    recentSessionData: "2026-07-27 — Push A\n  - Machine Chest Press: Set1: 80lbs x 10...",
    recommendationSummary: "[○] weight_increase (Machine Chest Press): Hit 3×10 at 80lb...\n..."
})
    │
    ▼
Assembles full system prompt (coaching persona + context)
    │
    ▼
POST https://api.deepseek.com/v1/chat/completions
Headers: Authorization: Bearer sk-...
Body: {
    model: "deepseek-chat",
    messages: [
        {role:"system", content:"<full coaching prompt>"},
        ...last 10 conversation turns,
        {role:"user", content:"today's workout"}
    ],
    temperature: 0.7,
    max_tokens: 2048
}
    │
    ▼
DeepSeek response (example):
"Here's your Push A workout for today, athlete:

| Exercise | Sets×Reps | Working Weight |
|---|---|---|
| Machine Chest Press | 3×10 | 80 lb |
| Incline Dumbbell Press | 3×10 | 25 lb each |
| Machine Shoulder Press | 3×10 | 40 lb |
| Pec Deck | 3×12 | 60 lb |
| Lateral Raise | 3×15 | 10 lb each |
| Cable Triceps Pushdown | 3×12 | 20 lb |

Form cue: Keep shoulder blades retracted on chest press. Let me know when you're done!"
    │
    ▼
parseActions(response) → [] (no ACTION blocks — just information)
    │
    ▼
stripActions(response) → same text (nothing to strip)
    │
    ▼
setMessages([...messages, {role:"assistant", content, actions:[]}])
    │
    ▼
ChatView renders the message with markdown
```

## Flow 2: Logging a Completed Workout

```
User: "workout complete"
    │
    ▼
ChatContext.sendMessage("workout complete")
    │
    ▼
buildContext() → Same as above — includes today's Push A plan
    │
    ▼
DeepSeek with context: today's plan + the message "workout complete"
    │
    ▼
AI infers: All exercises completed as prescribed
Generates response with ACTION block:
"Push A logged! Solid work. Chest Press is progressing well — 
we'll look at bumping weight next week. 💪

<!--ACTION:{"action":"log_session","data":{
  "planName":"Push A",
  "exercises":[
    {"name":"Machine Chest Press","sets":[
      {"setNumber":1,"reps":10,"weight":80,"completed":true},
      {"setNumber":2,"reps":10,"weight":80,"completed":true},
      {"setNumber":3,"reps":10,"weight":80,"completed":true}
    ]},
    ...all 6 exercises...
  ],
  "feedback":"All exercises completed as prescribed",
  "sessionType":"standard"
}}-->"
    │
    ▼
parseActions(response)
    │
    ├─ Regex: /<!--ACTION:(.*?)-->/g
    ├─ Match 1: {"action":"log_session","data":{...}}
    └─ Returns: [{action:"log_session", data:{...}}]
    │
    ▼
stripActions(response) → Gets text without ACTION block
    │
    ▼
executeActions([{action:"log_session", data:{...}}])
    │
    ├─ Finds plan "Push A" via app.getPlanByName()
    ├─ db.sessions.add({planId, planName:"Push A", date:"2026-07-29", ...})
    │   → returns sessionId: 7
    ├─ For each exercise in data.exercises:
    │   db.sessionExercises.add({sessionId:7, exerciseId, exerciseName, sets})
    ├─ db.sessions.update(7, {completedAt: now, feedback: ...})
    └─ app.refreshSessions()
    │
    ▼
setMessages([...messages, {
    role:"assistant",
    content:"Push A logged! Solid work...",
    actions:[{type:"log_session", success:true, summary:"Session #7 logged"}]
}])
    │
    ▼
UI updates:
    ├─ Chat shows AI response with green ✓ badge
    ├─ Settings → session count increments
    └─ History tab → new session appears
```

## Flow 3: Getting Recommendations

```
User: "any suggestions?"
    │
    ▼
Same initial flow → DeepSeek receives full context including session history
    │
    ▼
AI analyzes patterns:
    - Machine Chest Press: 80×10 for 3 consecutive sessions → time to increase
    - DB Curl: 10lb, struggling with form → keep weight, focus on technique
    │
    ▼
AI response with recommendation ACTION:
"Here's what I see in your data:

**Machine Chest Press**: You've hit 3×10 at 80lb for 3 sessions straight. 
Time to try 85lb next Push day. Keep 1-2 reps in reserve.

**Dumbbell Curl**: Holding at 10lb with strict form is exactly right. 
Don't increase until all reps feel controlled.

<!--ACTION:{"action":"save_recommendation","data":{
  "type":"weight_increase",
  "exercise":"Machine Chest Press",
  "message":"Hit 3×10 at 80lb for 3 sessions. Time to try 85lb.",
  "action":"Increase Machine Chest Press from 80lb to 85lb"
}}-->"
    │
    ▼
executeActions saves recommendation to DB
    │
    ▼
Recommendation appears in chat, stored in recommendations table
```

## Flow 4: Editing a Past Session (Chat)

```
User: "fix my bench press on Monday to 85lbs"
    │
    ▼
Same initial flow → DeepSeek receives full context
    │
    ▼
AI identifies the session and generates update_session ACTION:
"I found your Monday Push A session. Updating Machine Chest Press to 85lbs.

<!--ACTION:{"action":"update_session","data":{
  "sessionId":7,
  "exercises":[
    {"name":"Machine Chest Press","sets":[
      {"setNumber":1,"reps":10,"weight":85,"completed":true},
      {"setNumber":2,"reps":10,"weight":85,"completed":true},
      {"setNumber":3,"reps":10,"weight":85,"completed":true}
    ]},
    ...other exercises unchanged...
  ]
}}-->"
    │
    ▼
executeActions handles update_session:
    ├─ db.sessions.update(7, { feedback, sessionType })
    ├─ db.sessionExercises.where('sessionId').equals(7).delete()  // remove old
    ├─ For each exercise in data.exercises:
    │   db.sessionExercises.add(...)  // insert updated
    └─ app.refreshSessions()
    │
    ▼
UI updates → History tab shows corrected weights
```

## Flow 5: Querying History / RPE Trends (Two-Turn)

```
User: "show me RPE trends for Machine Chest Press"
    │
    ▼
Same initial flow → DeepSeek receives context
    │
    ▼
AI generates get_rpe_trend query ACTION:
"Let me pull up your RPE data for Machine Chest Press.

<!--ACTION:{"action":"get_rpe_trend","data":{"exerciseName":"Machine Chest Press"}}-->"
    │
    ▼
executeActions handles get_rpe_trend:
    ├─ Queries all sessionExercises matching "Machine Chest Press"
    ├─ Extracts RPE values across all sessions
    ├─ Calculates avg RPE, per-session breakdowns
    └─ Returns queryResults as system message:
        "\n📈 RPE Trend Analysis for "Machine Chest Press":
         2026-07-28 — Machine Chest Press: Set1: 80lbs x 10 @RPE7, Set2: 80lbs x 10 @RPE8, ...
         2026-07-21 — Machine Chest Press: Set1: 70lbs x 10 @RPE6, ...
         Summary: 6 sessions, 18 total sets. Average RPE: 7.2"
    │
    ▼
System message injected into messagesRef.current
    │
    ▼
User: "ok" (next message)
    │
    ▼
AI now sees RPE trend data in context and can analyze:
"Your Machine Chest Press RPE has been creeping up from ~6 to ~8 over the last 3 weeks.
This suggests the weight is appropriately challenging. No need to increase yet —
let's hold at 80lbs and focus on clean reps."
```

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
DeepSeek API
    ↓ returns
Natural language + <!--ACTION--> blocks

User message "workout complete"
    ↓ AI generates
log_session action (with sessionType)
    ↓ writes
sessions[id=7] + sessionExercises[...]
    ↓ refreshes
AppContext.sessions → UI updates

User message "fix my bench press"
    ↓ AI generates
update_session action
    ↓ deletes + re-inserts
sessionExercises for session #7
    ↓ refreshes
AppContext.sessions → History tab shows corrected data

User message "show RPE trends"
    ↓ AI generates
get_rpe_trend action
    ↓ queries + formats
RPE data across all matching sessions
    ↓ injects system message
AI sees trend data on next user message → can analyze
```

---

*Last updated: 2026-07-30 · Updated for sessionType, edit/delete flows, two-turn query pattern, 20-session context*
