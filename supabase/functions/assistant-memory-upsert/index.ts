import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { z } from 'https://esm.sh/zod@3.23.4'; // Use esm.sh for Zod

console.log('Function "assistant-memory-upsert" booting up!');

// Simple schema for expected input
const memoryInputSchema = z.object({
  memory_type: z.string().min(1, 'Memory type is required'),
  content: z.string().min(1, 'Content is required'),
});

// Simple schema for the table row (adjust if your type differs)
interface UserAssistantMemory {
    id: number;
    user_id: string;
    memory_type: string;
    content: string;
    active: boolean;
    created_at: string;
    updated_at: string;
}


Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(`Handling ${req.method} request for assistant-memory-upsert`);

  if (req.method !== 'POST') {
     return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

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

    // 2. Validate Input Body
    let body;
    try {
        body = await req.json();
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const validation = memoryInputSchema.safeParse(body);
    if (!validation.success) {
      return new Response(JSON.stringify({ error: 'Invalid input', details: validation.error.format() }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { memory_type, content } = validation.data;
    const trimmedContent = content.trim(); // Use trimmed content

    // 3. Upsert Logic (Find exact match, update timestamp, or insert)
     console.log(`Attempting upsert for memory type "${memory_type}"`);

     // Find existing active memory with exact same type and trimmed content
     const { data: existingMemory, error: findError } = await supabaseClient
       .from('user_assistant_memories')
       .select('id') // Select only id for check/update
       .eq('user_id', userId)
       .eq('memory_type', memory_type)
       .eq('content', trimmedContent) // Exact match on trimmed content
       .eq('active', true)
       .maybeSingle();

     if (findError) {
       console.error('Error finding existing memory:', findError);
       // Depending on policy, might not be fatal, attempt insert anyway
       // Return 500 for now to be safe
       return new Response(JSON.stringify({ error: 'Database error checking for memory', details: findError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }

     // If exact match found, update its timestamp
     if (existingMemory) {
       console.log(`Memory already exists (ID: ${existingMemory.id}), updating timestamp.`);
       const { data: updatedMemory, error: touchError } = await supabaseClient
         .from('user_assistant_memories')
         .update({ updated_at: new Date().toISOString() })
         .eq('id', existingMemory.id)
         .select() // Select the whole updated row
         .single();

       if (touchError) {
           console.error('Error touching memory timestamp:', touchError);
           // Non-critical? Return 500 for now
            return new Response(JSON.stringify({ error: 'Database error updating memory timestamp', details: touchError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       }
       console.log('Memory timestamp updated successfully.');
       return new Response(JSON.stringify(updatedMemory as UserAssistantMemory), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); // OK
     }

     // If no exact match, create a new memory entry
     console.log(`No exact memory match found, creating new entry.`);
     const { data: newMemory, error: insertError } = await supabaseClient
       .from('user_assistant_memories')
       .insert({
         user_id: userId,
         memory_type,
         content: trimmedContent, // Save trimmed content
         active: true, // Always active when added via this function
       })
       .select()
       .single();

     if (insertError) {
       console.error('Error creating memory:', insertError);
       return new Response(JSON.stringify({ error: 'Database error creating memory', details: insertError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }

     console.log('New memory created successfully.');
     return new Response(JSON.stringify(newMemory as UserAssistantMemory), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); // Created

  } catch (error) {
    console.error('Internal server error in assistant-memory-upsert:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 