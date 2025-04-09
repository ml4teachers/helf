import { SupabaseClient } from '@supabase/supabase-js';
import { Database, UserPlan, UserSession, UserExerciseEntry, UserExerciseSet } from '../types';

// Type for getUserTrainingData response
export type UserTrainingData = {
  recentWorkouts: {
    id: number;
    date: string;
    name: string;
    exercises: {
      name: string;
      type: string;
      details?: string;
      sets: {
        weight?: number;
        reps?: number;
        rpe?: number | null;
        completed: boolean;
      }[];
      notes?: string;
    }[];
  }[];
  bodyweightLogs: {
    date: string;
    weight: number;
  }[];
  currentTrainingPlan: {
    id: number;
    name: string;
    description?: string;
    goal?: string;
    currentWeek: number;
  } | null;
}

/**
 * Fetch all training data for a user
 */
export async function getUserTrainingData(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UserTrainingData> {
  // 1. Get recent user sessions
  const { data: sessions, error: sessionError } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (sessionError) {
    console.error('Error fetching user sessions:', sessionError);
    throw new Error('Failed to fetch user sessions');
  }

  // 2. Get exercise entries and sets for each session
  const recentWorkouts = await Promise.all(
    (sessions || []).map(async (session) => {
      const { data: exerciseEntries, error: entriesError } = await supabase
        .from('user_exercise_entries')
        .select(`
          *,
          exercises(*),
          user_exercise_sets(*)
        `)
        .eq('session_id', session.id)
        .order('exercise_order');

      if (entriesError) {
        console.error('Error fetching exercise entries:', entriesError);
        return {
          id: session.id,
          date: session.completed_date || session.scheduled_date || 'Unknown date',
          name: session.name,
          exercises: [] as {
            name: string;
            type: string;
            details?: string;
            sets: { weight?: number; reps?: number; rpe?: number | null; completed: boolean }[];
            notes?: string;
          }[],
        };
      }

      // Format exercise entries with their sets
      const exercises = exerciseEntries?.map(entry => {
        const exercise = entry.exercises as any;
        const sets = (entry.user_exercise_sets || []) as UserExerciseSet[];
        
        return {
          name: exercise?.name || 'Unknown Exercise',
          type: exercise?.type || 'RPE',
          details: exercise?.details || undefined,
          sets: sets.map(set => ({
            weight: set.weight || undefined,
            reps: set.reps || undefined,
            rpe: set.rpe || null,
            completed: set.completed
          })),
          notes: entry.notes || undefined,
        };
      }) || [];

      return {
        id: session.id,
        date: session.completed_date || session.scheduled_date || 'Unknown date',
        name: session.name,
        exercises,
      };
    })
  );

  // 3. Get bodyweight logs
  const { data: bodyweightLogs, error: bodyweightError } = await supabase
    .from('bodyweight_logs')
    .select('*')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .limit(10);

  if (bodyweightError) {
    console.error('Error fetching bodyweight logs:', bodyweightError);
    throw new Error('Failed to fetch bodyweight logs');
  }

  // 4. Get current training plan
  const { data: userPlan, error: planError } = await supabase
    .from('user_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (planError && planError.code !== 'PGRST116') {
    // PGRST116 is the error code for "no rows returned"
    console.error('Error fetching user plan:', planError);
  }

  const currentTrainingPlan = userPlan
    ? {
        id: userPlan.id,
        name: userPlan.name,
        description: userPlan.description,
        goal: userPlan.goal,
        currentWeek: calculateCurrentWeek(userPlan),
      }
    : null;

  return {
    recentWorkouts,
    bodyweightLogs: (bodyweightLogs || []).map((log) => ({
      date: log.log_date,
      weight: log.weight,
    })),
    currentTrainingPlan,
  };
}

/**
 * Helper function to calculate current week of a plan
 */
function calculateCurrentWeek(plan: UserPlan): number {
  // Get plan start date from metadata if available
  const metadata = plan.metadata as Record<string, any> || {};
  const startDate = metadata.start_date || plan.created_at;
  
  if (!startDate) return 1;
  
  // Calculate weeks since start date
  const weeksSinceStart = Math.ceil(
    (new Date().getTime() - new Date(startDate).getTime()) /
      (7 * 24 * 60 * 60 * 1000)
  );
  
  return weeksSinceStart > 0 ? weeksSinceStart : 1;
}