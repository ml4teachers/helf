import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log(`Function "sessions-list-create" booting up!`);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
     console.log(`Method ${req.method} not allowed.`);
     return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log(`Handling GET request for sessions-list-create`);

  try {
    // 1. Authenticate User
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

    // 2. Check for status filter in URL query parameters
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    console.log('Status filter:', status);

    let query = supabaseClient
      .from('user_sessions')
      .select(`
        *,
        user_exercise_entries (
          *,
          exercises (*),
          user_exercise_sets (*)
        )
      `) // Fetch sessions with nested exercises and sets
      .eq('user_id', userId);

    if (status) {
      query = query.eq('status', status);
    }

    // Add default ordering
    query = query.order('scheduled_date', { ascending: false }); // Order by scheduled date descending

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching sessions:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch sessions', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Fetched ${sessions?.length || 0} sessions.`);
    return new Response(JSON.stringify({ sessions }), { // Wrap in { sessions: ... } for consistency? Original code did this sometimes.
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing sessions GET request:', error);
    return new Response(JSON.stringify({ error: 'Failed to process sessions request', message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 