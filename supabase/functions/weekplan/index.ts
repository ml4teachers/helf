import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.23.4/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Schema zur Validierung des weekPlan-Objekts
const sessionSchema = z.object({ /* ... dein Session-Schema ... */ }); // Definiere dies genauer bei Bedarf
const weekPlanSchema = z.object({
  week_number: z.number().int().positive("week_number must be a positive integer"), // Sicherstellen, dass es eine positive Zahl ist
  focus: z.string().optional().nullable(),
  sessions: z.array(z.any()), // Halte Session-Validierung einfach oder detailliere sie
});

// Schema für den gesamten Request Body
const requestBodySchema = z.object({
  weekPlan: weekPlanSchema, // weekPlan muss dem Schema entsprechen
});

console.log(`Function "weekplan" booting up!`);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log(`Method ${req.method} not allowed.`);
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log(`Handling POST request for weekplan`);

  try {
    // 1. Authenticate User
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Client nur zur Authentifizierung und zum RPC-Aufruf
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

    // 2. Request Body holen UND VALIDIEREN
    const weekPlanBody = await req.json();
    const validation = requestBodySchema.safeParse(weekPlanBody);
    if (!validation.success) {
      console.error('Invalid weekPlan input:', validation.error.flatten());
      return new Response(JSON.stringify({ error: 'Invalid weekPlan input', details: validation.error.errors }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const validatedWeekPlan = validation.data.weekPlan;
    console.log('Received and validated week plan for week:', validatedWeekPlan.week_number);

    // 3. Datenbankfunktion aufrufen (mit validierten Daten)
    const { data: rpcData, error: rpcError } = await supabaseClient
      .rpc('create_week_sessions_from_plan', {
        user_id_param: userId,
        week_plan_param: validatedWeekPlan
      });

    if (rpcError) {
      console.error('Error calling database function:', rpcError);
      const errorMessage = rpcError.message || 'Database function execution failed';
      const errorDetails = (rpcError as any).details || (rpcError as any).hint || '';
      return new Response(JSON.stringify({ error: 'Failed to process week plan', details: `${errorMessage} ${errorDetails}`.trim() }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Database function executed successfully. Result:', rpcData);

    // 4. Erfolgsantwort senden (Ergebnis der DB-Funktion zurückgeben)
    return new Response(JSON.stringify({
        message: `Week plan for week ${validatedWeekPlan.week_number} processed successfully.`,
        result: rpcData
       }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing week plan request:', error);
    return new Response(JSON.stringify({ error: 'Failed to process week plan', message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 