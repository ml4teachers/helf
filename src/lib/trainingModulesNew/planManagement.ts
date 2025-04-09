import { SupabaseClient } from '@supabase/supabase-js';
import { Database, UserPlan, UserPlanWeek, UserSession, AssistantPlan, AssistantPlanWeek, AssistantSession, AssistantExercise } from '../types';
import { findOrCreateExercise } from './exerciseManagement';

/**
 * Create a new training plan for a user
 */
export async function createTrainingPlan(
  supabase: SupabaseClient<Database>,
  userId: string,
  planData: AssistantPlan
) {
  console.log(`Creating new training plan "${planData.name}" with ${planData.weeks.length} weeks`);
  
  // 1. Create the user plan
  const { data: userPlan, error: planError } = await supabase
    .from('user_plans')
    .insert({
      user_id: userId,
      name: planData.name,
      description: planData.description || '',
      goal: planData.goal || '',
      status: 'active',
      source: 'assistant',
      metadata: planData.metadata || { 
        start_date: new Date().toISOString() 
      }
    })
    .select()
    .single();

  if (planError) {
    console.error('Error creating user plan:', planError);
    throw new Error('Failed to create training plan');
  }

  console.log(`Created user plan with ID ${userPlan.id}`);

  // 2. Create plan weeks
  for (const weekData of planData.weeks) {
    const { data: planWeek, error: weekError } = await supabase
      .from('user_plan_weeks')
      .insert({
        plan_id: userPlan.id,
        week_number: weekData.week_number,
        focus: weekData.focus || '',
        instructions: weekData.instructions || ''
      })
      .select()
      .single();

    if (weekError) {
      console.error(`Error creating week ${weekData.week_number}:`, weekError);
      continue;
    }

    console.log(`Created week ${weekData.week_number} with ID ${planWeek.id}`);

    // Skip creating sessions in the initial plan creation
    // They will be created properly in the weekPlan step
    console.log(`Skipping session creation for week ${weekData.week_number}. Sessions will be created in weekPlan step.`);
  }

  // Since we don't create sessions in the first step anymore, we can skip setting the first session as "planned"
  console.log(`Sessions will be created and status will be set during weekPlan step.`);

  // 5. Deactivate any previously active plans
  const { error: deactivateError } = await supabase
    .from('user_plans')
    .update({ status: 'archived' })
    .eq('user_id', userId)
    .neq('id', userPlan.id)
    .eq('status', 'active');

  if (deactivateError) {
    console.error('Error deactivating previous plans:', deactivateError);
  } else {
    console.log('Previous active plans have been archived');
  }

  return {
    planId: userPlan.id,
    message: `Training plan "${planData.name}" created successfully`
  };
}

/**
 * Helper function to create a session from a template
 */
export async function createSessionFromTemplate(
  supabase: SupabaseClient<Database>,
  userId: string,
  planId: number,
  weekId: number,
  weekData: AssistantPlanWeek,
  sessionData: AssistantSession,
  sessionOrder: number
) {
  // Calculate scheduled date for the session based on week and session order
  // We're intentionally not assigning specific weekdays to make scheduling more flexible
  // For week 1, we'll start from today; for later weeks, offset by week number
  const today = new Date();
  const weekOffset = (weekData.week_number - 1) * 7; // Offset days for weeks beyond week 1
  const sessionDate = new Date(today);
  sessionDate.setDate(today.getDate() + weekOffset); // Offset for week number
  
  // Create the session
  const { data: session, error: sessionError } = await supabase
    .from('user_sessions')
    .insert({
      user_id: userId,
      plan_id: planId,
      plan_week_id: weekId,
      name: sessionData.name,
      type: sessionData.type || 'strength',
      scheduled_date: sessionDate.toISOString().split('T')[0],
      status: 'upcoming', // Default status
      instructions: sessionData.instructions || '',
      notes: sessionData.notes || '',
      session_order: sessionData.session_order || sessionOrder
    })
    .select()
    .single();

  if (sessionError) {
    console.error('Error creating session:', sessionError);
    return null;
  }

  console.log(`Created session "${sessionData.name}" with ID ${session.id}`);

  // Create exercise entries for this session
  for (const [exerciseIndex, exerciseData] of sessionData.exercises.entries()) {
    // Find or create exercise
    const exerciseId = await findOrCreateExercise(supabase, {
      name: exerciseData.name,
      variation: exerciseData.variation
    });

    // Create exercise entry
    const { data: entry, error: entryError } = await supabase
      .from('user_exercise_entries')
      .insert({
        session_id: session.id,
        exercise_id: exerciseId,
        exercise_order: exerciseData.exercise_order || exerciseIndex + 1,
        instructions: exerciseData.instructions || '',
        notes: exerciseData.notes || '',
        target_sets: exerciseData.target_sets,
        target_reps: exerciseData.target_reps,
        target_rpe: exerciseData.target_rpe,
        target_weight: exerciseData.target_weight
      })
      .select()
      .single();

    if (entryError) {
      console.error(`Error creating exercise entry for ${exerciseData.name}:`, entryError);
      continue;
    }

    console.log(`Added exercise "${exerciseData.name}" to session ${session.id}`);

    // Create empty sets if target_sets is provided
    if (exerciseData.target_sets && exerciseData.target_sets > 0) {
      const setsToCreate = [];
      
      for (let i = 1; i <= exerciseData.target_sets; i++) {
        setsToCreate.push({
          exercise_entry_id: entry.id,
          set_number: i,
          completed: false
        });
      }
      
      const { error: setsError } = await supabase
        .from('user_exercise_sets')
        .insert(setsToCreate);
        
      if (setsError) {
        console.error(`Error creating sets for ${exerciseData.name}:`, setsError);
      } else {
        console.log(`Created ${setsToCreate.length} empty sets for ${exerciseData.name}`);
      }
    }
  }

  return session;
}

/**
 * Get a user's training plan
 */
export async function getUserTrainingPlan(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  // 1. Get the user's active plan
  const { data: userPlan, error: planError } = await supabase
    .from('user_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (planError && planError.code !== 'PGRST116') {
    console.error('Error fetching user plan:', planError);
    throw new Error('Failed to fetch user plan');
  }

  if (!userPlan) {
    return null;
  }

  console.log(`Found active plan: ${userPlan.name} (ID: ${userPlan.id})`);

  // 2. Get plan weeks
  const { data: planWeeks, error: weeksError } = await supabase
    .from('user_plan_weeks')
    .select('*')
    .eq('plan_id', userPlan.id)
    .order('week_number', { ascending: true });

  if (weeksError) {
    console.error('Error fetching plan weeks:', weeksError);
    throw new Error('Failed to fetch plan weeks');
  }

  console.log(`Found ${planWeeks?.length || 0} weeks for plan ${userPlan.id}`);

  // 3. Get sessions for each week
  const weeks = await Promise.all(
    (planWeeks || []).map(async (week) => {
      const { data: weekSessions, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('plan_week_id', week.id)
        .order('session_order', { ascending: true });

      if (sessionsError) {
        console.error(`Error fetching sessions for week ${week.week_number}:`, sessionsError);
        return {
          id: week.id,
          weekNumber: week.week_number,
          focus: week.focus,
          notes: week.notes,
          sessions: []
        };
      }

      // Format sessions
      const sessions = await Promise.all((weekSessions || []).map(async session => {
        // Get exercise entries for this session
        const { data: exercises, error: exercisesError } = await supabase
          .from('user_exercise_entries')
          .select(`
            id,
            exercise_id,
            exercise_order,
            instructions,
            notes,
            target_sets,
            target_reps,
            target_rpe,
            target_weight,
            exercises(id, name, type, variation)
          `)
          .eq('session_id', session.id)
          .order('exercise_order');
          
        if (exercisesError) {
          console.error(`Error fetching exercises for session ${session.id}:`, exercisesError);
          console.error('Error details:', exercisesError.message, exercisesError.details);
        }
        
        // Format exercises with their basic info
        const formattedExercises = exercises?.map(entry => {
          const exercise = entry.exercises as any;
          
          // Log exercise data for debugging
          console.log(`Exercise entry: ID=${entry.id}, exercise_id=${entry.exercise_id}, name=${exercise?.name || 'Unknown'}`);
          
          return {
            id: exercise?.id,
            name: exercise?.name || 'Unknown Exercise',
            type: exercise?.type,
            variation: exercise?.variation,
            exercise_order: entry.exercise_order,
            target_sets: entry.target_sets,
            target_reps: entry.target_reps,
            target_rpe: entry.target_rpe,
            target_weight: entry.target_weight
          };
        }) || [];
        
        return {
          id: session.id,
          name: session.name,
          type: session.type,
          scheduled_date: session.scheduled_date,
          status: session.status,
          instructions: session.instructions,
          notes: session.notes,
          session_order: session.session_order,
          mesocycle: week.week_number, // Add the week number as mesocycle for backward compatibility
          week_number: week.week_number, // Add the week number directly
          exercises: formattedExercises
        };
      }));

      return {
        id: week.id,
        weekNumber: week.week_number,
        focus: week.focus,
        instructions: week.instructions,
        sessions
      };
    })
  );
  
  // Create a sessionsByWeek map for easier access in the UI
  const sessionsByWeek: Record<number, any[]> = {};
  weeks.forEach(week => {
    sessionsByWeek[week.weekNumber] = week.sessions;
  });

  // 4. Get all plan sessions (flat list)
  const { data: allSessions, error: allSessionsError } = await supabase
    .from('user_sessions')
    .select(`
      id,
      name,
      type,
      scheduled_date,
      completed_date,
      status,
      instructions,
      notes,
      session_order,
      plan_week_id,
      readiness_score
    `)
    .eq('plan_id', userPlan.id)
    .order('session_order', { ascending: true });

  if (allSessionsError) {
    console.error('Error fetching all plan sessions:', allSessionsError);
    throw new Error('Failed to fetch plan sessions');
  }
  
  // 5. For each session in allSessions, fetch its exercises
  const sessionsWithExercises = await Promise.all((allSessions || []).map(async session => {
    // Get the week number from the plan weeks
    const sessionWeek = planWeeks.find(week => week.id === session.plan_week_id);
    const weekNumber = sessionWeek ? sessionWeek.week_number : null;
    
    // Get exercise entries for this session - include exercise sets for completed sessions
    const isCompletedSession = session.status === 'completed' || session.completed_date;
    
    // Using a different query based on whether we need the sets or not
    let exercises, exercisesError;
    
    if (isCompletedSession) {
      // For completed sessions, fetch exercise entries with their sets
      const result = await supabase
        .from('user_exercise_entries')
        .select(`
          id,
          exercise_id,
          exercise_order,
          instructions,
          notes,
          target_sets,
          target_reps,
          target_rpe,
          target_weight,
          exercises(id, name, type, variation),
          user_exercise_sets(*)
        `)
        .eq('session_id', session.id)
        .order('exercise_order');
        
      exercises = result.data;
      exercisesError = result.error;
    } else {
      // For planned/upcoming sessions, just fetch basic exercise info
      const result = await supabase
        .from('user_exercise_entries')
        .select(`
          id,
          exercise_id,
          exercise_order,
          instructions,
          notes,
          target_sets,
          target_reps,
          target_rpe,
          target_weight,
          exercises(id, name, type, variation)
        `)
        .eq('session_id', session.id)
        .order('exercise_order');
        
      exercises = result.data;
      exercisesError = result.error;
    }
      
    if (exercisesError) {
      console.error(`Error fetching exercises for session ${session.id}:`, exercisesError);
      console.log('Session will be returned without exercises');
      
      return {
        ...session,
        week_number: weekNumber,
        mesocycle: weekNumber, // For backward compatibility
        exercises: []
      };
    }
    
    // Format exercises with their info - include sets for completed sessions
    const formattedExercises = exercises?.map(entry => {
      const exercise = entry.exercises as any;
      
      // Basic exercise info for all sessions
      const formattedExercise: any = {
        id: exercise?.id,
        name: exercise?.name || 'Unknown Exercise',
        type: exercise?.type,
        variation: exercise?.variation,
        exercise_order: entry.exercise_order,
        target_sets: entry.target_sets,
        target_reps: entry.target_reps,
        target_rpe: entry.target_rpe,
        target_weight: entry.target_weight
      };
      
      // Add sets for completed sessions
      if (isCompletedSession && entry.user_exercise_sets && Array.isArray(entry.user_exercise_sets)) {
        formattedExercise.sets = entry.user_exercise_sets.map((set: any) => ({
          id: set.id,
          set_number: set.set_number,
          weight: set.weight,
          reps: set.reps,
          rpe: set.rpe,
          completed: set.completed
        })).sort((a: any, b: any) => a.set_number - b.set_number);
      }
      
      return formattedExercise;
    }) || [];
    
    return {
      ...session,
      week_number: weekNumber,
      mesocycle: weekNumber, // For backward compatibility
      exercises: formattedExercises
    };
  }));

  // Calculate current week
  const metadata = userPlan.metadata as Record<string, any> || {};
  const startDate = metadata.start_date || userPlan.created_at;
  
  const currentWeek = startDate
    ? Math.ceil(
        (new Date().getTime() - new Date(startDate).getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      )
    : 1;

  return {
    id: userPlan.id,
    name: userPlan.name,
    description: userPlan.description,
    goal: userPlan.goal,
    status: userPlan.status,
    currentWeek: currentWeek > 0 ? currentWeek : 1,
    weeks,
    sessionsByWeek,  // Add the sessionsByWeek map for easier UI display
    sessions: sessionsWithExercises || [] // Use our new array with exercises included
  };
}

/**
 * Delete a training plan and all associated data
 */
export async function deleteTrainingPlan(
  supabase: SupabaseClient<Database>,
  userId: string,
  planId: number
) {
  console.log(`Deleting training plan ID ${planId} for user ${userId}`);
  
  try {
    // 1. First verify the plan belongs to this user
    const { data: userPlan, error: planCheckError } = await supabase
      .from('user_plans')
      .select('id')
      .eq('id', planId)
      .eq('user_id', userId)
      .single();

    if (planCheckError || !userPlan) {
      console.error('Error verifying plan ownership:', planCheckError);
      throw new Error('Plan not found or not owned by this user');
    }

    // 2. Get all weeks associated with this plan
    const { data: planWeeks, error: weeksError } = await supabase
      .from('user_plan_weeks')
      .select('id')
      .eq('plan_id', planId);

    if (weeksError) {
      console.error('Error fetching plan weeks:', weeksError);
      throw new Error('Failed to fetch plan weeks');
    }
    
    const weekIds = planWeeks?.map(week => week.id) || [];
    
    // 3. Get all sessions associated with this plan
    const { data: sessions, error: sessionsError } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('plan_id', planId);
      
    if (sessionsError) {
      console.error('Error fetching plan sessions:', sessionsError);
      throw new Error('Failed to fetch plan sessions');
    }
    
    const sessionIds = sessions?.map(session => session.id) || [];
    
    // 4. For each session, get and delete exercise entries and their sets
    for (const sessionId of sessionIds) {
      // Get exercise entries
      const { data: entries, error: entriesError } = await supabase
        .from('user_exercise_entries')
        .select('id')
        .eq('session_id', sessionId);
        
      if (entriesError) {
        console.error(`Error fetching exercise entries for session ${sessionId}:`, entriesError);
        continue;
      }
      
      const entryIds = entries?.map(entry => entry.id) || [];
      
      // Delete sets for each entry
      if (entryIds.length > 0) {
        const { error: setsDeleteError } = await supabase
          .from('user_exercise_sets')
          .delete()
          .in('exercise_entry_id', entryIds);
          
        if (setsDeleteError) {
          console.error('Error deleting exercise sets:', setsDeleteError);
        } else {
          console.log(`Deleted sets for ${entryIds.length} exercise entries`);
        }
      }
      
      // Delete exercise entries
      if (entryIds.length > 0) {
        const { error: entriesDeleteError } = await supabase
          .from('user_exercise_entries')
          .delete()
          .in('id', entryIds);
          
        if (entriesDeleteError) {
          console.error('Error deleting exercise entries:', entriesDeleteError);
        } else {
          console.log(`Deleted ${entryIds.length} exercise entries`);
        }
      }
    }
    
    // 5. Delete all sessions
    if (sessionIds.length > 0) {
      const { error: sessionsDeleteError } = await supabase
        .from('user_sessions')
        .delete()
        .in('id', sessionIds);
        
      if (sessionsDeleteError) {
        console.error('Error deleting sessions:', sessionsDeleteError);
      } else {
        console.log(`Deleted ${sessionIds.length} sessions`);
      }
    }
    
    // 6. Delete all weeks
    if (weekIds.length > 0) {
      const { error: weeksDeleteError } = await supabase
        .from('user_plan_weeks')
        .delete()
        .in('id', weekIds);
        
      if (weeksDeleteError) {
        console.error('Error deleting plan weeks:', weeksDeleteError);
      } else {
        console.log(`Deleted ${weekIds.length} plan weeks`);
      }
    }
    
    // 7. Finally, delete the plan itself
    const { error: planDeleteError } = await supabase
      .from('user_plans')
      .delete()
      .eq('id', planId);
      
    if (planDeleteError) {
      console.error('Error deleting plan:', planDeleteError);
      throw new Error('Failed to delete training plan');
    }
    
    console.log(`Successfully deleted training plan ${planId}`);
    
    return {
      success: true,
      message: 'Training plan deleted successfully'
    };
  } catch (error) {
    console.error('Error in deleteTrainingPlan:', error);
    throw error;
  }
}

export function convertLegacyPlanFormat(legacyPlan: any): AssistantPlan {
  const weeks: AssistantPlanWeek[] = [];
  
  // If the plan has weeklyStructure, use that
  if (legacyPlan.weeklyStructure && Array.isArray(legacyPlan.weeklyStructure)) {
    legacyPlan.weeklyStructure.forEach((week: any) => {
      const sessions = week.sessions.map((session: any, idx: number) => {
        const exercises = session.exercises.map((ex: any, exIdx: number) => ({
          name: ex.name,
          variation: ex.details || ex.type,
          exercise_order: exIdx + 1,
          target_sets: ex.sets,
          target_reps: ex.repsRange,
          target_rpe: ex.rpe,
          instructions: ex.notes,
          notes: null
        }));
        
        return {
          name: session.focus || `Day ${idx + 1}`,
          type: session.focus?.toLowerCase().includes('strength') ? 'strength' : 
                session.focus?.toLowerCase().includes('hypertrophy') ? 'hypertrophy' : 'general',
          instructions: session.day,
          notes: null,
          exercises,
          session_order: idx + 1
        };
      });
      
      weeks.push({
        week_number: week.week,
        focus: week.focus,
        instructions: null,
        notes: null,
        sessions
      });
    });
  } 
  // Otherwise, if it just has sessions, put them all in week 1
  else if (legacyPlan.sessions && Array.isArray(legacyPlan.sessions)) {
    const sessions = legacyPlan.sessions.map((session: any, idx: number) => {
      const exercises = session.exercises.map((ex: any, exIdx: number) => ({
        name: ex.name,
        variation: ex.details || ex.type,
        exercise_order: exIdx + 1,
        target_sets: ex.sets,
        target_reps: ex.repsRange,
        target_rpe: ex.rpe,
        instructions: ex.notes,
        notes: null
      }));
      
      return {
        name: session.focus || `Day ${idx + 1}`,
        type: session.focus?.toLowerCase().includes('strength') ? 'strength' : 
              session.focus?.toLowerCase().includes('hypertrophy') ? 'hypertrophy' : 'general',
        instructions: session.day,
        notes: null,
        exercises,
        session_order: idx + 1
      };
    });
    
    weeks.push({
      week_number: 1,
      focus: "Week 1",
      instructions: null,
      notes: null,
      sessions
    });
  }
  
  return {
    name: legacyPlan.name,
    description: legacyPlan.description,
    goal: "",
    weeks,
    metadata: {
      start_date: new Date().toISOString(),
      legacy_conversion: true
    }
  };
}