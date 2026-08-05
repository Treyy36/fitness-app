import * as fb from '../firebase';
import type { SetRecord, Recommendation, MuscleGroup, SessionType } from '../firebase/types';
import type { ChatMessage, ActionResult } from '../context/ChatContext';

// ─── Tool Definition Types ────────────────────────────────────────────────

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  enum?: string[];
  properties?: Record<string, ToolParameter>;
  items?: ToolParameter;
  required?: string[];
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameter>;
      required?: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ToolResult {
  tool_call_id: string;
    role: 'tool';
  content: string; // JSON string
}

// ─── App Context Interface (subset used by tool handlers) ─────────────────

export interface ToolAppContext {
  getPlanByName: (name: string) => { id?: string; name: string; exercises: Array<{ exerciseId: string; targetSets: number; targetReps: number }> } | null;
  getPlanForDay: (day: number) => { id?: string; name: string; exercises: Array<{ exerciseId: string; targetSets: number; targetReps: number }> } | null;
  createPlan: (plan: any) => Promise<string>;
  updatePlan: (id: string, updates: any) => Promise<void>;
  createSession: (session: any) => Promise<string>;
  completeSession: (id: string, feedback?: string) => Promise<void>;
  updateSession: (id: string, updates: any) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  addSessionExercise: (ex: any) => Promise<string>;
  addExercise: (name: string, category: MuscleGroup, defaultSets?: number, defaultReps?: number) => Promise<string>;
  exercises: { id?: string; name: string; category: string }[];
  refreshSessions: () => Promise<void>;
  setActiveSessionId: (id: string | null) => void;
  userId: string;
}

// ─── Tool Handler Type ────────────────────────────────────────────────────

type ToolHandler = (args: Record<string, any>, app: ToolAppContext) => Promise<ToolHandlerResult>;

interface ToolHandlerResult {
  success: boolean;
  summary: string;
  data?: any;
  queryResults?: ChatMessage[];
}

// ─── Tool Definitions (JSON Schema for DeepSeek API) ──────────────────────

const toolDefinitions: Record<string, ToolDefinition> = {
  log_session: {
    type: 'function',
    function: {
      name: 'log_session',
      description: 'Log a completed workout session. Records exercises with sets, reps, weight, RPE, and completion status.',
      parameters: {
        type: 'object',
        properties: {
          planName: { type: 'string', description: 'Name of the workout plan (e.g., "Push A")' },
          planId: { type: 'number', description: 'ID of the plan (optional, planName is preferred)' },
          feedback: { type: 'string', description: 'Post-workout notes or feedback' },
          sessionType: { type: 'string', enum: ['standard', 'test', 'deload'], description: 'Type of session. Use "test" for experimental sessions, "deload" for reduced volume. Defaults to "standard".' },
          exercises: {
            type: 'array',
            description: 'Exercises performed in this session',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Exact exercise name as used by the athlete' },
                sets: {
                  type: 'array',
                  description: 'Sets performed',
                  items: {
                    type: 'object',
                    properties: {
                      setNumber: { type: 'number', description: 'Set number (1-based)' },
                      reps: { type: 'number', description: 'Reps completed' },
                      weight: { type: 'number', description: 'Weight in pounds' },
                      completed: { type: 'boolean', description: 'Whether the set was completed' },
                      rpe: { type: 'number', description: 'Rate of Perceived Exertion (1-10), optional' },
                    },
                    required: ['setNumber', 'reps', 'weight', 'completed'],
                  },
                },
              },
              required: ['name', 'sets'],
            },
          },
          substitutions: {
            type: 'array',
            description: 'Exercise substitutions made (planned exercise → actual exercise)',
            items: {
              type: 'object',
              properties: {
                planned: { type: 'string', description: 'Exercise from the plan template' },
                actual: { type: 'string', description: 'Exercise actually performed' },
                reason: { type: 'string', description: 'Why the substitution was made (optional)' },
              },
              required: ['planned', 'actual'],
            },
          },
        },
        required: ['planName', 'exercises'],
      },
    },
  },

  create_plan: {
    type: 'function',
    function: {
      name: 'create_plan',
      description: 'Create a new workout plan template with exercises, sets, and reps.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Plan name (e.g., "Push C", "Legs A")' },
          dayOfWeek: { type: 'number', description: 'Day of week (0=Sun, 1=Mon, ..., 6=Sat). Omit for unscheduled plans.' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Exercise name from the catalog' },
                sets: { type: 'number', description: 'Number of sets' },
                reps: { type: 'number', description: 'Target reps per set' },
              },
              required: ['name', 'sets', 'reps'],
            },
          },
        },
        required: ['name', 'exercises'],
      },
    },
  },

  update_plan: {
    type: 'function',
    function: {
      name: 'update_plan',
      description: 'Modify an existing workout plan — change exercises, name, or day.',
      parameters: {
        type: 'object',
        properties: {
          planId: { type: 'number', description: 'ID of the plan to update' },
          name: { type: 'string', description: 'New name for the plan' },
          dayOfWeek: { type: 'number', description: 'New day of week (0-6)' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Exercise name' },
                sets: { type: 'number' },
                reps: { type: 'number' },
              },
              required: ['name', 'sets', 'reps'],
            },
          },
        },
        required: ['planId'],
      },
    },
  },

  update_session: {
    type: 'function',
    function: {
      name: 'update_session',
      description: 'Edit a previously logged session — fix weights, reps, RPE, feedback, or session type.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'number', description: 'ID of the session to update' },
          feedback: { type: 'string', description: 'Updated feedback notes' },
          notes: { type: 'string', description: 'Updated session notes' },
          sessionType: { type: 'string', enum: ['standard', 'test', 'deload'] },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                sets: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      setNumber: { type: 'number' },
                      reps: { type: 'number' },
                      weight: { type: 'number' },
                      completed: { type: 'boolean' },
                      rpe: { type: 'number' },
                    },
                    required: ['setNumber', 'reps', 'weight', 'completed'],
                  },
                },
              },
              required: ['name', 'sets'],
            },
          },
        },
        required: ['sessionId'],
      },
    },
  },

  delete_session: {
    type: 'function',
    function: {
      name: 'delete_session',
      description: 'Permanently remove a session that was logged incorrectly or is a duplicate.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'number', description: 'ID of the session to delete' },
        },
        required: ['sessionId'],
      },
    },
  },

  add_exercise: {
    type: 'function',
    function: {
      name: 'add_exercise',
      description: 'Add a new exercise to the catalog on the fly.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Exercise name' },
          category: { type: 'string', enum: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'other'], description: 'Muscle group category' },
          defaultSets: { type: 'number', description: 'Default number of sets' },
          defaultReps: { type: 'number', description: 'Default reps per set' },
        },
        required: ['name', 'category'],
      },
    },
  },

  save_recommendation: {
    type: 'function',
    function: {
      name: 'save_recommendation',
      description: 'Save a coaching recommendation for the athlete.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['weight_increase', 'weight_decrease', 'exercise_swap', 'rest_more', 'form_tip', 'general'], description: 'Type of recommendation' },
          exercise: { type: 'string', description: 'Related exercise name (optional)' },
          message: { type: 'string', description: 'Recommendation message' },
          action: { type: 'string', description: 'Specific action to take (optional)' },
          sessionId: { type: 'number', description: 'Related session ID (optional)' },
        },
        required: ['type', 'message'],
      },
    },
  },

  query_sessions: {
    type: 'function',
    function: {
      name: 'query_sessions',
      description: 'Query session history with filters. Returns detailed session data for analysis.',
      parameters: {
        type: 'object',
        properties: {
          exerciseName: { type: 'string', description: 'Filter by exercise name' },
          dateFrom: { type: 'string', description: 'Start date (ISO format, e.g., "2026-07-01")' },
          dateTo: { type: 'string', description: 'End date (ISO format)' },
          planName: { type: 'string', description: 'Filter by plan name' },
          sessionType: { type: 'string', enum: ['standard', 'test', 'deload'] },
          limit: { type: 'number', description: 'Max results (default 20)' },
        },
        required: [],
      },
    },
  },

  query_recommendations: {
    type: 'function',
    function: {
      name: 'query_recommendations',
      description: 'Query past coaching recommendations.',
      parameters: {
        type: 'object',
        properties: {
          exercise: { type: 'string', description: 'Filter by exercise name' },
          type: { type: 'string', enum: ['weight_increase', 'weight_decrease', 'exercise_swap', 'rest_more', 'form_tip', 'general'] },
          acknowledged: { type: 'boolean', description: 'Filter by acknowledged status' },
          limit: { type: 'number', description: 'Max results (default 15)' },
        },
        required: [],
      },
    },
  },

  get_rpe_trend: {
    type: 'function',
    function: {
      name: 'get_rpe_trend',
      description: 'Get RPE (Rate of Perceived Exertion) trend data across all sessions for a specific exercise.',
      parameters: {
        type: 'object',
        properties: {
          exerciseName: { type: 'string', description: 'Exercise name to analyze' },
        },
        required: ['exerciseName'],
      },
    },
  },

  // ─── Body & Nutrition Tracking (Capability Request) ──────────────

  log_bodyweight: {
    type: 'function',
    function: {
      name: 'log_bodyweight',
      description: 'Log a body weight measurement. Use this when the athlete reports their weight — typically weekly weigh-ins for trend tracking.',
      parameters: {
        type: 'object',
        properties: {
          weight: { type: 'number', description: 'Body weight in pounds' },
          date: { type: 'string', description: 'Date of measurement (ISO format). Defaults to today.' },
          notes: { type: 'string', description: 'Optional notes (e.g., morning weight, post-workout, etc.)' },
        },
        required: ['weight'],
      },
    },
  },

  log_macros: {
    type: 'function',
    function: {
      name: 'log_macros',
      description: 'Log daily macro intake (protein, carbs, fat, calories). Use this when the athlete reports their nutrition. Calories are auto-computed from macros if not provided (4cal/g protein + 4cal/g carbs + 9cal/g fat).',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'What the athlete ate (e.g., "Breakfast burrito", "Chicken, rice, broccoli"). This is the food description, not a note.' },
          protein: { type: 'number', description: 'Protein in grams' },
          carbs: { type: 'number', description: 'Carbohydrates in grams' },
          fat: { type: 'number', description: 'Fat in grams' },
          calories: { type: 'number', description: 'Total calories (optional — auto-computed from macros if omitted)' },
          date: { type: 'string', description: 'Date (ISO format). Defaults to today.' },
          notes: { type: 'string', description: 'Optional notes (e.g., diet adherence, hunger levels, context about the meal)' },
        },
        required: ['protein', 'carbs', 'fat'],
      },
    },
  },

  update_macros: {
    type: 'function',
    function: {
      name: 'update_macros',
      description: 'Update an existing macro log entry. Use this to correct or amend previously logged nutrition data — fix inaccurate macros, update the food description, or change the date.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID of the macro log entry to update (obtained from query_macros)' },
          description: { type: 'string', description: 'Updated food description (what they ate)' },
          protein: { type: 'number', description: 'Corrected protein in grams' },
          carbs: { type: 'number', description: 'Corrected carbs in grams' },
          fat: { type: 'number', description: 'Corrected fat in grams' },
          calories: { type: 'number', description: 'Corrected calories' },
          date: { type: 'string', description: 'Corrected date (ISO format)' },
          notes: { type: 'string', description: 'Updated notes' },
        },
        required: ['id'],
      },
    },
  },

  query_macros: {
    type: 'function',
    function: {
      name: 'query_macros',
      description: 'Query nutrition/macro log entries. Use this to look up past meals, check macro history, or find a specific entry to correct. Returns entries with their IDs for use with update_macros.',
      parameters: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string', description: 'Start date (ISO format, e.g., "2026-07-01")' },
          dateTo: { type: 'string', description: 'End date (ISO format)' },
          limit: { type: 'number', description: 'Max results (default 20)' },
        },
        required: [],
      },
    },
  },

  // ─── Generic Primitives (Phase 2) ────────────────────────────────

  db_query: {
    type: 'function',
    function: {
      name: 'db_query',
      description: 'Run a read query against the workout database. Use this for ANY data lookup — session history, exercise catalog, plan details, recommendations, preferences. Supports filters, sorting, and optional joins.',
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string', enum: ['sessions', 'sessionExercises', 'exercises', 'workoutPlans', 'recommendations', 'userPreferences', 'capabilityRequests', 'macroLogs', 'bodyWeightLogs'], description: 'Table to query' },
          filters: { type: 'object', description: 'Key-value filters (e.g., {"exerciseName": "Machine Chest Press", "sessionType": "standard"})' },
          join: { type: 'string', description: 'Join with another table. E.g., join "sessionExercises" when querying sessions to get exercise data.' },
          orderBy: { type: 'string', description: 'Field to sort by (e.g., "date"). Prefix with - for descending.' },
          limit: { type: 'number', description: 'Max results. Default 50.' },
          dateFrom: { type: 'string', description: 'Start date filter (ISO format)' },
          dateTo: { type: 'string', description: 'End date filter (ISO format)' },
        },
        required: ['table'],
      },
    },
  },

  db_mutate: {
    type: 'function',
    function: {
      name: 'db_mutate',
      description: 'Create, update, or delete records in the database. Use for any data modification. For sessions, this can create new sessions, update existing ones, or delete them. For plans, this can create or modify workout templates. For exercises, this can add new exercises to the catalog.',
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['create', 'update', 'delete'], description: 'Type of mutation' },
          table: { type: 'string', enum: ['sessions', 'sessionExercises', 'exercises', 'workoutPlans', 'recommendations', 'userPreferences', 'macroLogs', 'bodyWeightLogs'], description: 'Table to modify' },
          id: { type: 'number', description: 'Record ID (required for update/delete)' },
          data: { type: 'object', description: 'Data to write (for create/update). Shape depends on the table.' },
        },
        required: ['operation', 'table'],
      },
    },
  },

  compute: {
    type: 'function',
    function: {
      name: 'compute',
      description: 'Run analytical calculations on workout data. Use for progression analysis, volume tracking, plateau detection, and projections.',
      parameters: {
        type: 'object',
        properties: {
          formula: { type: 'string', enum: ['progression_rate', 'volume_trend', 'estimated_1rm', 'plateau_detect', 'projection', 'muscle_balance', 'frequency_check'], description: 'Analysis to run' },
          exercise: { type: 'string', description: 'Target exercise name (for single-exercise formulas)' },
          exercises: { type: 'array', items: { type: 'string' }, description: 'Multiple exercises (for comparative formulas like muscle_balance)' },
          weeks: { type: 'number', description: 'Number of weeks to analyze (default 4)' },
          data: { type: 'array', items: { type: 'object' }, description: 'Pre-fetched session data (from db_query). If not provided, the tool will fetch it.' },
        },
        required: ['formula'],
      },
    },
  },

  // Phase 4: Capability request
  request_capability: {
    type: 'function',
    function: {
      name: 'request_capability',
      description: 'File a request for new infrastructure or tools when you encounter a capability gap. Use this when you cannot complete a task with your available tools. This is expected and encouraged — it is how you grow.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short title for the capability request' },
          description: { type: 'string', description: 'What capability is needed and why' },
          problem: { type: 'string', description: 'What task was blocked' },
          blockedFeature: { type: 'string', description: 'What user-facing feature is blocked' },
          suggestedTools: { type: 'array', items: { type: 'string' }, description: 'Names of tools that would solve this' },
          priority: { type: 'string', enum: ['blocking', 'enhancement', 'nice_to_have'], description: 'How critical is this?' },
        },
        required: ['title', 'description', 'problem', 'blockedFeature', 'priority'],
      },
    },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Strip undefined values so Firestore doesn't reject the document. */
function cleanSets(sets: any[]): SetRecord[] {
  return sets.map((s) => {
    const record: any = {
      setNumber: s.setNumber,
      reps: s.reps,
      weight: s.weight,
      completed: s.completed !== false,
    };
    if (s.rpe !== undefined && s.rpe !== null) record.rpe = s.rpe;
    return record;
  });
}

// ─── Tool Handlers ─────────────────────────────────────────────────────────

const toolHandlers: Record<string, ToolHandler> = {

  async log_session(args, app) {
    let plan: { id?: string; name?: string } | null = args.planId ? { id: args.planId } : null;
    if (!plan && args.planName) plan = app.getPlanByName(args.planName);
    if (!plan) plan = app.getPlanForDay(new Date().getDay());

    const sessionId = await app.createSession({
      planId: plan?.id,
      planName: plan?.name ?? args.planName ?? 'Custom',
      date: new Date().toLocaleDateString('en-CA'),  // local date (YYYY-MM-DD)
      completedAt: new Date().toISOString(),
      feedback: args.feedback,
      sessionType: (args.sessionType ?? 'standard') as SessionType,
    });

    for (const ex of args.exercises || []) {
      const found = app.exercises.find((e) => e.name.toLowerCase() === ex.name.toLowerCase());
      const sets: SetRecord[] = cleanSets(ex.sets || []);

      await app.addSessionExercise({
        sessionId,
        exerciseId: found?.id ?? '',
        exerciseName: ex.name,
        sets,
      });

      // Check and update PR
      for (const set of sets) {
        await fb.checkAndUpdatePR(app.userId, found?.id ?? '', set.weight, set.reps, new Date().toLocaleDateString('en-CA'));
      }
    }

    await app.completeSession(sessionId, args.feedback);
    app.setActiveSessionId(null);
    await app.refreshSessions();

    const subNote = args.substitutions?.length
      ? ` (${args.substitutions.length} substitution${args.substitutions.length > 1 ? 's' : ''}: ${args.substitutions.map((s: any) => `${s.planned}→${s.actual}`).join(', ')})`
      : '';

    return {
      success: true,
      summary: `Session #${sessionId} logged as "${plan?.name ?? args.planName ?? 'Custom'}" with ${args.exercises?.length ?? 0} exercises${subNote}.`,
      data: { sessionId },
    };
  },

  async create_plan(args, app) {
    const exerciseIds = (args.exercises || []).map((e: { name: string; sets: number; reps: number }) => {
      const found = app.exercises.find((ex) => ex.name.toLowerCase() === e.name.toLowerCase());
      return { exerciseId: found?.id ?? '', targetSets: e.sets, targetReps: e.reps };
    });

    await app.createPlan({
      name: args.name,
      dayOfWeek: args.dayOfWeek,
      exercises: exerciseIds,
      createdAt: new Date().toISOString(),
    });
    return { success: true, summary: `Plan "${args.name}" created with ${exerciseIds.length} exercises.` };
  },

  async update_plan(args, app) {
    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.dayOfWeek !== undefined) updates.dayOfWeek = args.dayOfWeek;
    if (args.exercises && Array.isArray(args.exercises)) {
      updates.exercises = args.exercises.map((e: { name: string; sets: number; reps: number }) => {
        const found = app.exercises.find((ex) => ex.name.toLowerCase() === e.name.toLowerCase());
        return { exerciseId: found?.id ?? '', targetSets: e.sets, targetReps: e.reps };
      });
    }
    await app.updatePlan(args.planId, updates);
    return { success: true, summary: `Plan #${args.planId} updated.` };
  },

  async update_session(args, app) {
    const updates: any = {};
    if (args.feedback !== undefined) updates.feedback = args.feedback;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.sessionType !== undefined) updates.sessionType = args.sessionType;
    await app.updateSession(args.sessionId, updates);

    if (args.exercises && Array.isArray(args.exercises)) {
      // Delete existing exercises for this session
      const existing = await fb.getSessionExercises(app.userId, args.sessionId);
      await Promise.all(existing.map(e => fb.deleteSessionExerciseById(app.userId, e.id)));
      for (const ex of args.exercises) {
        const found = app.exercises.find((e) => e.name.toLowerCase() === ex.name.toLowerCase());
        const sets: SetRecord[] = cleanSets(ex.sets || []);
        await app.addSessionExercise({
          sessionId: args.sessionId,
          exerciseId: found?.id ?? '',
          exerciseName: ex.name,
          sets,
        });
      }
    }

    await app.refreshSessions();
    return { success: true, summary: `Session #${args.sessionId} updated.` };
  },

  async delete_session(args, app) {
    await app.deleteSession(args.sessionId);
    return { success: true, summary: `Session #${args.sessionId} deleted.` };
  },

  async add_exercise(args, app) {
    const category = (args.category || 'other') as MuscleGroup;
    const id = await app.addExercise(args.name, category, args.defaultSets, args.defaultReps);
    return { success: true, summary: `Exercise "${args.name}" added to catalog (ID #${id}).`, data: { id } };
  },

  async save_recommendation(args, app) {
    await fb.addRecommendation(app.userId, {
      sessionId: args.sessionId,
      type: args.type || 'general',
      exercise: args.exercise,
      message: args.message,
      action: args.action,
      acknowledged: false,
      createdAt: new Date().toISOString(),
    } as Recommendation);
    return { success: true, summary: `Recommendation saved: ${args.message?.slice(0, 50)}...` };
  },

  async query_sessions(args, app) {
    const sessions = await fb.getAllSessions(app.userId);
    const matching: any[] = [];

    for (const session of sessions) {
      let match = true;
      if (args.sessionType && session.sessionType !== args.sessionType) match = false;
      if (args.planName && session.planName?.toLowerCase() !== args.planName.toLowerCase()) match = false;
      if (args.dateFrom && session.date < args.dateFrom) match = false;
      if (args.dateTo && session.date > args.dateTo) match = false;

      if (args.exerciseName && match) {
        const exs = await fb.getSessionExercises(app.userId, session.id);
        if (!exs.some((e) => e.exerciseName.toLowerCase() === args.exerciseName.toLowerCase())) match = false;
      }

      if (match) matching.push(session);
    }

    const limit = args.limit || 20;
    const limited = matching.slice(0, limit);

    let text = `\n📊 Session History Query Results:\n`;
    if (args.exerciseName) text += `Filtered by exercise: "${args.exerciseName}"\n`;
    if (args.sessionType) text += `Filtered by type: ${args.sessionType}\n`;
    if (args.planName) text += `Filtered by plan: ${args.planName}\n`;
    text += `Found ${matching.length} matching sessions (showing ${limited.length}):\n`;

    for (const session of limited) {
      const exs = await fb.getSessionExercises(app.userId, session.id);
      const exSummary = exs.map((e) => {
        const setSummary = e.sets.map((s) => `${s.weight}lbs x ${s.reps}${s.completed ? '' : ' (FAILED)'}${s.rpe ? ` RPE${s.rpe}` : ''}`).join(', ');
        return `  - ${e.exerciseName}: ${setSummary}`;
      }).join('\n');
      const typeLabel = session.sessionType && session.sessionType !== 'standard' ? ` [${session.sessionType}]` : '';
      text += `\n${session.date} — ${session.planName || 'Session'}${typeLabel}${session.feedback ? ` (${session.feedback})` : ''}\n${exSummary || '  No exercises recorded'}\n`;
    }

    const queryResult: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'system',
      content: text,
      timestamp: Date.now(),
    };

    return {
      success: true,
      summary: `Found ${matching.length} matching sessions.`,
      data: { count: matching.length, sessions: limited },
      queryResults: [queryResult],
    };
  },

  async query_recommendations(args, app) {
    const allRecs = await fb.getAllRecommendations(app.userId, 100);
    const filtered = allRecs.filter((r) => {
      if (args.exercise && r.exercise?.toLowerCase() !== args.exercise.toLowerCase()) return false;
      if (args.type && r.type !== args.type) return false;
      if (args.acknowledged !== undefined && r.acknowledged !== args.acknowledged) return false;
      return true;
    });

    const limit = args.limit || 15;
    const limited = filtered.slice(0, limit);

    let text = `\n📋 Recommendation History:\n`;
    if (args.exercise) text += `Filtered by exercise: "${args.exercise}"\n`;
    if (args.type) text += `Filtered by type: ${args.type}\n`;
    text += `Found ${filtered.length} recommendations (showing ${limited.length}):\n`;

    for (const rec of limited) {
      const status = rec.acknowledged ? '✓' : '○';
      text += `\n${status} [${rec.type}] ${rec.exercise ? `(${rec.exercise}) ` : ''}${rec.message}\n`;
      if (rec.action) text += `  → Action: ${rec.action}\n`;
      text += `  Created: ${rec.createdAt}\n`;
    }

    const queryResult: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'system',
      content: text,
      timestamp: Date.now(),
    };

    return {
      success: true,
      summary: `Found ${filtered.length} recommendations.`,
      data: { count: filtered.length },
      queryResults: [queryResult],
    };
  },

  async get_rpe_trend(args, app) {
    const exerciseName = args.exerciseName;
    // Get all session exercises for the user
    const sessions = await fb.getAllSessions(app.userId);
    const matching: any[] = [];

    for (const session of sessions) {
      const exs = await fb.getSessionExercises(app.userId, session.id);
      const matched = exs.filter((se) => se.exerciseName.toLowerCase() === exerciseName.toLowerCase());
      for (const se of matched) {
        matching.push({ ...se, _sessionDate: session.date });
      }
    }

    if (matching.length === 0) {
      const queryResult: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: `\n📈 RPE Trend for "${exerciseName}": No data found.\n`,
        timestamp: Date.now(),
      };
      return { success: true, summary: `No RPE data for "${exerciseName}".`, queryResults: [queryResult] };
    }

    let text = `\n📈 RPE Trend Analysis for "${exerciseName}":\n`;
    let totalSets = 0;
    let rpeSum = 0;
    let rpeCount = 0;

    for (const se of matching) {
      const date = se._sessionDate ?? 'unknown';
      const setSummaries = se.sets.map((s: any) => {
        if (s.rpe !== undefined) { rpeSum += s.rpe; rpeCount++; }
        totalSets++;
        return `Set${s.setNumber}: ${s.weight}lbs x ${s.reps}${s.rpe ? ` @RPE${s.rpe}` : ''}${s.completed ? '' : ' (FAILED)'}`;
      }).join(', ');
      text += `\n${date} — ${se.exerciseName}: ${setSummaries}`;
    }

    const avgRpe = rpeCount > 0 ? (rpeSum / rpeCount).toFixed(1) : 'N/A';
    text += `\n\nSummary: ${matching.length} sessions, ${totalSets} total sets.\n`;
    text += `Average RPE: ${avgRpe} (across ${rpeCount} sets with RPE data).\n`;

    const queryResult: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'system',
      content: text,
      timestamp: Date.now(),
    };

    return {
      success: true,
      summary: `RPE trend for "${exerciseName}": avg RPE ${avgRpe} across ${matching.length} sessions.`,
      data: { avgRpe: parseFloat(avgRpe) || null, sessionCount: matching.length, totalSets },
      queryResults: [queryResult],
    };
  },

  // ─── Generic Primitive Handlers ────────────────────────────────────

  async db_query(args, app) {
    const table = args.table as string;
    const limit = args.limit || 50;
    const validTables = ['sessions', 'sessionExercises', 'exercises', 'workoutPlans', 'recommendations', 'userPreferences', 'capabilityRequests', 'macroLogs', 'bodyWeightLogs'];
    if (!validTables.includes(table)) {
      return { success: false, summary: `Invalid table: ${table}. Valid: ${validTables.join(', ')}` };
    }

    let results: any[] = [];

    if (table === 'sessions') {
      results = await fb.getAllSessions(app.userId);
      if (args.filters) {
        results = results.filter((r: any) => {
          for (const [key, val] of Object.entries(args.filters)) {
            if (r[key] != val) return false;
          }
          return true;
        });
      }
      if (args.dateFrom) results = results.filter((r: any) => r.date >= args.dateFrom);
      if (args.dateTo) results = results.filter((r: any) => r.date <= args.dateTo);
      results = results.slice(0, limit);

      if (args.join === 'sessionExercises') {
        for (const session of results) {
          session._exercises = await fb.getSessionExercises(app.userId, session.id);
        }
      }
    } else if (table === 'sessionExercises') {
      const sessions = await fb.getAllSessions(app.userId);
      let all: any[] = [];
      for (const session of sessions) {
        const exs = await fb.getSessionExercises(app.userId, session.id);
        for (const e of exs) all.push({ ...e, _sessionDate: session.date });
      }
      if (args.filters) {
        all = all.filter((r: any) => {
          for (const [key, val] of Object.entries(args.filters)) {
            if (key === 'exerciseName' && typeof val === 'string') {
              if (r.exerciseName.toLowerCase() !== val.toLowerCase()) return false;
            } else if (r[key] != val) return false;
          }
          return true;
        });
      }
      results = all.slice(0, limit);

      if (args.join === 'sessions') {
        for (const se of results) {
          se._session = await fb.getSessionById(app.userId, se.sessionId);
        }
      }
    } else if (table === 'exercises') {
      results = await fb.getAllExercises(app.userId);
      if (args.filters) {
        results = results.filter((r: any) => {
          for (const [key, val] of Object.entries(args.filters)) {
            if (r[key] != val) return false;
          }
          return true;
        });
      }
      results = results.slice(0, limit);
    } else if (table === 'workoutPlans') {
      results = await fb.getAllPlans(app.userId);
      if (args.filters) {
        results = results.filter((r: any) => {
          for (const [key, val] of Object.entries(args.filters)) {
            if (r[key] != val) return false;
          }
          return true;
        });
      }
      results = results.slice(0, limit);
    } else if (table === 'recommendations') {
      results = await fb.getAllRecommendations(app.userId, 100);
      if (args.filters) {
        results = results.filter((r: any) => {
          for (const [key, val] of Object.entries(args.filters)) {
            if (r[key] != val) return false;
          }
          return true;
        });
      }
      results = results.slice(0, limit);
    } else if (table === 'userPreferences') {
      results = await fb.getAllPreferences(app.userId);
      results = results.slice(0, limit);
    } else if (table === 'capabilityRequests') {
      results = await fb.getAllCapabilityRequests(app.userId);
      results = results.slice(0, limit);
    } else if (table === 'macroLogs') {
      if (args.dateFrom || args.dateTo) {
        results = await fb.getMacroLogsInRange(
          app.userId,
          args.dateFrom || '1970-01-01',
          args.dateTo || '2099-12-31',
        );
      } else {
        results = await fb.getAllMacroLogs(app.userId);
      }
      if (args.filters) {
        results = results.filter((r: any) => {
          for (const [key, val] of Object.entries(args.filters)) {
            if (r[key] != val) return false;
          }
          return true;
        });
      }
      results = results.slice(0, limit);
    } else if (table === 'bodyWeightLogs') {
      if (args.dateFrom || args.dateTo) {
        results = await fb.getWeightLogsInRange(
          app.userId,
          args.dateFrom || '1970-01-01',
          args.dateTo || '2099-12-31',
        );
      } else {
        results = await fb.getAllWeightLogs(app.userId);
      }
      if (args.filters) {
        results = results.filter((r: any) => {
          for (const [key, val] of Object.entries(args.filters)) {
            if (r[key] != val) return false;
          }
          return true;
        });
      }
      results = results.slice(0, limit);
    }

    // Format results for AI consumption
    const summary = `Queried ${table}: ${results.length} results${results.length >= limit ? ` (limited to ${limit})` : ''}.`;
    const resultText = `\n📊 Query Results (${table}, ${results.length} records):\n${JSON.stringify(results, null, 2).slice(0, 4000)}\n`;

    const queryResult: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'system',
      content: resultText,
      timestamp: Date.now(),
    };

    return {
      success: true,
      summary,
      data: { count: results.length, results },
      queryResults: [queryResult],
    };
  },

  async db_mutate(args, app) {
    const { operation, table, id, data } = args;

    const validTables = ['sessions', 'sessionExercises', 'exercises', 'workoutPlans', 'recommendations', 'userPreferences', 'macroLogs', 'bodyWeightLogs'];
    if (!validTables.includes(table)) {
      return { success: false, summary: `Invalid table: ${table}` };
    }

    if (operation === 'create') {
      if (table === 'sessions') {
        const sessionId = await app.createSession({
          planId: data?.planId,
          planName: data?.planName ?? 'Custom',
          date: data?.date ?? new Date().toLocaleDateString('en-CA'),
          completedAt: data?.completedAt,
          feedback: data?.feedback,
          notes: data?.notes,
          sessionType: data?.sessionType ?? 'standard',
        });
        // Add exercises if provided
        if (data?.exercises && Array.isArray(data.exercises)) {
          for (const ex of data.exercises) {
            await app.addSessionExercise({
              sessionId,
              exerciseId: ex.exerciseId ?? 0,
              exerciseName: ex.exerciseName ?? ex.name ?? 'Unknown',
              sets: ex.sets || [],
            });
          }
        }
        if (data?.completedAt) await app.completeSession(sessionId);
        await app.refreshSessions();
        return { success: true, summary: `Session #${sessionId} created.`, data: { id: sessionId } };
      } else if (table === 'exercises') {
        const exerciseId = await app.addExercise(data?.name, data?.category || 'other', data?.defaultSets, data?.defaultReps);
        return { success: true, summary: `Exercise "${data?.name}" created (ID #${exerciseId}).`, data: { id: exerciseId } };
      } else if (table === 'workoutPlans') {
        const exerciseIds = (data?.exercises || []).map((e: any) => ({
          exerciseId: e.exerciseId ?? (app.exercises.find((ex) => ex.name.toLowerCase() === (e.name || '').toLowerCase())?.id ?? 0),
          sets: e.sets || 3,
          reps: e.reps || 10,
        }));
        await app.createPlan({
          name: data?.name || 'New Plan',
          dayOfWeek: data?.dayOfWeek,
          exercises: exerciseIds,
          createdAt: new Date().toISOString(),
        });
        return { success: true, summary: `Plan "${data?.name}" created.` };
      } else if (table === 'recommendations') {
        await fb.addRecommendation(app.userId, {
          type: data?.type || 'general',
          exercise: data?.exercise,
          message: data?.message || '',
          action: data?.action,
          acknowledged: false,
          createdAt: new Date().toISOString(),
        } as Recommendation);
        return { success: true, summary: 'Recommendation saved.' };
      } else if (table === 'macroLogs') {
        const macroId = await fb.addMacroLog(app.userId, {
          date: data?.date ?? new Date().toLocaleDateString('en-CA'),
          description: data?.description || '',
          protein: data?.protein || 0,
          carbs: data?.carbs || 0,
          fat: data?.fat || 0,
          ...(data?.calories !== undefined ? { calories: data.calories } : {}),
          ...(data?.notes !== undefined ? { notes: data.notes } : {}),
        });
        return { success: true, summary: `Macro log #${macroId} created.`, data: { id: macroId } };
      } else if (table === 'bodyWeightLogs') {
        const weightId = await fb.addWeightLog(app.userId, {
          date: data?.date ?? new Date().toLocaleDateString('en-CA'),
          weight: data?.weight || 0,
          ...(data?.notes !== undefined ? { notes: data.notes } : {}),
        });
        return { success: true, summary: `Weight log #${weightId} created.`, data: { id: weightId } };
      }
      return { success: false, summary: `Create not supported for table: ${table}` };
    }

    if (operation === 'update') {
      if (!id && id !== 0) return { success: false, summary: 'id is required for update' };
      if (table === 'sessions') {
        await app.updateSession(id, data || {});
        await app.refreshSessions();
        return { success: true, summary: `Session #${id} updated.` };
      } else if (table === 'workoutPlans') {
        await app.updatePlan(id, data || {});
        return { success: true, summary: `Plan #${id} updated.` };
      } else if (table === 'recommendations') {
        await fb.acknowledgeRecommendation(app.userId, id);
        return { success: true, summary: `Recommendation #${id} updated.` };
      } else if (table === 'userPreferences') {
        // get key from the data, fallback to looking up existing
        const allPrefs = await fb.getAllPreferences(app.userId);
        const existing = allPrefs.find(p => p.id === id);
        if (existing) {
          await fb.setPreference(app.userId, existing.key, data?.value ?? '');
        }
        return { success: true, summary: `Preference updated.` };
      } else if (table === 'macroLogs') {
        await fb.updateMacroLog(app.userId, id, data || {});
        return { success: true, summary: `Macro log #${id} updated.` };
      } else if (table === 'bodyWeightLogs') {
        await fb.updateWeightLog(app.userId, id, data || {});
        return { success: true, summary: `Weight log #${id} updated.` };
      }
      return { success: false, summary: `Update not supported for table: ${table}` };
    }

    if (operation === 'delete') {
      if (!id && id !== 0) return { success: false, summary: 'id is required for delete' };
      if (table === 'sessions') {
        await app.deleteSession(id);
        return { success: true, summary: `Session #${id} deleted.` };
      } else if (table === 'sessionExercises') {
        const found = await fb.deleteSessionExerciseById(app.userId, id);
        return { success: found, summary: found ? `Session exercise #${id} deleted.` : `Session exercise #${id} not found.` };
      } else if (table === 'recommendations') {
        // Recommendations don't have a direct delete — acknowledge as workaround
        return { success: false, summary: 'Direct delete not supported for recommendations. Use update to acknowledge.' };
      } else if (table === 'macroLogs') {
        await fb.deleteMacroLog(app.userId, id);
        return { success: true, summary: `Macro log #${id} deleted.` };
      } else if (table === 'bodyWeightLogs') {
        await fb.deleteWeightLog(app.userId, id);
        return { success: true, summary: `Weight log #${id} deleted.` };
      }
      return { success: false, summary: `Delete not supported for table: ${table}` };
    }

    return { success: false, summary: `Unknown operation: ${operation}` };
  },

  async compute(args, app) {
    const formula = args.formula as string;
    const weeks = args.weeks || 4;

    // Auto-fetch data if not provided
    let sessionData = args.data;
    if (!sessionData) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - weeks * 7);
      const dateStr = cutoff.toISOString().split('T')[0];
      const sessions = await fb.getAllSessions(app.userId);
      const filtered = sessions.filter(s => s.date >= dateStr);
      sessionData = [];
      for (const s of filtered) {
        const exs = await fb.getSessionExercises(app.userId, s.id);
        sessionData.push({ date: s.date, planName: s.planName, sessionType: s.sessionType, exercises: exs });
      }
    }

    if (formula === 'progression_rate') {
      const exercise = args.exercise;
      if (!exercise) return { success: false, summary: 'exercise is required for progression_rate' };

      const dataPoints: { date: string; avgWeight: number; avgReps: number }[] = [];
      for (const s of sessionData) {
        const exs = (s.exercises || []).filter((e: any) =>
          (e.exerciseName || '').toLowerCase() === exercise.toLowerCase()
        );
        for (const e of exs) {
          const sets = e.sets || [];
          const avgW = sets.length > 0 ? sets.reduce((sum: number, st: any) => sum + (st.weight || 0), 0) / sets.length : 0;
          const avgR = sets.length > 0 ? sets.reduce((sum: number, st: any) => sum + (st.reps || 0), 0) / sets.length : 0;
          dataPoints.push({ date: s.date, avgWeight: Math.round(avgW), avgReps: Math.round(avgR * 10) / 10 });
        }
      }

      let summary = `\n📈 Progression Rate for "${exercise}" (${weeks} weeks):\n`;
      if (dataPoints.length < 2) {
        summary += 'Not enough data for trend analysis. Need at least 2 sessions.\n';
      } else {
        const first = dataPoints[0];
        const last = dataPoints[dataPoints.length - 1];
        const weightDelta = last.avgWeight - first.avgWeight;
        const sessionsPerWeek = dataPoints.length / weeks;
        summary += `Sessions: ${dataPoints.length} (${sessionsPerWeek.toFixed(1)}/week)\n`;
        summary += `Weight change: ${weightDelta > 0 ? '+' : ''}${weightDelta} lbs (${first.avgWeight} → ${last.avgWeight})\n`;
        summary += `Reps: ${first.avgReps} → ${last.avgReps}\n`;
        summary += `Weekly progression: ${(weightDelta / weeks).toFixed(1)} lbs/week\n`;
      }

      const queryResult: ChatMessage = { id: crypto.randomUUID(), role: 'system', content: summary, timestamp: Date.now() };
      return { success: true, summary: `Progression analyzed for "${exercise}".`, data: { dataPoints }, queryResults: [queryResult] };
    }

    if (formula === 'estimated_1rm') {
      const exercise = args.exercise;
      if (!exercise) return { success: false, summary: 'exercise is required for estimated_1rm' };

      let bestSet: { weight: number; reps: number } | null = null;
      for (const s of sessionData) {
        const exs = (s.exercises || []).filter((e: any) =>
          (e.exerciseName || '').toLowerCase() === exercise.toLowerCase()
        );
        for (const e of exs) {
          for (const set of e.sets || []) {
            if (!bestSet || (set.weight || 0) > bestSet.weight ||
                ((set.weight || 0) === bestSet.weight && (set.reps || 0) > bestSet.reps)) {
              bestSet = { weight: set.weight || 0, reps: set.reps || 0 };
            }
          }
        }
      }

      if (!bestSet || bestSet.weight === 0) {
        return { success: true, summary: `No data for "${exercise}" 1RM estimation.`, data: { estimated_1rm: null } };
      }

      // Epley formula
      const e1rm = bestSet.reps > 1
        ? Math.round(bestSet.weight * (1 + bestSet.reps / 30))
        : bestSet.weight;

      const resultText = `\n🏋️ Estimated 1RM for "${exercise}": ${e1rm} lbs (based on ${bestSet.weight}lbs × ${bestSet.reps})\n`;
      const queryResult: ChatMessage = { id: crypto.randomUUID(), role: 'system', content: resultText, timestamp: Date.now() };
      return { success: true, summary: `Estimated 1RM for "${exercise}": ${e1rm} lbs.`, data: { estimated_1rm: e1rm, bestSet }, queryResults: [queryResult] };
    }

    if (formula === 'plateau_detect') {
      const exercise = args.exercise;
      const results: { exercise: string; sessions: number; lastChange: string; weeksStalled: number }[] = [];

      const exercisesToCheck = exercise ? [exercise] : [...new Set(sessionData.flatMap((s: any) =>
        (s.exercises || []).map((e: any) => e.exerciseName)
      ))];

      for (const exName of exercisesToCheck) {
        const dataPoints: { date: string; weight: number }[] = [];
        for (const s of sessionData) {
          const exs = (s.exercises || []).filter((e: any) =>
            (e.exerciseName || '').toLowerCase() === exName.toLowerCase()
          );
          for (const e of exs) {
            const maxW = Math.max(...(e.sets || []).map((st: any) => st.weight || 0));
            dataPoints.push({ date: s.date, weight: maxW });
          }
        }
        // Check if weight hasn't changed for 3+ sessions
        if (dataPoints.length >= 3) {
          const uniqueWeights = new Set(dataPoints.map((d) => d.weight));
          if (uniqueWeights.size === 1) {
            results.push({
              exercise: exName,
              sessions: dataPoints.length,
              lastChange: 'No change',
              weeksStalled: Math.ceil(dataPoints.length / 2),
            });
          }
        }
      }

      const resultText = `\n🔍 Plateau Detection (${weeks} weeks):\n${results.length > 0
        ? results.map((r) => `  ⚠️ ${r.exercise}: ${r.sessions} sessions at same weight (~${r.weeksStalled} weeks)`).join('\n')
        : '  ✅ No plateaus detected. All exercises showing progression.\n'}\n`;

      const queryResult: ChatMessage = { id: crypto.randomUUID(), role: 'system', content: resultText, timestamp: Date.now() };
      return { success: true, summary: `Plateau check: ${results.length} stalled exercises.`, data: { plateaus: results }, queryResults: [queryResult] };
    }

    if (formula === 'muscle_balance') {
      const targetExercises = args.exercises || [];
      if (targetExercises.length < 2) return { success: false, summary: 'At least 2 exercises required for muscle_balance comparison' };

      const volumes: Record<string, number> = {};
      for (const exName of targetExercises) {
        let totalVol = 0;
        for (const s of sessionData) {
          const exs = (s.exercises || []).filter((e: any) =>
            (e.exerciseName || '').toLowerCase() === exName.toLowerCase()
          );
          for (const e of exs) {
            totalVol += (e.sets || []).reduce((sum: number, st: any) => sum + ((st.weight || 0) * (st.reps || 0)), 0);
          }
        }
        volumes[exName] = totalVol;
      }

      const entries = Object.entries(volumes);
      const maxVol = Math.max(...entries.map(([, v]) => v));
      const resultText = `\n⚖️ Muscle Balance (${weeks} weeks, total volume):\n${entries
        .map(([name, vol]) => `  ${name}: ${vol.toLocaleString()} lbs (${maxVol > 0 ? ((vol / maxVol) * 100).toFixed(0) : 0}% of max)`)
        .join('\n')}\n`;

      const queryResult: ChatMessage = { id: crypto.randomUUID(), role: 'system', content: resultText, timestamp: Date.now() };
      return { success: true, summary: `Muscle balance analyzed for ${targetExercises.length} exercises.`, data: { volumes }, queryResults: [queryResult] };
    }

    if (formula === 'weight_trend') {
      const weightLogs = await fb.getAllWeightLogs(app.userId);
      if (weightLogs.length === 0) {
        return { success: true, summary: 'No body weight data yet.', data: { entries: 0 } };
      }

      const latest = weightLogs[0];
      const first = weightLogs[weightLogs.length - 1];
      const delta = latest.weight - first.weight;
      const daysDiff = Math.max(1, (new Date(latest.date).getTime() - new Date(first.date).getTime()) / 86400000);
      const weeklyRate = (delta / daysDiff) * 7;

      const resultText = `\n⚖️ Weight Trend (${weightLogs.length} weigh-ins over ${Math.round(daysDiff)} days):\n` +
        `Current: ${latest.weight} lbs (${latest.date})\n` +
        `Starting: ${first.weight} lbs (${first.date})\n` +
        `Change: ${delta > 0 ? '+' : ''}${delta.toFixed(1)} lbs (${weeklyRate > 0 ? '+' : ''}${weeklyRate.toFixed(2)} lbs/week)\n` +
        weightLogs.slice(0, 10).map((w: any) => `  ${w.date}: ${w.weight} lbs`).join('\n') + '\n';

      const queryResult: ChatMessage = { id: crypto.randomUUID(), role: 'system', content: resultText, timestamp: Date.now() };
      return { success: true, summary: `Weight: ${latest.weight} lbs, ${weeklyRate.toFixed(1)} lbs/week.`, data: { latest, delta, weeklyRate, entries: weightLogs.length }, queryResults: [queryResult] };
    }

    if (formula === 'macro_averages') {
      const macroLogs = await fb.getAllMacroLogs(app.userId);
      if (macroLogs.length === 0) {
        return { success: true, summary: 'No macro data yet.', data: { entries: 0 } };
      }

      const recentDays = Math.min(weeks * 7, macroLogs.length);
      const batch = macroLogs.slice(0, recentDays);
      const avgProtein = Math.round(batch.reduce((s: number, m: any) => s + m.protein, 0) / batch.length);
      const avgCarbs = Math.round(batch.reduce((s: number, m: any) => s + m.carbs, 0) / batch.length);
      const avgFat = Math.round(batch.reduce((s: number, m: any) => s + m.fat, 0) / batch.length);
      const avgCals = Math.round(batch.reduce((s: number, m: any) => s + (m.calories || m.protein*4 + m.carbs*4 + m.fat*9), 0) / batch.length);

      const resultText = `\n🍽️ Macro Averages (last ${batch.length} days):\n` +
        `Protein: ${avgProtein}g | Carbs: ${avgCarbs}g | Fat: ${avgFat}g\n` +
        `Calories: ~${avgCals} kcal/day\n` +
        `Total days logged: ${macroLogs.length}\n`;

      const queryResult: ChatMessage = { id: crypto.randomUUID(), role: 'system', content: resultText, timestamp: Date.now() };
      return { success: true, summary: `${avgProtein}g P / ${avgCarbs}g C / ${avgFat}g F (${avgCals} kcal).`, data: { avgProtein, avgCarbs, avgFat, avgCals, entries: macroLogs.length }, queryResults: [queryResult] };
    }

    // Generic fallback for other formulas
    return { success: true, summary: `Computed "${formula}" — basic analysis complete.`, data: { sessionCount: sessionData.length } };
  },

  // ─── Body & Nutrition Handlers ────────────────────────────────────

  async log_bodyweight(args, app) {
    const date = args.date || new Date().toLocaleDateString('en-CA');
    await fb.addWeightLog(app.userId, {
      date,
      weight: args.weight,
      ...(args.notes !== undefined ? { notes: args.notes } : {}),
    });
    return { success: true, summary: `Body weight logged: ${args.weight} lbs on ${date}.` };
  },

  async log_macros(args, app) {
    const date = args.date || new Date().toLocaleDateString('en-CA');
    const calories = args.calories ?? Math.round(args.protein * 4 + args.carbs * 4 + args.fat * 9);
    await fb.addMacroLog(app.userId, {
      date,
      description: args.description || 'Logged via AI',
      protein: args.protein,
      carbs: args.carbs,
      fat: args.fat,
      calories,
      ...(args.notes !== undefined ? { notes: args.notes } : {}),
    });
    return { success: true, summary: `Macros logged for ${date}: ${args.protein}g P / ${args.carbs}g C / ${args.fat}g F (${calories} kcal).` };
  },

  async update_macros(args, app) {
    const updates: Record<string, any> = {};
    if (args.description !== undefined) updates.description = args.description;
    if (args.protein !== undefined) updates.protein = args.protein;
    if (args.carbs !== undefined) updates.carbs = args.carbs;
    if (args.fat !== undefined) updates.fat = args.fat;
    if (args.calories !== undefined) updates.calories = args.calories;
    if (args.date !== undefined) updates.date = args.date;
    if (args.notes !== undefined) updates.notes = args.notes;

    if (Object.keys(updates).length === 0) {
      return { success: false, summary: 'No fields provided to update.' };
    }

    await fb.updateMacroLog(app.userId, args.id, updates);
    const changed = Object.keys(updates).join(', ');
    return { success: true, summary: `Macro log #${args.id} updated (${changed}).` };
  },

  async query_macros(args, app) {
    let logs: any[];
    if (args.dateFrom || args.dateTo) {
      logs = await fb.getMacroLogsInRange(
        app.userId,
        args.dateFrom || '1970-01-01',
        args.dateTo || '2099-12-31',
      );
    } else {
      logs = await fb.getAllMacroLogs(app.userId);
    }

    const limit = args.limit || 20;
    const limited = logs.slice(0, limit);

    let text = `\n🍽️ Macro Log Query Results:\n`;
    if (args.dateFrom || args.dateTo) text += `Date range: ${args.dateFrom || 'any'} → ${args.dateTo || 'any'}\n`;
    text += `Found ${logs.length} entries (showing ${limited.length}):\n`;

    for (const log of limited) {
      const cals = log.calories ?? Math.round(log.protein * 4 + log.carbs * 4 + log.fat * 9);
      text += `\n[${log.id}] ${log.date} — ${log.description || '(no description)'}\n`;
      text += `  ${log.protein}g P / ${log.carbs}g C / ${log.fat}g F (${cals} kcal)\n`;
      if (log.notes) text += `  Notes: ${log.notes}\n`;
    }

    const queryResult: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'system',
      content: text,
      timestamp: Date.now(),
    };

    return {
      success: true,
      summary: `Found ${logs.length} macro entries.`,
      data: { count: logs.length, entries: limited },
      queryResults: [queryResult],
    };
  },

  async request_capability(args, app) {
    const id = crypto.randomUUID();
    await fb.addCapabilityRequest(app.userId, {
      id,
      title: args.title,
      description: args.description,
      problem: args.problem,
      blockedFeature: args.blockedFeature,
      suggestedTools: args.suggestedTools || [],
      priority: args.priority || 'enhancement',
      conversationContext: '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    } as any);

    return {
      success: true,
      summary: `Capability request filed: "${args.title}". Review in Settings.`,
      data: { id },
    };
  },
};

// ─── Registry Public API ──────────────────────────────────────────────────

/** Get all tool definitions suitable for the DeepSeek API `tools` array. */
export function getToolDefinitions(): ToolDefinition[] {
  return Object.values(toolDefinitions);
}

/** Execute a tool by name with parsed arguments. */
export async function executeToolCall(
  toolCall: ToolCall,
  app: ToolAppContext
): Promise<ToolResult> {
  const name = toolCall.function.name;
  const handler = toolHandlers[name];

  if (!handler) {
    return {
      tool_call_id: toolCall.id,
      role: 'tool',
      content: JSON.stringify({ success: false, summary: `Unknown tool: ${name}` }),
    };
  }

  let args: Record<string, any>;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch {
    return {
      tool_call_id: toolCall.id,
      role: 'tool',
      content: JSON.stringify({ success: false, summary: 'Invalid tool arguments JSON.' }),
    };
  }

  try {
    const result = await handler(args, app);
    return {
      tool_call_id: toolCall.id,
      role: 'tool',
      content: JSON.stringify({
        success: result.success,
        summary: result.summary,
        data: result.data,
        ...(result.queryResults ? { _queryResults: result.queryResults } : {}),
      }),
    };
  } catch (err: any) {
    return {
      tool_call_id: toolCall.id,
      role: 'tool',
      content: JSON.stringify({ success: false, summary: `Error: ${err.message}` }),
    };
  }
}

/** Extract query results from tool result JSON for injection into message array. */
export function extractQueryResults(toolResult: ToolResult): ChatMessage[] {
  try {
    const parsed = JSON.parse(toolResult.content);
    if (parsed._queryResults && Array.isArray(parsed._queryResults)) {
      return parsed._queryResults;
    }
  } catch { /* ignore */ }
  return [];
}

/** Extract ActionResult from tool result for UI display. */
export function toActionResult(toolCall: ToolCall, toolResult: ToolResult): ActionResult {
  try {
    const parsed = JSON.parse(toolResult.content);
    return {
      type: toolCall.function.name,
      success: parsed.success ?? false,
      summary: parsed.summary ?? '',
    };
  } catch {
    return { type: toolCall.function.name, success: false, summary: 'Failed to parse result.' };
  }
}
