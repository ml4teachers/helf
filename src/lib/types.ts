// Database types for Supabase
export type User = {
  id: string
  email: string
  name?: string
  created_at: string
  updated_at: string
  preferred_ai_model?: 'gpt-4o-mini' | 'gpt-4o'
}

export type Exercise = {
  id: number
  name: string
  variation?: string
  type?: string
  description?: string
  created_at: string
  updated_at: string
}

// User Plan type for training plans
export type UserPlan = {
  id: number
  user_id: string
  name: string
  description?: string
  goal?: string
  status?: string // 'active', 'completed', 'archived'
  source?: string // 'assistant', 'manual', 'imported'
  metadata?: Record<string, unknown> // Flexible JSON data
  created_at: string
  updated_at: string
}

// User Plan Week type for weekly blocks
export type UserPlanWeek = {
  id: number
  plan_id: number
  week_number: number
  focus?: string // e.g., 'volume', 'intensity', 'deload'
  instructions?: string
  created_at: string
  updated_at: string
}

// User Session type for individual workouts
export type UserSession = {
  id: number
  user_id: string
  plan_id?: number
  plan_week_id?: number
  name: string
  type?: string // e.g., 'strength', 'hypertrophy', 'endurance'
  scheduled_date?: string
  completed_date?: string
  status: string // 'planned', 'in_progress', 'completed', 'skipped'
  readiness_score?: number
  instructions?: string
  notes?: string
  session_order?: number
  duration_minutes?: number
  created_at: string
  updated_at: string
}

// User Exercise Entry type for exercises within a session
export type UserExerciseEntry = {
  id: number
  session_id: number
  exercise_id: number
  exercise_order: number
  instructions?: string
  notes?: string
  target_sets?: number
  target_reps?: string
  target_rpe?: number
  target_weight?: string
  created_at: string
  updated_at: string
}

// User Exercise Set type for individual sets
export type UserExerciseSet = {
  id: number
  exercise_entry_id: number
  set_number: number
  weight?: number
  reps?: number
  rpe?: number
  completed: boolean
  notes?: string
  created_at: string
  updated_at: string
}

// User Assistant Memory type for personalization
export type UserAssistantMemory = {
  id: number
  user_id: string
  memory_type: string // 'preference', 'injury', 'goal', etc.
  content: string
  active: boolean
  created_at: string
  updated_at: string
}

// Original types that remain unchanged
export type BodyweightLog = {
  id: number
  user_id: string
  weight: number
  log_date: string
  created_at: string
  updated_at: string
}

export type FoodLog = {
  id: number
  user_id: string
  log_date: string
  log_time?: string
  carbs?: number
  proteins?: number
  fats?: number
  kcal?: number
  notes?: string
  created_at: string
  updated_at: string
}

// UI Exercise type with extended properties
export type UIExercise = {
  id: number
  name: string
  type: string
  variation?: string
  sets: {
    id: number
    set_number: number
    weight?: number
    reps?: number
    rpe?: number | null
    completed: boolean
  }[]
  instructions?: string
  notes?: string
  description?: string
  exercise_order: number
  target_sets?: number
  target_reps?: string
  target_rpe?: number | null
  target_weight?: string
}

// Combined type for UI display with all exercise information
export type UISessionExercise = UIExercise & {
  entry_id: number
  session_id: number
}

// Database interfaces for Supabase
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'created_at' | 'updated_at'> & { id: string }
        Update: Partial<Omit<User, 'created_at' | 'updated_at'>>
      }
      exercises: {
        Row: Exercise
        Insert: Omit<Exercise, 'created_at' | 'updated_at' | 'id'>
        Update: Partial<Omit<Exercise, 'created_at' | 'updated_at' | 'id'>>
      }
      bodyweight_logs: {
        Row: BodyweightLog
        Insert: Omit<BodyweightLog, 'created_at' | 'updated_at' | 'id'>
        Update: Partial<Omit<BodyweightLog, 'created_at' | 'updated_at' | 'id'>>
      }
      food_logs: {
        Row: FoodLog
        Insert: Omit<FoodLog, 'created_at' | 'updated_at' | 'id'>
        Update: Partial<Omit<FoodLog, 'created_at' | 'updated_at' | 'id'>>
      }
      // New tables for the refactored schema
      user_plans: {
        Row: UserPlan
        Insert: Omit<UserPlan, 'created_at' | 'updated_at' | 'id'>
        Update: Partial<Omit<UserPlan, 'created_at' | 'updated_at' | 'id'>>
      }
      user_plan_weeks: {
        Row: UserPlanWeek
        Insert: Omit<UserPlanWeek, 'created_at' | 'updated_at' | 'id'>
        Update: Partial<Omit<UserPlanWeek, 'created_at' | 'updated_at' | 'id'>>
      }
      user_sessions: {
        Row: UserSession
        Insert: Omit<UserSession, 'created_at' | 'updated_at' | 'id'>
        Update: Partial<Omit<UserSession, 'created_at' | 'updated_at' | 'id'>>
      }
      user_exercise_entries: {
        Row: UserExerciseEntry
        Insert: Omit<UserExerciseEntry, 'created_at' | 'updated_at' | 'id'>
        Update: Partial<Omit<UserExerciseEntry, 'created_at' | 'updated_at' | 'id'>>
      }
      user_exercise_sets: {
        Row: UserExerciseSet
        Insert: Omit<UserExerciseSet, 'created_at' | 'updated_at' | 'id'>
        Update: Partial<Omit<UserExerciseSet, 'created_at' | 'updated_at' | 'id'>>
      }
      user_assistant_memories: {
        Row: UserAssistantMemory
        Insert: Omit<UserAssistantMemory, 'created_at' | 'updated_at' | 'id'>
        Update: Partial<Omit<UserAssistantMemory, 'created_at' | 'updated_at' | 'id'>>
      }
      // Keep references to old tables for migration purposes
      session_logs: {
        Row: {
          id: number
          user_id: string
          session_date: string
          session_time?: string
          readiness_squat?: number
          readiness_bench?: number
          readiness_deadlift?: number
          session_notes?: string
          session_name?: string
          status?: 'next' | 'started' | 'finished' | 'skipped'
          training_session_template_id?: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<SessionLog, 'created_at' | 'updated_at' | 'id'>
        Update: Partial<Omit<SessionLog, 'created_at' | 'updated_at' | 'id'>>
      }
      exercise_logs: {
        Row: {
          id: number
          session_log_id: number
          exercise_id: number
          log_date: string
          log_time?: string
          weight: number
          reps: number
          rpe?: number
          notes?: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<ExerciseLog, 'created_at' | 'updated_at' | 'id'>
        Update: Partial<Omit<ExerciseLog, 'created_at' | 'updated_at' | 'id'>>
      }
    }
  }
}

// Old types kept for backward compatibility during migration
export type SessionLog = {
  id: number
  user_id: string
  session_date: string
  session_time?: string
  readiness_squat?: number
  readiness_bench?: number
  readiness_deadlift?: number
  session_notes?: string
  session_name?: string
  status?: 'next' | 'started' | 'finished' | 'skipped'
  training_session_template_id?: number
  created_at: string
  updated_at: string
}

export type ExerciseLog = {
  id: number
  session_log_id: number
  exercise_id: number
  log_date: string
  log_time?: string
  weight: number
  reps: number
  rpe?: number
  notes?: string
  created_at: string
  updated_at: string
}

// Additional helper type for session creation
export type SessionCreate = Omit<UserSession, 'id' | 'created_at' | 'updated_at'> & {
  exercises?: Array<{
    exercise_id: number
    exercise_order: number
    instructions?: string
    notes?: string
    target_sets?: number
    target_reps?: string
    target_rpe?: number | null
    target_weight?: string
    sets?: Array<{
      set_number: number
      weight?: number
      reps?: number
      rpe?: number | null
      completed?: boolean
      notes?: string
    }>
  }>
}

// Assistant generated plan types
export type AssistantPlan = {
  name: string
  description?: string
  goal?: string
  weeks: AssistantPlanWeek[]
  metadata?: Record<string, unknown>
}

export type AssistantPlanWeek = {
  week_number: number
  focus?: string
  instructions?: string
  notes?: string;
  sessions: AssistantSession[]
}

export type AssistantSession = {
  name: string
  type?: string
  instructions?: string
  notes?: string
  exercises: AssistantExercise[]
  session_order?: number
}

export type AssistantExercise = {
  name: string
  variation?: string
  exercise_order: number
  target_sets?: number
  target_reps?: string
  target_rpe?: number | null
  target_weight?: string
  instructions?: string
  notes?: string
}