import { baseSystemPrompt } from './baseSystemPrompt';
import { trainingPlanPrompt } from './trainingPlanPrompt';
import { sessionPlanPrompt } from './sessionPlanPrompt';
import { exerciseUpdatePrompt } from './exerciseUpdatePrompt';
import { weekPlanPrompt } from './weekPlanPrompt';
import { jsonSchemas } from './schemas';

export {
  baseSystemPrompt,
  trainingPlanPrompt,
  sessionPlanPrompt,
  exerciseUpdatePrompt,
  weekPlanPrompt,
  jsonSchemas
};

/**
 * Creates a complete system prompt by combining the base prompt with specific feature prompts
 * @param userData User training data to include in the prompt
 * @param sessionData Current session data (if available)
 * @param includeFeatures Array of feature prompts to include
 * @returns Complete system prompt
 */
export function createSystemPrompt(
  userData: any,
  sessionData: any = null,
  includeFeatures: ('trainingPlan' | 'sessionPlan' | 'exerciseUpdate' | 'weekPlan')[] = ['trainingPlan', 'sessionPlan', 'exerciseUpdate', 'weekPlan']
): string {
  const today = new Date().toISOString().split("T")[0];
  let prompt = baseSystemPrompt.replace("{{TODAY}}", today);
  
  // Add user data
  prompt += `\n\nUSER DATA:
${JSON.stringify(userData, null, 2)}`;

  // Add current session context if available
  if (sessionData) {
    prompt += `\n\nCURRENT TRAINING SESSION:
The user is currently in this training session:
${JSON.stringify(sessionData, null, 2)}

When the user asks questions during a workout, consider the current exercises and provide specific advice for the current training.`;
  }

  // Add feature-specific prompts based on includeFeatures
  if (includeFeatures.includes('trainingPlan')) {
    prompt += `\n\n${trainingPlanPrompt}`;
  }
  
  if (includeFeatures.includes('sessionPlan')) {
    prompt += `\n\n${sessionPlanPrompt}`;
  }
  
  if (includeFeatures.includes('exerciseUpdate')) {
    prompt += `\n\n${exerciseUpdatePrompt}`;
  }
  
  if (includeFeatures.includes('weekPlan')) {
    prompt += `\n\n${weekPlanPrompt}`;
  }

  // Add JSON schemas at the end
  prompt += `\n\n${jsonSchemas}`;

  return prompt;
}