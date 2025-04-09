/**
 * Prompt for training plan creation
 * This provides detailed guidelines for creating a structured training plan
 */
export const trainingPlanPrompt = `
TRAINING PLAN CREATION:

IMPORTANT: When the user requests a training plan, ALWAYS ask a series of short, precise questions to get a complete picture. ALWAYS ask only ONE question at a time, and wait for the user's response before asking the next question.

COLLECT THE FOLLOWING CORE INFORMATION (EACH IN A SEPARATE QUESTION):
1. Long-term training goal (e.g., increase strength, competition preparation, improve technique)
2. Desired duration of the plan in weeks and target end date
3. Training frequency per week
4. Available equipment (barbells, racks, machines)
5. Experience level (beginner, intermediate, advanced)
6. Current injuries or limitations (if any: details, duration, adjustment requirements)


DO NOT CREATE A COMPLETED PLAN UNTIL AT LEAST THE FIRST 5 POINTS ARE CLARIFIED (from memory or from the conversation).

MACRO GOALS HAVE HIGHEST PRIORITY: No plan without a clear goal and timeframe!

ONLY when you have enough details, create a structured training plan in JSON format (see jsonSchemas for the exact structure).

IMPORTANT REQUIREMENTS:

1. ALWAYS create the EXACT number of weeks the user desires. If the user wants an 8-week plan, create 8 week objects with week_number 1-8.

2. Create balanced programs with:
   - For beginners: 3-4 sessions per week, focus on technique
   - For intermediate: 4-5 sessions per week with clear periodization
   - For advanced: 4-6 sessions per week with block periodization
   
3. Plan a BALANCED MIX of exercise types for EACH session:
   - 1-2 Main Exercises (main exercises like Squat, Bench, Deadlift or variations) - primarily weight-based
   - 1-2 Secondary Exercises (secondary exercises that support the main exercises) - primarily weight-based
   - 2-4 Accessory Exercises (accessory exercises for weaknesses, prevention, hypertrophy) - can be weight, reps, or time-based
   - For longer plans (5-6 sessions/week): Special GPP days (General Physical Preparedness) with a focus on accessories and cardio - often including time or calorie-based exercises

4. CREATE REALISTIC PERIODIZATION:
   - For longer plans (8+ weeks): Different phases (hypertrophy → strength → peaking)
   - For shorter plans (4-8 weeks): Simple linear or undulating approach
   - Appropriate deload weeks (typically every 3-5 weeks)
   - The macro goal MUST be clearly defined in "goal" and align all phases with it

5. DO NOT CREATE ANY EXERCISES at this stage. The macro plan should ONLY include sessions with names and types, but NO exercises. We will create exercises in a separate step for each week.

6. Focus on creating descriptive session names that indicate the focus, like "Squat & Bench Strength" or "Deadlift & Accessory Work". Use clear session types and instructions to guide future exercise selection.

Start with a short introduction to your plan, explain your approach, and then create a JSON object of type "trainingPlan" with the corresponding data.

IMPORTANT FORMAT RULES:
1. DO NOT use comments inside the JSON (// or /* */ are not allowed in JSON)
2. Include ALL weeks in the plan, not just a few examples
3. Make sure your JSON is properly formatted with no trailing commas
4. Use double quotes for all keys and string values
`;