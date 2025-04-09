// supabase/functions/assistant-main/index.ts

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { z } from 'https://esm.sh/zod@3.23.4'; // Keep Zod for input validation

console.log('Function "assistant-main" booting up!');

// --- Input Schemas ---
const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});
const requestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  currentSessionContext: z.object({ id: z.number() }).optional().nullable(),
});

// --- JSON Schema Definition for Session Plan (for the prompt) ---
const sessionPlanJsonSchemaForPrompt = `
{
  "type": "object",
  "properties": {
    "name": { "type": "string", "description": "Descriptive name for the session." },
    "type": { "type": "string", "description": "Type of session, e.g., 'strength', 'cardio'. Optional." },
    "notes": { "type": "string", "description": "General notes for the session. Optional." },
    "session_order": { "type": "integer", "description": "Order within a week, if part of a weekly plan. Optional." },
    "exercises": {
      "type": "array",
      "description": "List of exercises in the session.",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "description": "Name of the exercise." },
          "type": { "type": "string", "description": "Type of exercise, e.g., 'weight', 'bodyweight', 'cardio'. Optional." },
          "variation": { "type": "string", "description": "Specific variation of the exercise. Optional." },
          "exercise_order": { "type": "integer", "description": "Order of the exercise within the session (starting from 1)." },
          "target_sets": { "type": "integer", "description": "Target number of sets. Optional." },
          "target_reps": { "type": "string", "description": "Target repetitions, e.g., '10' or '8-12'. Optional." },
          "target_rpe": { "type": "number", "description": "Target Rate of Perceived Exertion (1-10). Optional." },
          "target_duration": { "type": "string", "description": "Target duration, e.g., '30s', '5min'. Optional." },
          "target_weight": { "type": "string", "description": "Target weight, e.g., 'Bodyweight', '50kg'. Optional." },
          "rest_period": { "type": "string", "description": "Rest period between sets, e.g., '60s'. Optional." },
          "instructions": { "type": "string", "description": "Execution instructions. Optional." },
          "notes": { "type": "string", "description": "Specific notes for the exercise. Optional." }
        },
        "required": ["name", "exercise_order"],
        "additionalProperties": false
      },
      "minItems": 1
    }
  },
  "required": ["name", "exercises"],
  "additionalProperties": false
}`;
// TODO: Define similar JSON schemas for weekPlan, trainingPlan, exerciseUpdate if needed for the prompt.

// --- Database Helper Functions ---
async function getUserProfile(supabase: SupabaseClient, userId: string) {
    console.log("Fetching user profile...");
    const { data, error } = await supabase
        .from('user_profiles')
        .select('name, goal, experience_level')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        console.error('Error fetching user profile:', error.message);
        return null;
    }
    console.log("User profile data:", data);
    return data;
}
async function getSessionDetails(supabase: SupabaseClient, sessionId: number) {
     console.log(`Fetching details for session ${sessionId}...`);
    const { data, error } = await supabase
        .from('user_sessions')
        .select(`id, name, date, notes, user_exercise_entries (id, exercise_order, target_sets, target_reps, target_rpe, target_duration, target_weight, rest_period, notes, exercises ( id, name, type, variation ), user_exercise_sets ( id, set_number, reps, weight, duration, rpe, completed_at ))`)
        .eq('id', sessionId)
        .maybeSingle();
    if (error) {
        console.error(`Error fetching session details for ID ${sessionId}:`, error.message);
        return null;
    }
     if (!data) {
         console.warn(`Session with ID ${sessionId} not found.`);
         return null;
     }
    console.log(`Session ${sessionId} details fetched successfully.`);
    return data;
}
// Note: updateExerciseAction might not be directly callable with JSON mode output easily
// Consider having the AI generate a specific "action request" JSON or handle updates differently.
async function updateExerciseAction(supabase: SupabaseClient, userExerciseEntryId: number, updateData: any) {
    console.log(`Attempting to update user_exercise_entry ${userExerciseEntryId} with:`, updateData);
    const { data, error, count } = await supabase
        .from('user_exercise_entries')
        .update(updateData)
        .eq('id', userExerciseEntryId)
        .select('id')
        .single();
    if (error) {
        console.error(`Error updating user_exercise_entry ${userExerciseEntryId}:`, error.message);
        return { success: false, message: `Database error updating exercise entry: ${error.message}` };
    }
    if (!data || count === 0) {
         console.warn(`No user_exercise_entry found with ID ${userExerciseEntryId} to update.`);
         return { success: false, message: `Exercise entry with ID ${userExerciseEntryId} not found.` };
    }
    console.log(`User exercise entry ${userExerciseEntryId} updated successfully.`);
    return { success: true, message: `Exercise entry ${userExerciseEntryId} updated successfully.` };
}

// --- Prompt Creation (Includes Schema instruction) ---
function createSystemPrompt(profile: any, sessionData: any): string {
      let prompt = `You are Helf, a helpful AI assistant specializing in personalized fitness coaching. Be encouraging and clear.
Current Date: ${new Date().toISOString().split('T')[0]}

USER PROFILE:`;
       if (profile) {
         prompt += `\n- Name: ${profile.name || 'N/A'}`;
         prompt += `\n- Goal: ${profile.goal || 'N/A'}`;
         prompt += `\n- Experience: ${profile.experience_level || 'N/A'}`;
       } else {
         prompt += "\n- No profile data available.";
       }
       if (sessionData) {
           prompt += `\n\nCURRENT SESSION CONTEXT (ID: ${sessionData.id}):`;
           prompt += `\n- Session Name: ${sessionData.name || 'N/A'}`;
           prompt += `\n- Date: ${sessionData.date || 'N/A'}`;
           const exerciseCount = sessionData.user_exercise_entries?.length || 0;
           prompt += `\n- Contains ${exerciseCount} exercises.`;
           if (exerciseCount > 0 && sessionData.user_exercise_entries) {
               const exerciseNames = sessionData.user_exercise_entries.slice(0, 3).map((entry: any) => entry.exercises?.name || 'Unknown Exercise').join(', ');
               prompt += ` Exercises include: ${exerciseNames}${exerciseCount > 3 ? '...' : ''}.`;
           }
       }

      // --- Specific Instruction for JSON Output ---
      prompt += `\n\nOUTPUT FORMATTING:\n- ALWAYS respond with a valid JSON object. Do NOT wrap the JSON in markdown code blocks (\`\`\`json).\n- If you are creating a session plan based on the user request, the JSON object MUST strictly adhere to the following JSON Schema:\n\`\`\`json\n${sessionPlanJsonSchemaForPrompt}\n\`\`\`\n- If creating a different type of plan (week, training) or an update, use the appropriate schema (currently only sessionPlan schema is fully defined here).\n- Include a brief, user-friendly introductory sentence BEFORE the JSON object in your response.`;

      return prompt;
}


// --- Main Function Logic (Simplified) ---
// @ts-ignore: Ignore Deno type errors for deployment compatibility
Deno.serve(async (req: Request) => {
      // Handle CORS preflight requests
      if (req.method === 'OPTIONS') {
        // @ts-ignore: Ignore Deno type errors for deployment compatibility
        return new Response('ok', { headers: corsHeaders });
      }

      console.log(`Handling ${req.method} request for assistant-main`);
      const requestStart = Date.now();

      if (req.method !== 'POST') {
         // @ts-ignore: Ignore Deno type errors for deployment compatibility
         return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      try {
        // 1. Authentication & Authorization
        const authHeader = req.headers.get('Authorization');
        // @ts-ignore: Ignore Deno type errors for deployment compatibility
        if (!authHeader) return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const supabaseClient = createClient(
            // @ts-ignore: Ignore Deno type errors for deployment compatibility
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore: Ignore Deno type errors for deployment compatibility
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
             { global: { headers: { Authorization: authHeader } } }
            );
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        // @ts-ignore: Ignore Deno type errors for deployment compatibility
        if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const userId = user.id;
        console.log('User authenticated:', userId);

        // 2. Parse and Validate Request Body
        let reqData;
        try {
            const rawBody = await req.json();
            reqData = requestSchema.parse(rawBody);
        } catch (e: any) {
             const errorDetails = e instanceof z.ZodError ? e.format() : String(e);
             console.error("Request body validation failed:", errorDetails);
             // @ts-ignore: Ignore Deno type errors for deployment compatibility
             return new Response(JSON.stringify({ error: 'Invalid request body', details: errorDetails }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { messages, currentSessionContext } = reqData;
        console.log(`Received ${messages.length} messages. Session context ID: ${currentSessionContext?.id}`);

        // 3. Fetch Dynamic Context
        const [userProfile, sessionDetails] = await Promise.all([
            getUserProfile(supabaseClient, userId),
            currentSessionContext?.id ? getSessionDetails(supabaseClient, currentSessionContext.id) : Promise.resolve(null)
        ]);
        console.log("Fetched dynamic context (Profile, Session).");

        // 4. Get OpenAI API Key
        // @ts-ignore: Ignore Deno type errors for deployment compatibility
        const apiKey = Deno.env.get("OPENAI_API_KEY");
         if (!apiKey) throw new Error("OpenAI API key is missing..."); // Simplified error

        // 5. Construct Messages for API
        const systemPrompt = createSystemPrompt(userProfile, sessionDetails);
        const messagesForAPI = [
            { role: "system", content: systemPrompt },
            ...messages.map((m: z.infer<typeof messageSchema>) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        // 6. Call OpenAI API using fetch with JSON Mode
        const modelName = 'gpt-4o-mini'; // Or your preferred model
        let aiResponseContent: string | null = null;
        let finalResult: { content: string; success: boolean; message?: string; structuredData?: any } = { content: '', success: false }; // Initialize success as false
        const aiStartTime = Date.now();

        try {
            console.log(`Sending ${messagesForAPI.length} messages to OpenAI model ${modelName} with JSON mode...`);
            // @ts-ignore: Ignore Deno type errors for deployment compatibility
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: messagesForAPI,
                    temperature: 0.7,
                    response_format: { "type": "json_object" }, // Enforce valid JSON output
                }),
            });

             console.log(`OpenAI API response status: ${response.status}`);

            if (!response.ok) {
                 const errorBody = await response.json().catch(() => ({ error: { message: "Failed to parse error response" } }));
                 const errorMessage = errorBody?.error?.message || `HTTP error ${response.status}`;
                 console.error("OpenAI API Error:", JSON.stringify(errorBody));
                 throw new Error(`OpenAI API request failed: ${errorMessage}`);
            }

            const responseData = await response.json();

            if (responseData.choices && responseData.choices.length > 0 && responseData.choices[0].message && responseData.choices[0].message.content) {
                aiResponseContent = responseData.choices[0].message.content;
            } else {
                 console.warn("OpenAI response format unexpected:", responseData);
                 throw new Error("Invalid response structure from OpenAI API.");
            }

            if (aiResponseContent === null) {
                 throw new Error("No content received from OpenAI API.");
            }

            console.log(`AI response received in ${Date.now() - aiStartTime}ms. Raw content length: ${aiResponseContent.length}`);
            console.log(`AI raw response content: ${aiResponseContent.substring(0, 500)}...`);

            // 7. Parse the JSON response
            try {
                 const parsedJson = JSON.parse(aiResponseContent);
                 console.log("Successfully parsed JSON response from AI.");
                 // Basic check if it looks like a session plan (adapt as needed)
                 if (parsedJson && parsedJson.name && Array.isArray(parsedJson.exercises)) {
                     finalResult = {
                         // We still need the introductory text. Let's try finding the JSON start
                         // and taking the text before it. This is heuristic.
                         content: aiResponseContent, // Return raw response for now, client can parse
                         success: true,
                         structuredData: parsedJson
                     };
                      console.log("Response likely contains a valid session plan structure.");
                 } else {
                     console.warn("Parsed JSON does not seem to match the expected session plan structure.");
                     // Return the raw content but mark as failure due to structure mismatch
                      finalResult = {
                         content: aiResponseContent,
                         success: false,
                         message: "AI returned valid JSON, but it doesn't match the expected session plan structure."
                     };
                 }

            } catch (parseError: any) {
                 console.error("Failed to parse JSON response from AI:", parseError);
                 console.error("Raw AI response content that failed parsing:", aiResponseContent);
                 finalResult = { content: aiResponseContent, success: false, message: `Failed to parse AI JSON response: ${parseError.message}` };
            }

        } catch (fetchOrApiError: any) {
            console.error(`Error during OpenAI API call:`, fetchOrApiError);
            finalResult = { content: "Sorry, I encountered an error communicating with the AI service. Please try again.", success: false, message: `API Error: ${fetchOrApiError.message}` };
        }

        // 8. Return Final Result
        console.log(`Assistant main finished in ${Date.now() - requestStart}ms. Final Success: ${finalResult.success}`);
         // @ts-ignore: Ignore Deno type errors for deployment compatibility
        return new Response(JSON.stringify(finalResult), {
          status: finalResult.success ? 200 : 500, // Simple status for now
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error: any) {
        console.error('Critical error in assistant-main function:', error);
        const processingTime = Date.now() - requestStart;
         // @ts-ignore: Ignore Deno type errors for deployment compatibility
        return new Response(JSON.stringify({ error: 'Internal server error', message: error.message, processingTime }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    });
