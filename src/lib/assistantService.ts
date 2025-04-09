// src/lib/assistantService.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { Database, UserAssistantMemory } from "./types"; // Adjust path if needed
import { createSystemPrompt } from "./prompts"; // Adjust path if needed
import { getUserTrainingData } from "./trainingModulesNew/userTraining"; // Adjust path
import { getSessionWithExercises } from "./trainingModulesNew/sessionManagement"; // Import from correct location
import { getUserPreferredModel, getUserMemories } from "./assistant/utils"; // Import from new utils file
import { processAssistantMessage } from "./assistant/responseProcessor"; // Import from new processor file

/**
 * Generates a response from the assistant, including fetching context,
 * calling the AI model, and processing the response for structured data.
 */
export async function generateAssistantResponse(
  supabase: SupabaseClient<Database>,
  userId: string,
  messages: { role: string; content: string }[],
  currentSessionContext: { id: number } | null = null, // Renamed for clarity
): Promise<{
  content: string;
  success?: boolean;
  message?: string;
  structuredDataType?: string;
}> {
  // Match return type of processor
  try {
    // Fetch user data, preferences, and memories in parallel
    const [userData, preferredModel, userMemories] = await Promise.all([
      getUserTrainingData(supabase, userId),
      getUserPreferredModel(supabase, userId),
      getUserMemories(supabase, userId),
    ]);

    console.log(
      `Using model: ${preferredModel}. Found ${userMemories.length} active memories.`,
    );

    // Fetch current session details if context is provided
    let sessionDataContext = null;
    if (currentSessionContext?.id) {
      try {
        // Use the imported getSessionWithExercises function
        const { session, exercises } = await getSessionWithExercises(
          supabase,
          currentSessionContext.id,
        );
        // Ensure session is not null before assigning
        if (session) {
          sessionDataContext = { session, exercises };
          console.log(
            `Workspaceed context for session ID: ${currentSessionContext.id}`,
          );
        } else {
          console.warn(
            `Session context requested for ID ${currentSessionContext.id}, but session not found.`,
          );
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(
          `Error fetching current session context (ID: ${currentSessionContext.id}):`,
          errorMessage,
        );
        // Continue without session context if fetch fails
      }
    }

    // Create the system prompt with all available context
    const systemPrompt = createSystemPrompt(userData, sessionDataContext); // Pass fetched context

    const formattedMemories =
      userMemories.length > 0
        ? userMemories
            .map((mem) => `- (${mem.memory_type}): ${mem.content}`)
            .join("\n")
        : "No specific memories recorded yet.";

    // Construct the full message list for the AI model
    const allMessages = [
      { role: "system" as const, content: systemPrompt },
      // Add context blocks if they provide useful info, keep concise if possible
      {
        role: "system" as const,
        content: `USER CONTEXT:\n${JSON.stringify(userData, null, 2)}`,
      }, // Maybe summarize userData first?
      { role: "system" as const, content: `MEMORY:\n${formattedMemories}` },
      ...(sessionDataContext
        ? [
            {
              role: "system" as const,
              content: `CURRENT SESSION:\n${JSON.stringify(sessionDataContext, null, 2)}`,
            },
          ]
        : []),
      // Append user and previous assistant messages
      ...messages.map((msg) => ({
        role: msg.role as "user" | "assistant", // Ensure correct role type
        content: msg.content,
      })),
    ];

    // Generate AI response with detailed logging
    console.log(
      `Sending ${allMessages.length} messages to ${preferredModel}...`,
    );
    const requestStartTime = Date.now();

    // Use regular try-catch for more detailed error logging
    let response;
    try {
      response = await generateText({
        model: openai.responses(preferredModel), // Use openai function directly
        messages: allMessages,
        temperature: 0.7, // Lower for more reliability
      });

      const requestDuration = Date.now() - requestStartTime;
      console.log(
        `AI response received after ${requestDuration}ms, length: ${response.text.length} chars`,
      );

      // Add response metadata for logging
      if (!response.meta) response.meta = {};
      response.meta.duration = requestDuration;
      response.meta.timestamp = new Date().toISOString();
    } catch (error) {
      const requestDuration = Date.now() - requestStartTime;
      console.error(
        `AI request failed after ${requestDuration}ms:`,
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : String(error),
      );

      // Enhance error message for diagnosis
      if (error instanceof Error) {
        error.message = `AI request failed after ${requestDuration}ms: ${error.message}`;
      }

      throw error;
    }

    // Process the raw text response for structured data (validation, actions)
    const processedResponse = await processAssistantMessage(
      supabase,
      userId,
      response.text, // Pass the raw text content
    );

    console.log("Processed assistant response.");
    return processedResponse; // Return the result from the processor
  } catch (error) {
    // Catch errors during context fetching or AI call
    // FIX for ts18046: Use instanceof
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in generateAssistantResponse:", errorMessage);
    // Return a structured error response
    return {
      content: `Sorry, an error occurred while generating the response: ${errorMessage}`,
      success: false,
      message: errorMessage,
    };
  }
}
