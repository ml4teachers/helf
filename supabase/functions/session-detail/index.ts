import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log(`Function "session-detail" booting up!`);

// Helper function to log errors
const logOperationError = (operation: string, sessionId: number, error: any) => {
  console.error(`Error during ${operation} for session ${sessionId}:`, error?.message || error);
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(`Handling ${req.method} request for session-detail`);

  try {
    // 1. Get Session ID from query parameters
    const url = new URL(req.url);
    const sessionIdParam = url.searchParams.get('id');
    if (!sessionIdParam) {
      return new Response(JSON.stringify({ error: 'Missing session ID in query parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const sessionId = parseInt(sessionIdParam, 10);
    if (isNaN(sessionId)) {
      return new Response(JSON.stringify({ error: 'Invalid session ID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    console.log(`Target session ID: ${sessionId}`);

    // 2. Authenticate User
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

    // --- Verify session ownership first for both GET and DELETE ---
    const { data: sessionCheck, error: checkError } = await supabaseClient
        .from('user_sessions')
        .select('id') // Select only id for check
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle to handle not found gracefully

    if (checkError) {
         console.error(`Error checking session ownership for session ${sessionId}:`, checkError);
         return new Response(JSON.stringify({ error: 'Failed to verify session', details: checkError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!sessionCheck) {
         console.log(`Session ${sessionId} not found or not owned by user ${userId}.`);
         return new Response(JSON.stringify({ error: 'Session not found or access denied' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
     console.log(`Session ${sessionId} ownership verified for user ${userId}.`);


    // 3. Handle based on HTTP method
    if (req.method === 'GET') {
      // GET Session Details (including exercises and sets)
      const { data: sessionDetails, error: getError } = await supabaseClient
        .from('user_sessions')
        .select(`
          *,
          user_exercise_entries (
            *,
            exercises (*),
            user_exercise_sets (*)
          )
        `)
        .eq('id', sessionId)
        .eq('user_id', userId) // Redundant check, but safe
        .single(); // We expect exactly one result now

      if (getError) {
        logOperationError('GET details', sessionId, getError);
        return new Response(JSON.stringify({ error: 'Failed to fetch session details', details: getError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.log(`Successfully fetched details for session ${sessionId}`);
      return new Response(JSON.stringify(sessionDetails), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else if (req.method === 'DELETE') {
      // DELETE the session and its related data
      // Note: This cascade is done here for simplicity, but a DB function would be more robust/atomic.

      console.log(`Starting deletion process for session ${sessionId}`);

      // Get exercise entry IDs to delete sets first
      const { data: entries, error: entriesError } = await supabaseClient
          .from('user_exercise_entries')
          .select('id')
          .eq('session_id', sessionId);

      if (entriesError) {
          logOperationError('fetching entries before delete', sessionId, entriesError);
          // Decide whether to proceed or return error
          return new Response(JSON.stringify({ error: 'Failed to fetch exercise entries for deletion', details: entriesError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const entryIds = entries?.map(e => e.id) || [];

      if (entryIds.length > 0) {
         // Delete sets linked to these entries
         console.log(`Deleting sets for entries: ${entryIds.join(', ')}`);
         const { error: setsDeleteError } = await supabaseClient
             .from('user_exercise_sets')
             .delete()
             .in('exercise_entry_id', entryIds);
         if (setsDeleteError) {
             logOperationError('deleting sets', sessionId, setsDeleteError);
             // Log error but continue deletion process
         } else {
             console.log(`Deleted sets for session ${sessionId}.`);
         }

         // Delete exercise entries
         console.log(`Deleting entries: ${entryIds.join(', ')}`);
         const { error: entriesDeleteError } = await supabaseClient
             .from('user_exercise_entries')
             .delete()
             .in('id', entryIds);
         if (entriesDeleteError) {
             logOperationError('deleting entries', sessionId, entriesDeleteError);
             // Log error but continue deletion process
         } else {
              console.log(`Deleted entries for session ${sessionId}.`);
         }
      } else {
         console.log(`No exercise entries found for session ${sessionId}.`);
      }

      // Finally, delete the session itself
      console.log(`Deleting session ${sessionId}`);
      const { error: sessionDeleteError, count } = await supabaseClient
        .from('user_sessions')
        .delete({ count: 'exact' })
        .eq('id', sessionId)
        .eq('user_id', userId); // Ownership already checked, but good practice

      if (sessionDeleteError) {
         logOperationError('deleting session', sessionId, sessionDeleteError);
         return new Response(JSON.stringify({ error: 'Failed to delete session', details: sessionDeleteError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
       if (count === 0) {
         // Should not happen due to initial check, but safety first
         console.warn(`Session ${sessionId} was not found during the final delete step.`);
         return new Response(JSON.stringify({ error: 'Session not found during final delete' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      console.log(`Session ${sessionId} deleted successfully.`);
      return new Response(JSON.stringify({ message: 'Session deleted successfully' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else {
      // Method not allowed
      console.log(`Method ${req.method} not allowed.`);
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (error) {
    console.error('Internal server error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 