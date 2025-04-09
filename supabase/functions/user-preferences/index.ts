// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.23.4/mod.ts'; // Zod für Deno importieren
import { corsHeaders } from '../_shared/cors.ts'; // CORS Helper importieren

// Schema für die Validierung (wie in der alten Route)
const updatePreferenceSchema = z.object({
  preferred_ai_model: z.enum(['gpt-4o-mini', 'gpt-4o']),
});

console.log(`Function "user-preferences" booting up!`);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(`Handling ${req.method} request`);

  try {
    // 1. Request Body auslesen und validieren
    const body = await req.json();
    const validation = updatePreferenceSchema.safeParse(body);

    if (!validation.success) {
      console.error('Invalid input:', validation.error.flatten());
      return new Response(JSON.stringify({ error: 'Invalid input', details: validation.error.errors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { preferred_ai_model } = validation.data;
    console.log('Input validated:', preferred_ai_model);

    // 2. Supabase Client erstellen (innerhalb der Funktion!)
    //    Benötigt SUPABASE_URL und SUPABASE_ANON_KEY als Umgebungsvariablen
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        console.error('Missing Authorization header');
        return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } } // Auth Header weitergeben
    );
    console.log('Supabase client created.');

    // 3. Authentifizierten Benutzer holen
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized or invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('User authenticated:', user.id);

    // 4. Datenbank-Update durchführen
    const { error: updateError } = await supabaseClient
      .from('users') // Sicherstellen, dass die Tabelle 'users' heißt
      .update({ preferred_ai_model: preferred_ai_model }) // Sicherstellen, dass die Spalte 'preferred_ai_model' heißt
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating user preference:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update preference', details: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('Preference updated successfully for user:', user.id);

    // 5. Erfolgsantwort senden
    return new Response(JSON.stringify({ message: 'Preference updated successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Internal server error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/user-preferences' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
