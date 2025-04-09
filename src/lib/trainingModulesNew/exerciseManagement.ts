import { SupabaseClient } from '@supabase/supabase-js';
import { Database, UserExerciseSet, Exercise, UIExercise, UISessionExercise } from '../types';

/**
 * Get all exercises from the database
 */
export async function getAllExercises(
  supabase: SupabaseClient<Database>
) {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching exercises:', error);
    throw new Error('Failed to fetch exercises');
  }

  return data || [];
}

/**
 * Update an exercise
 */
export async function updateExercise(
  supabase: SupabaseClient<Database>,
  exerciseId: number,
  updateData: {
    name?: string;
    type?: string;
    variation?: string;
    description?: string;
  }
) {
  // Update the exercise with provided data
  const { data: updatedExercise, error: exerciseError } = await supabase
    .from('exercises')
    .update(updateData)
    .eq('id', exerciseId)
    .select()
    .single();

  if (exerciseError) {
    console.error('Error updating exercise:', exerciseError);
    throw new Error('Failed to update exercise');
  }
  
  return {
    exercise: updatedExercise,
    message: "Exercise updated successfully"
  };
}

/**
 * Get exercise history for a user
 */
export async function getExerciseHistory(
  supabase: SupabaseClient<Database>,
  userId: string,
  exerciseId: number
) {
  // Get user exercise entries for this exercise
  const { data: exerciseEntries, error } = await supabase
    // ... select statement ...
    .from('user_exercise_entries')
    .select(`
      *,
      user_sessions!inner(*),
      user_exercise_sets(*)
    `)
    .eq('exercise_id', exerciseId)
    .eq('user_sessions.user_id', userId)
    .order('created_at', { ascending: false }); // Consider ordering by session date

  if (error) { /* ... error handling ... */ }

  // Define the type for the accumulator object
   type HistoryMap = Record<string, {
       date: string;
       sets: UserExerciseSet[]; // Use the specific type
       entry_id: number;
       session_id: number;
       session_name: string;
   }>;

  const historyByDate = exerciseEntries?.reduce((acc, entry) => {
    // Assuming user_sessions is fetched correctly and is not an array
    const session = entry.user_sessions as any; // Use 'as any' or define a joined type
    if (!session) return acc; // Skip if session join failed

    // Use completed_date first, fallback to scheduled_date
    const date = session.completed_date || session.scheduled_date;
    if (!date) return acc; // Skip entries without a valid date

    const sets = (entry.user_exercise_sets || []) as UserExerciseSet[];

    // Use date string directly as key
    const dateKey = String(date);

    if (!acc[dateKey]) {
      acc[dateKey] = {
        date: dateKey, // Store the date string used as key
        sets: [],
        entry_id: entry.id,
        session_id: session.id,
        session_name: session.name
      };
    }

    // Add only completed sets with validation
    const completedSets = sets.filter(set => set.completed === true);
    acc[dateKey].sets.push(...completedSets);

    // Sort sets within the entry (optional, could be done later)
    acc[dateKey].sets.sort((a: UserExerciseSet, b: UserExerciseSet) => { // Add types
      const weightA = a.weight || 0;
      const weightB = b.weight || 0;
      if (weightA !== weightB) return weightB - weightA;
      const repsA = a.reps || 0;
      const repsB = b.reps || 0;
      return repsB - repsA;
    });

    return acc;
  }, {} as HistoryMap); // Use the defined type for the initial value


  const historyArray = Object.values(historyByDate || {});

  // Sort final array by date descending
  historyArray.sort((a, b) => { // Add types if needed, though Date parsing might be safer
    try {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (isNaN(dateA) || isNaN(dateB)) return 0; // Handle invalid dates
      return dateB - dateA;
    } catch (e) {
      return 0; // Handle potential errors during date parsing
    }
  });

  return historyArray;
}

/**
 * Create or find an exercise in the database
 * Helper function used by other modules
 */
export async function findOrCreateExercise(
  supabase: SupabaseClient<Database>,
  exerciseData: {
    id?: number;
    name: string;
    type?: string;
    variation?: string;
    notes?: string;
    instructions?: string;
  }
): Promise<number> {
  // If we have a valid ID, return it directly
  if (exerciseData.id && exerciseData.id > 0) {
    return exerciseData.id;
  }
  
  // We used to handle canonical_name, but it's been removed
  
  // Start with direct name + variation lookup, which is more accurate
  const { data: existingExercisesByNameVariation } = await supabase
    .from('exercises')
    .select('id, name, variation, type')
    .ilike('name', exerciseData.name)
    .eq('variation', exerciseData.variation || '');
  
  // Look for an exact name and variation match
  const exactMatch = existingExercisesByNameVariation?.find(ex => 
    ex.name.toLowerCase() === exerciseData.name.toLowerCase()
  );
  
  if (exactMatch) {
    return exactMatch.id;
  }
  
  // We removed the canonical_name lookup since that field has been removed
  
  // Search more broadly by name as final fallback
  const { data: existingExercises } = await supabase
    .from('exercises')
    .select('id, name, variation, type')
    .ilike('name', exerciseData.name);
  
  // Look for a match by name AND variation
  const existingExercise = existingExercises?.find(ex => 
    ex.name.toLowerCase() === exerciseData.name.toLowerCase() &&
    (ex.variation === exerciseData.variation || (!ex.variation && !exerciseData.variation))
  );
  
  console.log(`Looking for exercise with name: "${exerciseData.name}" and variation: "${exerciseData.variation || 'none'}", matches: ${existingExercises?.length || 0}, exact match: ${existingExercise ? existingExercise.id : 'none'}`);
  if (existingExercises && existingExercises.length > 0) {
    console.log('Available matches:', existingExercises.map(ex => `${ex.id}: ${ex.name} (${ex.variation || 'no variation'})`))
  }
  
  // If we found an exact match but our type is different, update the type
  if (existingExercise && exerciseData.type && existingExercise.type !== exerciseData.type) {
    console.log(`Updating exercise ${existingExercise.id} type from ${existingExercise.type} to ${exerciseData.type}`);
    await supabase
      .from('exercises')
      .update({ type: exerciseData.type })
      .eq('id', existingExercise.id);
  }
  
  if (existingExercise) {
    return existingExercise.id;
  }
  
  // Try to find the maximum existing ID to avoid conflicts
  const { data: maxIdResult } = await supabase
    .from('exercises')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
    
  const nextId = maxIdResult && maxIdResult.length > 0 ? maxIdResult[0].id + 1 : 1;
  
  // Determine exercise type based on name and context
  let exerciseType = exerciseData.type;
  
  if (!exerciseType) {
    // Try to determine the type from the name or instructions
    const name = exerciseData.name.toLowerCase();
    const instructions = (exerciseData.instructions || '').toLowerCase();
    
    if (
      // Time-based exercises
      name.includes('plank') || name.includes('hold') || name.includes('hang') || 
      name.includes('farmer') || name.includes('carry') || name.includes('cardio') || 
      name.includes('rowing') || name.includes('run') || name.includes('bike') ||
      name.includes('jog') || name.includes('sprint') || name.includes('walk')
    ) {
      exerciseType = 'time';
    } else if (
      // Rep-based exercises (typically bodyweight)
      name.includes('push up') || name.includes('pushup') || name.includes('chin up') || 
      name.includes('pull up') || name.includes('pullup') || name.includes('chinup') || 
      name.includes('burpee') || name.includes('bodyweight') || name.includes('bw ') || 
      name.includes('jump') || (name.includes('up') && name.includes('body weight'))
    ) {
      exerciseType = 'reps';
    } else if (
      // Calorie-based exercises
      name.includes('cal') || name.includes('calorie') || name.includes('energy')
    ) {
      exerciseType = 'cal';
    } else {
      // Default to weight for most exercises
      exerciseType = 'weight';
    }
    
    // Use instructions to overwrite the type if they are more specific
    if (instructions) {
      if (instructions.includes('for time') || instructions.includes('timed') || instructions.includes('seconds')) {
        exerciseType = 'time';
      } else if (instructions.includes('calories')) {
        exerciseType = 'cal';
      }
    }
  }
  
  // Prepare exercise data for insertion
  const exerciseInsertData: any = {
    id: nextId, // Explicitly set the ID to avoid conflicts
    name: exerciseData.name,
    type: exerciseType, // Use the determined type instead of defaulting to "weight"
    variation: exerciseData.variation || null
  };
  
  // Create a new exercise
  const { data: newExercise, error: exerciseError } = await supabase
    .from('exercises')
    .insert(exerciseInsertData)
    .select()
    .single();
    
  if (exerciseError) {
    console.error('Error creating exercise:', exerciseError);
    throw new Error('Failed to create exercise');
  }
  
  return newExercise.id;
}