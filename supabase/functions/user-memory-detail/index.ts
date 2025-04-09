import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.23.4/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Schema for updates (all fields optional)
const updateMemorySchema = z.object({
  memory_type: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  active: z.boolean().optional(),
}).refine(obj => Object.keys(obj).length > 0, {
  message: "No update data provided", // Ensure at least one field is present
});

console.log(`Function "user-memory-detail" booting up!`);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(`Handling ${req.method} request for user-memory-detail`);

  try {
    // 1. Get Memory ID from query parameters
    const url = new URL(req.url);
    const memoryIdParam = url.searchParams.get('id');
    if (!memoryIdParam) {
        return new Response(JSON.stringify({ error: 'Missing memory ID in query parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const memoryId = parseInt(memoryIdParam, 10);
    if (isNaN(memoryId)) {
      return new Response(JSON.stringify({ error: 'Invalid memory ID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    console.log(`Target memory ID: ${memoryId}`);

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

    // 3. Handle based on HTTP method
    if (req.method === 'PUT' || req.method === 'PATCH') { // Allow PATCH as well for partial updates
      // UPDATE an existing memory
      const body = await req.json();
      const validation = updateMemorySchema.safeParse(body);

      if (!validation.success) {
        console.error('Invalid input for update:', validation.error.flatten());
        return new Response(JSON.stringify({ error: 'Invalid input', details: validation.error.errors }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.log('Update data validated:', validation.data);

      const { data: updatedMemory, error: updateError } = await supabaseClient
        .from('user_assistant_memories')
        .update({
          ...validation.data,
          updated_at: new Date().toISOString(), // Manually update timestamp
        })
        .eq('id', memoryId)
        .eq('user_id', userId) // Ensure user owns the memory
        .select()
        .single();

      if (updateError) {
        if (updateError.code === 'PGRST116') { // No row found
          console.log('Memory not found or access denied for update.');
          return new Response(JSON.stringify({ error: 'Memory not found or access denied' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        console.error('Error updating memory:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to update memory' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
       if (!updatedMemory) { // Should be caught by PGRST116, but safety check
           console.log('Memory not found after update attempt.');
           return new Response(JSON.stringify({ error: 'Memory not found or access denied' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       }
      console.log('Memory updated successfully:', updatedMemory.id);
      return new Response(JSON.stringify(updatedMemory), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else if (req.method === 'DELETE') {
      // DELETE a memory
      const { error: deleteError, count } = await supabaseClient
        .from('user_assistant_memories')
        .delete({ count: 'exact' }) // Request count
        .eq('id', memoryId)
        .eq('user_id', userId); // Ensure user owns the memory

      if (deleteError) {
        console.error('Error deleting memory:', deleteError);
        return new Response(JSON.stringify({ error: 'Failed to delete memory' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (count === 0) {
         console.log('Memory not found or access denied for delete.');
         return new Response(JSON.stringify({ error: 'Memory not found or access denied' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.log(`Memory ${memoryId} deleted successfully.`);
      return new Response(JSON.stringify({ message: 'Memory deleted successfully' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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