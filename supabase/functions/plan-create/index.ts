import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.23.4/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Schema matching AssistantPlan structure (from planManagement.ts)
const assistantSessionSchema = z.object({ /* Define session structure if needed, but not used in create */ });
const assistantPlanWeekSchema = z.object({
  week_number: z.number().int().positive(),
  focus: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  sessions: z.array(assistantSessionSchema).optional(), // Sessions are optional in input, not created here
});
const assistantPlanSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  description: z.string().optional().nullable(),
  goal: z.string().optional().nullable(),
  weeks: z.array(assistantPlanWeekSchema), // Weeks array is required
  metadata: z.record(z.any()).optional().nullable(),
});

// Schema for the overall request body
const requestBodySchema = z.object({
  trainingPlan: z.object({
    data: assistantPlanSchema
  })
});

console.log(`Function "plan-create" booting up!`);

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

  console.log(`Handling POST request for plan-create`);

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

    // 2. Validate Request Body
    const body = await req.json();
    const validation = requestBodySchema.safeParse(body);
    if (!validation.success) {
      console.error('Invalid input:', validation.error.flatten());
      return new Response(JSON.stringify({ error: 'Invalid input', details: validation.error.errors }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const planData = validation.data.trainingPlan.data;
    console.log(`Input validated for new plan: "${planData.name}" with ${planData.weeks.length} weeks`);

    // --- Create Training Plan in Database (following planManagement.ts logic) ---

    // 3. Create the user plan entry
    const { data: userPlan, error: planError } = await supabaseClient
      .from('user_plans')
      .insert({
        user_id: userId,
        name: planData.name,
        description: planData.description || '',
        goal: planData.goal || '',
        status: 'active', // Set as active initially
        source: 'assistant', // Assuming source is assistant
        metadata: planData.metadata || { start_date: new Date().toISOString() }
      })
      .select()
      .single();

    if (planError) {
      console.error('Error creating user plan:', planError);
      throw new Error(`Failed to create plan entry: ${planError.message}`);
    }
    const planId = userPlan.id;
    console.log(`Created user plan with ID ${planId}`);

    // 4. Create plan weeks (Iterate through weeks in planData)
    for (const weekData of planData.weeks) {
      const { data: planWeek, error: weekError } = await supabaseClient
        .from('user_plan_weeks')
        .insert({
          plan_id: planId,
          week_number: weekData.week_number,
          focus: weekData.focus || '',
          instructions: weekData.instructions || ''
        })
        .select('id') // Only select id, as we don't need the full week object here
        .single();

      if (weekError) {
        // Log error but continue processing other weeks (as in original code)
        console.error(`Error creating week ${weekData.week_number} for plan ${planId}:`, weekError);
        // Optionally, consider if you want to roll back the plan creation on week error
      } else {
        console.log(`Created week ${weekData.week_number} (ID: ${planWeek.id}) for plan ${planId}`);
      }
    }
    // Note: Sessions are intentionally NOT created here, following planManagement.ts

    // 5. Deactivate any previously active plans for this user
    const { error: deactivateError } = await supabaseClient
      .from('user_plans')
      .update({ status: 'archived' })
      .eq('user_id', userId)
      .neq('id', planId) // Don't deactivate the plan we just created
      .eq('status', 'active'); // Only deactivate currently active plans

    if (deactivateError) {
      // Log error but consider the main operation successful
      console.error('Error deactivating previous plans:', deactivateError);
    } else {
      console.log(`Deactivated previous active plans for user ${userId}`);
    }

    // 6. Send success response
    return new Response(JSON.stringify({ message: `Training plan "${planData.name}" created successfully`, planId: planId }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error creating training plan:', error);
    return new Response(JSON.stringify({ error: 'Failed to create training plan', message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 