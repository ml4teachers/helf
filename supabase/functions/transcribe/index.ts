import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log('Function "transcribe" booting up!');

// Note: Supabase Edge Functions have memory/duration limits.
// Large audio files might exceed these limits. Consider alternatives
// like client-side transcription or direct uploads to storage + background processing
// for very large files. Default limit is often around 1MB request body.

// @ts-ignore: Ignore Deno type errors for deployment compatibility
Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
     // @ts-ignore: Ignore Deno type errors for deployment compatibility
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(`Handling ${req.method} request for transcribe`);

  if (req.method !== 'POST') {
     // @ts-ignore: Ignore Deno type errors for deployment compatibility
     return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    // 1. Authentication (Optional but recommended)
    const authHeader = req.headers.get('Authorization');
     // @ts-ignore: Ignore Deno type errors for deployment compatibility
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // We don't strictly need the Supabase client here if we only call OpenAI,
    // but auth validation is good practice.
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
    console.log('User authenticated:', user.id);


    // 2. Get OpenAI API Key
    // @ts-ignore: Ignore Deno type errors for deployment compatibility
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
        console.error("CRITICAL: OPENAI_API_KEY is missing!");
        throw new Error("OpenAI API key is missing in the function environment.");
    }

    // 3. Process FormData and Extract Audio File
    let audioFile: File | null = null;
    try {
        const formData = await req.formData();
        const file = formData.get('audio');
        if (!file) {
             // @ts-ignore: Ignore Deno type errors for deployment compatibility
            return new Response(JSON.stringify({ error: 'Missing "audio" field in FormData' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (!(file instanceof File)) {
             // @ts-ignore: Ignore Deno type errors for deployment compatibility
            return new Response(JSON.stringify({ error: '"audio" field is not a file' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        audioFile = file;
         console.log(`Received audio file: ${audioFile.name}, Size: ${audioFile.size} bytes, Type: ${audioFile.type}`);
    } catch (e: any) {
        console.error("Error processing FormData:", e);
         // @ts-ignore: Ignore Deno type errors for deployment compatibility
        return new Response(JSON.stringify({ error: 'Invalid FormData', details: e.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Call OpenAI Audio Transcription API using fetch
    const modelName = 'whisper-1'; // Use the standard whisper model
    let transcriptionText: string | null = null;
    const transcriptionStartTime = Date.now();

    try {
         console.log(`Sending audio data to OpenAI model ${modelName}...`);

        // OpenAI API expects FormData for file uploads
        const openaiFormData = new FormData();
        openaiFormData.append('file', audioFile, audioFile.name); // Crucial: Provide filename
        openaiFormData.append('model', modelName);
        openaiFormData.append('response_format', 'text'); // Get plain text back

         // @ts-ignore: Ignore Deno type errors for deployment compatibility
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                // Content-Type is set automatically by fetch for FormData
                'Authorization': `Bearer ${apiKey}`,
            },
            body: openaiFormData, // Send FormData directly
        });

        console.log(`OpenAI API response status: ${response.status}`);

        if (!response.ok) {
             const errorText = await response.text(); // Get error text for better debugging
             console.error("OpenAI API Error Response Text:", errorText);
             // Try parsing as JSON, fallback to text
             let errorMessage = `HTTP error ${response.status}`;
             try {
                const errorBody = JSON.parse(errorText);
                errorMessage = errorBody?.error?.message || errorMessage;
             } catch {
                errorMessage = errorText || errorMessage;
             }
             throw new Error(`OpenAI API request failed: ${errorMessage}`);
        }

        // Response is plain text because we requested response_format: 'text'
        transcriptionText = await response.text();

        console.log(`Transcription received in ${Date.now() - transcriptionStartTime}ms.`);
        console.log(`Transcription result (first 100 chars): ${transcriptionText.substring(0, 100)}...`);

    } catch (fetchOrApiError: any) {
        console.error(`Error during OpenAI API call:`, fetchOrApiError);
         // @ts-ignore: Ignore Deno type errors for deployment compatibility
         return new Response(JSON.stringify({ error: "Failed to transcribe audio", details: fetchOrApiError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 5. Return Result
     // @ts-ignore: Ignore Deno type errors for deployment compatibility
    return new Response(JSON.stringify({ text: transcriptionText }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Critical error in transcribe function:', error);
     // @ts-ignore: Ignore Deno type errors for deployment compatibility
    return new Response(JSON.stringify({ error: 'Internal server error', message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 