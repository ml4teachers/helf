import { SupabaseClient } from '@supabase/supabase-js';
import { Database, UserSession, UIExercise, UISessionExercise, SessionCreate } from '../types';
import { findOrCreateExercise } from './exerciseManagement';

/**
 * Get all training sessions for a user
 */
export async function getUserSessions(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  // Get the sessions
  const { data: sessions, error } = await supabase
    .from('user_sessions')
    .select('*, user_plan_weeks(week_number, plan_id)')
    .eq('user_id', userId)
    .order('completed_date', { ascending: false }) // Completed sessions at the bottom
    .order('status', { ascending: true }) // Upcoming and planned sessions first
    .order('scheduled_date', { ascending: true }); // Then by date

  if (error) {
    console.error('Error fetching user sessions:', error);
    throw new Error('Failed to fetch user sessions');
  }

  // For each session, get the exercises
  const sessionsWithExercises = await Promise.all(
    (sessions || []).map(async (session) => {
      const { data: exerciseEntries, error: entriesError } = await supabase
        .from('user_exercise_entries')
        .select('*, exercises(name, type, details)')
        .eq('session_id', session.id);

      if (entriesError) {
        console.error('Error fetching exercise entries for session:', entriesError);
        return {
          id: session.id,
          date: session.scheduled_date || session.completed_date,
          name: session.name,
          exercises: [],
          status: session.status,
          completed: session.status === 'completed',
        };
      }

      // Extract exercise names
      const exerciseNames = exerciseEntries
        ? exerciseEntries.map(entry => {
            const exercise = entry.exercises as any;
            return exercise?.name || 'Unknown Exercise';
          })
        : [];
      
      // Remove duplicates
      const exercises = exerciseNames.filter((name, index) => 
        exerciseNames.indexOf(name) === index
      );

      // Get week and session information directly from the database
      const weekNumber = session.user_plan_weeks?.week_number || null;
      const sessionOrder = session.session_order || null;
      
      return {
        id: session.id,
        date: session.scheduled_date || session.completed_date,
        name: session.name || 'Session',
        exercises,
        status: session.status,
        completed: session.status === 'completed',
        week_number: weekNumber,
        session_order: sessionOrder,
        plan_id: session.plan_id,
        plan_week_id: session.plan_week_id,
      };
    })
  );

  return sessionsWithExercises;
}

/**
 * Get a specific training session with full exercise details
 */
export async function getSessionWithExercises(
  supabase: SupabaseClient<Database>,
  sessionId: number
) {
  // Get the session details
  const { data: session, error } = await supabase
    .from('user_sessions')
    .select('*, user_plan_weeks(week_number, plan_id)')
    .eq('id', sessionId)
    .single();

  if (error) {
    console.error('Error fetching session:', error);
    throw new Error('Failed to fetch session');
  }

  if (!session) {
    throw new Error('Session not found');
  }

  console.log(`Fetching exercise entries for session ${sessionId}`);
  
  // Get all exercise entries for this session
  const { data: exerciseEntries, error: entriesError } = await supabase
    .from('user_exercise_entries')
    .select(`
      *,
      exercises(*),
      user_exercise_sets(*)
    `)
    .eq('session_id', sessionId)
    .order('exercise_order');

  if (entriesError) {
    console.error('Error fetching exercise entries:', entriesError);
    throw new Error('Failed to fetch exercise entries');
  }
  
  console.log(`Found ${exerciseEntries?.length || 0} exercise entries`);
  if (exerciseEntries?.length) {
    exerciseEntries.forEach((entry, index) => {
      console.log(`Entry ${index+1}: ID ${entry.id}, Exercise ID ${entry.exercise_id}, Name: ${entry.exercises?.name || 'Unknown'}, Sets: ${entry.user_exercise_sets?.length || 0}`);
    });
  }

  // Format exercises with their sets
  const exercises: UISessionExercise[] = exerciseEntries?.map(entry => {
    const exercise = entry.exercises as any;
    const sets = entry.user_exercise_sets as any[] || [];
    
    return {
      id: exercise?.id || 0,
      entry_id: entry.id,
      session_id: sessionId,
      name: exercise?.name || 'Unknown Exercise',
      type: exercise?.type || 'weight',
      variation: exercise?.variation || '',
      description: exercise?.description || '',
      instructions: entry.instructions || undefined,
      notes: entry.notes || undefined,
      exercise_order: entry.exercise_order,
      target_sets: entry.target_sets,
      target_reps: entry.target_reps,
      target_rpe: entry.target_rpe,
      target_weight: entry.target_weight,
      sets: sets.map(set => ({
        id: set.id,
        set_number: set.set_number,
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe,
        completed: set.completed
      })).sort((a, b) => a.set_number - b.set_number)
    };
  }) || [];

  // Format the session for the UI
  return {
    session: {
      id: session.id,
      date: session.scheduled_date || '',
      startTime: '',  // Not currently used
      endTime: '',    // Not currently used
      name: session.name || '',
      type: session.type || '',
      readiness: {
        score: session.readiness_score || 5,
      },
      instructions: session.instructions || '',
      notes: session.notes || '',
      status: session.status || 'planned',
      week_number: session.user_plan_weeks?.week_number || null,
      session_order: session.session_order || null,
      plan_id: session.plan_id,
      plan_week_id: session.plan_week_id,
    },
    exercises,
  };
}

/**
 * Create a new training session
 */
export async function createTrainingSession(
  supabase: SupabaseClient<Database>,
  userId: string,
  sessionData: SessionCreate
) {
  // 1. Create the session
  const { data: session, error: sessionError } = await supabase
    .from('user_sessions')
    .insert({
      user_id: userId,
      name: sessionData.name,
      type: sessionData.type,
      scheduled_date: sessionData.scheduled_date,
      status: sessionData.status || 'in_progress',
      instructions: sessionData.instructions,
      notes: sessionData.notes,
      readiness_score: sessionData.readiness_score,
      plan_id: sessionData.plan_id,
      plan_week_id: sessionData.plan_week_id,
      session_order: sessionData.session_order,
    })
    .select()
    .single();

  if (sessionError) {
    console.error('Error creating session:', sessionError);
    throw new Error('Failed to create training session');
  }

  // 2. Process each exercise if provided
  if (sessionData.exercises && sessionData.exercises.length > 0) {
    for (const exercise of sessionData.exercises) {
      // Check if this exercise exists or create it
      let exerciseId = await findOrCreateExercise(supabase, {
        id: exercise.exercise_id,
        name: '', // Name will be fetched from the database using exercise_id
      });
      
      // 3. Create exercise entry
      const { data: exerciseEntry, error: entryError } = await supabase
        .from('user_exercise_entries')
        .insert({
          session_id: session.id,
          exercise_id: exerciseId,
          exercise_order: exercise.exercise_order,
          instructions: exercise.instructions,
          notes: exercise.notes,
          target_sets: exercise.target_sets,
          target_reps: exercise.target_reps,
          target_rpe: exercise.target_rpe,
          target_weight: exercise.target_weight,
        })
        .select()
        .single();
        
      if (entryError) {
        console.error('Error creating exercise entry:', entryError);
        continue; // Skip set creation if entry creation failed
      }

      // 4. Create sets if provided
      if (exercise.sets && exercise.sets.length > 0) {
        const setsToInsert = exercise.sets.map((set, index) => ({
          exercise_entry_id: exerciseEntry.id,
          set_number: set.set_number || index + 1,
          weight: set.weight,
          reps: set.reps,
          rpe: set.rpe,
          completed: set.completed ?? false,
          notes: set.notes,
        }));
        
        const { error: setsError } = await supabase
          .from('user_exercise_sets')
          .insert(setsToInsert);
          
        if (setsError) {
          console.error('Error creating exercise sets:', setsError);
        }
      }
    }
  }
  
  return {
    sessionId: session.id,
    message: "Training session created successfully"
  };
}

/**
 * Update an existing training session
 */
export async function updateTrainingSession(
  supabase: SupabaseClient<Database>,
  sessionId: number,
  sessionData: {
    date?: string;
    startTime?: string;
    endTime?: string;
    name?: string;
    type?: string;
    readiness?: { score?: number };
    instructions?: string;
    notes?: string;
    status?: string;
  },
  exercises: UISessionExercise[]
) {
  // 1. Update the session
  const updateFields: Record<string, any> = {};
  
  if (sessionData.date) updateFields.scheduled_date = sessionData.date;
  if (sessionData.name) updateFields.name = sessionData.name;
  if (sessionData.type) updateFields.type = sessionData.type;
  if (sessionData.instructions !== undefined) updateFields.instructions = sessionData.instructions;
  if (sessionData.notes !== undefined) updateFields.notes = sessionData.notes;
  if (sessionData.readiness?.score !== undefined) updateFields.readiness_score = sessionData.readiness.score;
  
  // If session is being completed
  if (sessionData.status === 'completed' || (!sessionData.status && updateFields.scheduled_date)) {
    updateFields.status = 'completed';
    updateFields.completed_date = updateFields.scheduled_date || new Date().toISOString().split('T')[0];
  } else if (sessionData.status) {
    updateFields.status = sessionData.status;
  }
  
  if (Object.keys(updateFields).length > 0) {
    const { error: sessionError } = await supabase
      .from('user_sessions')
      .update(updateFields)
      .eq('id', sessionId);

    if (sessionError) {
      console.error('Error updating session:', sessionError);
      throw new Error('Failed to update training session');
    }
  }

  // 2. Process each exercise
  console.log(`Processing ${exercises.length} exercises for session ${sessionId}`);
  
  for (const exercise of exercises) {
    console.log(`Processing exercise: ${exercise.name}, ID: ${exercise.id}, entry_id: ${exercise.entry_id}`);
    
    // Update or create entry
    if (exercise.entry_id) {
      console.log(`Updating existing exercise entry: ${exercise.entry_id}`);
      // Check if the exercise was replaced with a different one
      const { data: currentEntry, error: fetchError } = await supabase
        .from('user_exercise_entries')
        .select('exercise_id')
        .eq('id', exercise.entry_id)
        .single();
      
      if (fetchError) {
        console.error('Error fetching current exercise entry:', fetchError);
      } else {
        console.log(`Current exercise_id in DB: ${currentEntry.exercise_id}, UI exercise.id: ${exercise.id}`);
      }
      
      // Update existing entry with all fields including exercise_id if it changed
      const updateFields: Record<string, any> = {
        instructions: exercise.instructions,
        notes: exercise.notes,
        target_sets: exercise.target_sets,
        target_reps: exercise.target_reps,
        target_rpe: exercise.target_rpe,
        target_weight: exercise.target_weight,
        exercise_order: exercise.exercise_order
      };
      
      // Only update exercise_id if it's different
      if (currentEntry && currentEntry.exercise_id !== exercise.id && exercise.id > 0) {
        console.log(`Updating exercise_id from ${currentEntry.exercise_id} to ${exercise.id}`);
        updateFields.exercise_id = exercise.id;
      }
      
      const { error: updateError } = await supabase
        .from('user_exercise_entries')
        .update(updateFields)
        .eq('id', exercise.entry_id);
        
      if (updateError) {
        console.error('Error updating exercise entry:', updateError);
      }
        
      // Update or create sets
      console.log(`Processing ${exercise.sets.length} sets for exercise ${exercise.name}`);
      for (const set of exercise.sets) {
        if (set.id > 0) {
          console.log(`Updating existing set: ${set.id}`);
          // Update existing set
          const { error: setUpdateError } = await supabase
            .from('user_exercise_sets')
            .update({
              weight: set.weight,
              reps: set.reps,
              rpe: set.rpe,
              completed: set.completed
            })
            .eq('id', set.id);
            
          if (setUpdateError) {
            console.error('Error updating set:', setUpdateError);
          }
        } else {
          console.log(`Creating new set for exercise entry ${exercise.entry_id}`);
          // Create new set
          const { error: setInsertError } = await supabase
            .from('user_exercise_sets')
            .insert({
              exercise_entry_id: exercise.entry_id,
              set_number: set.set_number,
              weight: set.weight,
              reps: set.reps,
              rpe: set.rpe,
              completed: set.completed || false
            });
            
          if (setInsertError) {
            console.error('Error creating set:', setInsertError);
          }
        }
      }
      
      // Delete sets that aren't in the updated list
      const setIds = exercise.sets.map(s => s.id).filter(id => id > 0);
      if (setIds.length > 0) {
        console.log(`Deleting old sets for exercise entry ${exercise.entry_id}`);
        const { error: setDeleteError } = await supabase
          .from('user_exercise_sets')
          .delete()
          .eq('exercise_entry_id', exercise.entry_id)
          .not('id', 'in', `(${setIds.join(',')})`);
          
        if (setDeleteError) {
          console.error('Error deleting old sets:', setDeleteError);
        }
      }
    } else {
      console.log(`Creating new exercise entry for ${exercise.name}`);
      // Create new entry
      const exerciseId = await findOrCreateExercise(supabase, {
        id: exercise.id,
        name: exercise.name,
        type: exercise.type,
        variation: exercise.variation
      });
      
      console.log(`Found or created exercise with ID: ${exerciseId}`);
      
      const { data: newEntry, error: entryError } = await supabase
        .from('user_exercise_entries')
        .insert({
          session_id: sessionId,
          exercise_id: exerciseId,
          exercise_order: exercise.exercise_order || 999, // Default high order if not specified
          instructions: exercise.instructions,
          notes: exercise.notes,
          target_sets: exercise.target_sets,
          target_reps: exercise.target_reps,
          target_rpe: exercise.target_rpe,
          target_weight: exercise.target_weight
        })
        .select()
        .single();
        
      if (entryError) {
        console.error('Error creating exercise entry:', entryError);
        continue;
      }
      
      console.log(`Created new exercise entry with ID: ${newEntry.id}`);
      
      // Create sets
      console.log(`Creating ${exercise.sets.length} sets for new exercise entry`);
      for (const set of exercise.sets) {
        const { error: setInsertError } = await supabase
          .from('user_exercise_sets')
          .insert({
            exercise_entry_id: newEntry.id,
            set_number: set.set_number,
            weight: set.weight,
            reps: set.reps,
            rpe: set.rpe,
            completed: set.completed || false
          });
          
        if (setInsertError) {
          console.error('Error creating set for new exercise:', setInsertError);
        }
      }
    }
  }
  
  // Delete entries that aren't in the updated list
  const entryIds = exercises
    .map(e => e.entry_id)
    .filter(id => id && id > 0) as number[];
    
  if (entryIds.length > 0) {
    await supabase
      .from('user_exercise_entries')
      .delete()
      .eq('session_id', sessionId)
      .not('id', 'in', `(${entryIds.join(',')})`);
  }
  
  return {
    sessionId,
    message: "Training session updated successfully"
  };
}

/**
 * Delete a training session
 */
export async function deleteTrainingSession(
  supabase: SupabaseClient<Database>,
  sessionId: number
) {
  // Delete the session (cascade will delete associated entries and sets)
  const { error } = await supabase
    .from('user_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    console.error('Error deleting session:', error);
    throw new Error('Failed to delete training session');
  }
  
  return {
    message: "Training session deleted successfully"
  };
}

/**
 * Get the next training session for a user
 */
export async function getNextTrainingSession(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  console.log(`Looking for next session for user ${userId}`);
  
  // Check if there's already a session planned or in progress
  const { data: inProgressSessions, error: statusError } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['planned', 'in_progress'])
    .order('scheduled_date', { ascending: true })
    .limit(1);
    
  console.log(`Found ${inProgressSessions?.length || 0} in-progress or planned sessions`);
    
  if (statusError) {
    console.error('Error fetching in-progress sessions:', statusError);
    throw new Error('Failed to fetch next session');
  }
  
  // If there's a session planned or in progress, return it
  if (inProgressSessions && inProgressSessions.length > 0) {
    return inProgressSessions[0];
  }
  
  // Otherwise, suggest creating a new session
  return null;
}