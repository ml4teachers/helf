import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.23.4/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Schema for validation
const memorySchema = z.object({
  memory_type: z.string().min(1, 'Memory type is required'),
  content: z.string().min(1, 'Content is required'),
  active: z.boolean().optional().default(true),
});

console.log(`Function "user-memory" booting up!`);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(`Handling ${req.method} request for user-memory`);

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
    console.log('User authenticated:', user.id);

    // 2. Handle based on HTTP method
    if (req.method === 'GET') {
      // GET all active memories for the user
      const { data, error } = await supabaseClient
        .from('user_assistant_memories')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true) // Only fetch active memories by default
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching memories:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch memories' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.log(`Fetched ${data?.length || 0} memories.`);
      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else if (req.method === 'POST') {
      // POST a new memory for the user
      const body = await req.json();
      const validation = memorySchema.safeParse(body);

      if (!validation.success) {
        console.error('Invalid input:', validation.error.flatten());
        return new Response(JSON.stringify({ error: 'Invalid input', details: validation.error.errors }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { memory_type, content, active } = validation.data;
      console.log('Input validated for new memory.');

      const { data: newMemory, error: insertError } = await supabaseClient
        .from('user_assistant_memories')
        .insert({ user_id: user.id, memory_type, content, active })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating memory:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to create memory' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.log('New memory created:', newMemory?.id);
      return new Response(JSON.stringify(newMemory), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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