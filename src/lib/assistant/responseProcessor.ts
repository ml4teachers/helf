// src/lib/assistant/responseProcessor.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { Database } from '@/lib/types'; // Adjust path as needed
import { convertLegacyPlanFormat } from '@/lib/trainingModulesNew/planManagement'; // Adjust path
import { updateExercise } from '@/lib/trainingModulesNew/exerciseManagement'; // Adjust path
import {
    trainingPlanSchema,
    legacyPlanSchema,
    sessionPlanSchema,
    weekPlanSchema,
    exerciseUpdateSchema,
    getZodErrorDetails // Import helper for Zod errors
} from './schemas'; // Import from the new schemas file

/**
 * Parses assistant response text for structured JSON data (plans, updates)
 * and performs validation or actions based on the JSON type.
 */
export async function processAssistantMessage(
  supabase: SupabaseClient<Database>,
  userId: string, // userId might be needed for some actions in the future
  responseText: string
): Promise<{ content: string; success?: boolean; message?: string; structuredDataType?: string }> {
  try {
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch || !jsonMatch[1]) {
      return { content: responseText }; // No JSON block found
    }

    const jsonString = jsonMatch[1];
    // console.log('Extracted JSON string:', jsonString);

    // Clean the JSON string
    let cleanedJsonString = jsonString
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/,\s*([\]}])/g, '$1'); // Remove trailing commas robustly
    // console.log('Cleaned JSON string:', cleanedJsonString);

    let structuredData;
    try {
      structuredData = JSON.parse(cleanedJsonString);
      // Basic validation: Check if it's an object and has a 'type' property
       if (typeof structuredData !== 'object' || structuredData === null || typeof structuredData.type !== 'string') {
            console.warn('Parsed JSON is not a valid object with a type property.');
            return { content: responseText }; // Treat as plain text if basic structure is wrong
       }
       console.log('Successfully parsed JSON data. Type:', structuredData.type);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // FIX for ts18046: Use instanceof Error
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      // Add position info if available
      const positionInfo = errorMessage.match(/position (\d+)/)?.[1];
      const contextFragment = positionInfo ? jsonString.substring(Math.max(0, parseInt(positionInfo) - 20), parseInt(positionInfo) + 20) : '';
      const detailedErrorMessage = `JSON parsing failed: ${errorMessage}${contextFragment ? ` near '${contextFragment}'` : ''}`;

      console.error(detailedErrorMessage);
      // Append error details to the content for debugging in chat (optional)
      // const debugContent = responseText + `\n\nDEBUG: (JSON Error: ${detailedErrorMessage})`;
      return {
        content: responseText, // Keep original response text for user
        success: false,
        message: detailedErrorMessage // Provide detailed error message
      };
    }

    const dataType = structuredData.type;

    // --- Process different JSON types ---

    // 1. Training Plan Validation
    if (dataType === 'trainingPlan') {
      try {
        trainingPlanSchema.parse(structuredData);
        console.log('Training plan validated successfully.');
        return {
          content: responseText, success: true,
          message: 'Training plan validated.', structuredDataType: dataType
        };
      } catch (validationError) {
        console.warn('New trainingPlan schema validation failed, trying legacy...');
        try {
          const validatedLegacyData = legacyPlanSchema.parse(structuredData);
          const convertedPlan = convertLegacyPlanFormat(validatedLegacyData.data);
          console.log('Legacy training plan validated and converted successfully.');
          const convertedJson = JSON.stringify({ type: 'trainingPlan', data: convertedPlan }, null, 2);
          const updatedText = responseText.replace(/```json\n([\s\S]*?)\n```/, `\`\`\`json\n${convertedJson}\n\`\`\``);
          return {
            content: updatedText, success: true,
            message: 'Legacy plan converted.', structuredDataType: dataType
          };
        } catch (legacyError) {
          // FIX for ts18046: Use helper for Zod errors
          const errorDetails = getZodErrorDetails(validationError instanceof z.ZodError ? validationError : legacyError);
          console.error('Plan validation failed for both schemas:\n', errorDetails);
          return {
            content: responseText, success: false, // Keep original responseText
            message: `Training plan validation failed:\n${errorDetails}`, structuredDataType: dataType
          };
        }
      }
    }

    // 2. Exercise Update (Execution)
    if (dataType === 'exerciseUpdate') {
      try {
        const validatedData = exerciseUpdateSchema.parse(structuredData);
        // Note: This action modifies the database directly based on AI suggestion.
        // Consider adding a confirmation step in the UI layer if this is too implicit.
        const result = await updateExercise(
          supabase,
          validatedData.data.exerciseId,
          validatedData.data.update
        );
        console.log('Exercise update executed:', result.message);
        // Modify response text to indicate success (or failure if error thrown)
        const updatedResponse = responseText.replace(/```json\n([\s\S]*?)\n```/, `\n(Action taken: ${result.message})\n`);
        return {
          content: updatedResponse, success: true,
          message: result.message, structuredDataType: dataType
        };
      } catch (error) {
         // FIX for ts18046: Use helper or instanceof
         const errorDetails = getZodErrorDetails(error);
         console.error('Error processing exercise update:', errorDetails);
         return {
           content: responseText, success: false,
           message: `Exercise update failed:\n${errorDetails}`, structuredDataType: dataType
         };
      }
    }

    // 3. Session Plan Validation
    if (dataType === 'sessionPlan') {
      try {
        sessionPlanSchema.parse(structuredData);
        console.log('Session plan validated successfully.');
        return {
          content: responseText, success: true,
          message: 'Session plan validated.', structuredDataType: dataType
        };
      } catch (error) {
         // FIX for ts18046: Use helper
         const errorDetails = getZodErrorDetails(error);
         console.error('Session plan validation failed:\n', errorDetails);
         return {
           content: responseText, success: false,
           message: `Session plan validation failed:\n${errorDetails}`, structuredDataType: dataType
         };
      }
    }

    // 4. Week Plan Validation
    if (dataType === 'weekPlan') {
      try {
        weekPlanSchema.parse(structuredData);
        console.log('Week plan validated successfully.');
        return {
          content: responseText, success: true,
          message: 'Week plan validated.', structuredDataType: dataType
        };
      } catch (error) {
         // FIX for ts18046: Use helper
         const errorDetails = getZodErrorDetails(error);
         console.error('Week plan validation failed:\n', errorDetails);
         return {
           content: responseText, success: false,
           message: `Week plan validation failed:\n${errorDetails}`, structuredDataType: dataType
         };
      }
    }

    // If JSON type is recognized but not handled above
    if (dataType) {
         console.warn(`JSON type "${dataType}" found but not processed.`);
    }

    // Return original text if JSON block type wasn't processed
    return { content: responseText };

  } catch (error) {
    // Catch errors during regex matching or initial checks
    // FIX for ts18046: Use instanceof
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Unexpected error processing assistant message:', errorMessage);
    // Avoid modifying response text here unless providing specific debug info
    return { content: responseText, success: false, message: `Error processing message: ${errorMessage}` };
  }
}