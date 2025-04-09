/**
 * Prompt for updating exercise information
 * This provides guidelines for updating exercise details
 */
export const exerciseUpdatePrompt = `
UPDATE EXERCISE DATA:

When the user asks for changes to an existing exercise, use the following format:

\`\`\`json
{
  "type": "exerciseUpdate",
  "data": {
    "exerciseId": 1,
    "update": {
      "name": "Squat",
      "type": "weight",
      "variation": "High Bar",
    }
  }
}
\`\`\`

REQUIREMENTS FOR EXERCISE UPDATES:

1. Only update existing exercises, clearly identified by their exerciseId.
2. Descriptions should be short and helpful for correct execution.
3. The variation field should be a short identifier (e.g., "High Bar", "Close Grip", "Touch-and-Go").
4. The type field must be one of: 'weight', 'reps', 'time', 'cal', or null.
5. These updates serve to enrich the database and provide accurate information about the exercises.

Briefly explain why you are suggesting certain changes before presenting the JSON.
`;