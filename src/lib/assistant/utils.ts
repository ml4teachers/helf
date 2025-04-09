// src/lib/assistant/utils.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { Database, UserAssistantMemory } from '@/lib/types'; // Adjust path as needed

// Helper function to get user's preferred model
export async function getUserPreferredModel(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<'gpt-4o-mini' | 'gpt-4o'> {
  const { data, error } = await supabase
    .from('users')
    .select('preferred_ai_model')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // Ignore 'no rows found' error
      console.error('Error fetching user model preference:', error);
  }

  const preferredModel = data?.preferred_ai_model;

  if (preferredModel === 'gpt-4o' || preferredModel === 'gpt-4o-mini') {
     return preferredModel;
  }

  if (preferredModel) {
       console.warn(`Invalid preferred_ai_model value found: ${preferredModel}. Defaulting to gpt-4o-mini.`);
  }
  return 'gpt-4o-mini'; // Default model
}


// Fetch User Memories
export async function getUserMemories(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UserAssistantMemory[]> {
  const { data, error } = await supabase
    .from('user_assistant_memories')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user memories:', error);
    return []; // Return empty array on error, don't break the chat
  }
  return data || [];
}