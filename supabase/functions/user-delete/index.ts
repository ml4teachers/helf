import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log(`Function "user-delete" booting up!`);

// Helper function to log errors without stopping execution
const logDeleteError = (entity: string, id: string | number | (string | number)[], error: any) => {
  console.error(`Error deleting ${entity} (ID/s: ${id}):`, error?.message || error);
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  // Expect a DELETE request
  if (req.method !== 'DELETE') {
    console.log(`Method ${req.method} not allowed.`);
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`Handling DELETE request`);

  try {
    // 1. Authenticate User
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create Supabase client WITH user's auth context
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    console.log('Supabase client created.');

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized or invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = user.id;
    console.log('User authenticated:', userId);

    // --- Begin Deletion Cascade (using user permissions via RLS) ---
    // NOTE: This assumes RLS policies allow the user to delete their own related data.
    // It's NOT atomic. If a step fails, previous deletions are not rolled back.

    // 2. Get all plans for the user
    const { data: plans, error: plansError } = await supabaseClient
      .from('user_plans')
      .select('id')
      .eq('user_id', userId);

    if (plansError) throw new Error(`Failed to fetch user plans: ${plansError.message}`);
    const planIds = plans?.map(plan => plan.id) || [];
    console.log(`Found ${planIds.length} plans for user ${userId}`);

    if (planIds.length > 0) {
      // 3. For each plan, get related weeks and sessions
      const { data: weeks, error: weeksError } = await supabaseClient
        .from('user_plan_weeks')
        .select('id')
        .in('plan_id', planIds);
      if (weeksError) logDeleteError('plan weeks', planIds, weeksError); // Log but continue
      const weekIds = weeks?.map(week => week.id) || [];

      const { data: sessions, error: sessionsError } = await supabaseClient
        .from('user_sessions')
        .select('id')
        .in('plan_id', planIds); // Assume sessions are linked to plans
      if (sessionsError) logDeleteError('sessions', planIds, sessionsError); // Log but continue
      const sessionIds = sessions?.map(session => session.id) || [];
      console.log(`Found ${weekIds.length} weeks and ${sessionIds.length} sessions.`);

      if (sessionIds.length > 0) {
        // 4. For each session, get related exercise entries
        const { data: entries, error: entriesError } = await supabaseClient
          .from('user_exercise_entries')
          .select('id')
          .in('session_id', sessionIds);
        if (entriesError) logDeleteError('exercise entries', sessionIds, entriesError); // Log but continue
        const entryIds = entries?.map(entry => entry.id) || [];
        console.log(`Found ${entryIds.length} exercise entries.`);

        if (entryIds.length > 0) {
           // 5. Delete sets for these entries
           const { error: setsDeleteError } = await supabaseClient
             .from('user_exercise_sets')
             .delete()
             .in('exercise_entry_id', entryIds);
           if (setsDeleteError) logDeleteError('exercise sets', entryIds, setsDeleteError);
           else console.log(`Deleted sets for ${entryIds.length} entries.`);

           // 6. Delete the exercise entries themselves
           const { error: entriesDeleteError } = await supabaseClient
             .from('user_exercise_entries')
             .delete()
             .in('id', entryIds);
           if (entriesDeleteError) logDeleteError('exercise entries', entryIds, entriesDeleteError);
           else console.log(`Deleted ${entryIds.length} exercise entries.`);
        }
      }

      // 7. Delete the sessions
      if (sessionIds.length > 0) {
        const { error: sessionsDeleteError } = await supabaseClient
          .from('user_sessions')
          .delete()
          .in('id', sessionIds);
        if (sessionsDeleteError) logDeleteError('sessions', sessionIds, sessionsDeleteError);
        else console.log(`Deleted ${sessionIds.length} sessions.`);
      }

       // 8. Delete the weeks
       if (weekIds.length > 0) {
         const { error: weeksDeleteError } = await supabaseClient
           .from('user_plan_weeks')
           .delete()
           .in('id', weekIds);
         if (weeksDeleteError) logDeleteError('plan weeks', weekIds, weeksDeleteError);
         else console.log(`Deleted ${weekIds.length} plan weeks.`);
       }
    }

    // 9. Delete the plans
    if (planIds.length > 0) {
      const { error: plansDeleteError } = await supabaseClient
        .from('user_plans')
        .delete()
        .in('id', planIds);
      if (plansDeleteError) logDeleteError('plans', planIds, plansDeleteError);
      else console.log(`Deleted ${planIds.length} plans.`);
    }

    // 10. Delete user memories
    const { error: memoriesDeleteError } = await supabaseClient
      .from('user_assistant_memories')
      .delete()
      .eq('user_id', userId);
    if (memoriesDeleteError) logDeleteError('user assistant memories', userId, memoriesDeleteError);
    else console.log(`Deleted assistant memories for user ${userId}.`);

    // --- Missing Step: Delete Auth User ---
    // This requires the SERVICE_ROLE_KEY, which is not available by default.
    // To implement this, you'd need to add the key as a secret to the function
    // or use a database function (recommended).
    console.warn(`Auth user ${userId} was NOT deleted. This requires admin privileges (service_role key or DB function).`);

    // 12. Send success response (even if some sub-deletions failed, we tried)
    return new Response(JSON.stringify({ message: 'User data deletion process completed (auth user not deleted).' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Major error during user deletion process:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete user data', message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 