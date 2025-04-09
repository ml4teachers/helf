import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Importiere Zod, wenn du den Body hier validieren willst (empfohlen)
import { z } from 'https://deno.land/x/zod@v3.23.4/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Optional: Zod Schema zur Validierung des Request Bodys (sessionPlan)
// Passe dies an die tatsächliche Struktur an, die dein Frontend sendet
const exerciseSchema = z.object({
    name: z.string(),
    variation: z.string().optional().nullable(),
    details: z.string().optional().nullable(), // Altes Feld?
    type: z.string().optional().nullable(),
    exercise_order: z.number().int().optional(),
    notes: z.string().optional().nullable(),
    instructions: z.string().optional().nullable(),
    target_sets: z.union([z.string(), z.number()]).optional(), // Kann als String oder Zahl kommen
    target_reps: z.string().optional().nullable(),
    target_rpe: z.union([z.string(), z.number()]).optional().nullable(),
    target_weight: z.union([z.string(), z.number()]).optional().nullable(),
    // Füge 'sets'-Array hinzu, falls das Frontend existierende Sets mitschickt
    // sets: z.array(z.object({...})).optional(),
});

const sessionPlanSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  notes: z.string().optional().nullable(),
  exercises: z.array(exerciseSchema),
});

const requestBodySchema = z.object({
  sessionPlan: sessionPlanSchema,
});


console.log(`Function "session-update" booting up!`);

Deno.serve(async (req) => {
  console.log("Received Request URL:", req.url); // Log die eingehende URL
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  // Original route used POST, so we stick to that, although PUT/PATCH might be semantically better
  if (req.method !== 'POST') {
    console.log(`Method ${req.method} not allowed.`);
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log(`Handling POST request for session-update`);

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

    // 3. Request Body holen und validieren
    const body = await req.json();
    const validation = requestBodySchema.safeParse(body);
     if (!validation.success) {
       console.error('Invalid request body:', validation.error.flatten());
       return new Response(JSON.stringify({ error: 'Invalid request body', details: validation.error.errors }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }
    const sessionPlan = validation.data.sessionPlan;
    console.log('Received session plan data for update.');

    // 4. Datenbankfunktion aufrufen
    const { data: rpcData, error: rpcError } = await supabaseClient
      .rpc('update_session_details', {
        user_id_param: userId,
        session_id_param: sessionId,
        // Nur die Session-Metadaten übergeben
        session_data_param: {
             name: sessionPlan.name,
             type: sessionPlan.type,
             notes: sessionPlan.notes
        },
        // Das gesamte exercises Array übergeben
        exercises_param: sessionPlan.exercises
      });

    if (rpcError) {
      console.error('Error calling database function update_session_details:', rpcError);
      const errorMessage = rpcError.message || 'Database function execution failed';
       // Versuche, Statuscode aus DB-Fehler zu extrahieren, falls vorhanden
       const status = (rpcError as any)?.details?.httpStatus ?? 500;
      return new Response(JSON.stringify({ error: 'Failed to update session', details: errorMessage }), {
        status: status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

     // Prüfe auf Fehler, die von der DB-Funktion zurückgegeben wurden
     if (rpcData && rpcData.error) {
        console.error('Error returned from database function:', rpcData.error);
        return new Response(JSON.stringify({ error: rpcData.error }), {
          status: rpcData.status || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
     }

    console.log('Database function update_session_details executed successfully. Result:', rpcData);

    // 5. Erfolgsantwort senden
    return new Response(JSON.stringify(rpcData || { message: 'Session update processed.', sessionId: sessionId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing session update request:', error);
    return new Response(JSON.stringify({ error: 'Failed to process session update', message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 