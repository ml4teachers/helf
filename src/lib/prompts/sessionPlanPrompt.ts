/**
 * Prompt for generating a single training session
 * This provides guidelines for creating a structured training session
 */
export const sessionPlanPrompt = `
GENERATE SINGLE TRAINING SESSION:

When the user requests a specific training session or the next session of an existing plan needs to be generated, create a complete session in JSON format (see jsonSchemas for the exact structure).

IMPORTANT REQUIREMENTS:

1. Each session MUST contain a balanced mix of exercise types:
   - 1-2 Main Exercises (main exercises like Squat, Bench, Deadlift or variations)
   - 1-2 Secondary Exercises (secondary exercises that support the main exercises)
   - 2-4 Accessory Exercises (accessory exercises for weaknesses, prevention, hypertrophy)
   - For GPP days (General Physical Preparedness): Focus on accessories and cardio (HIIT or LISS)

2. Include the following elements for EACH exercise:
   - Appropriate "name" from common strength exercises
   - Specific "variation" (pause, tempo, close-grip, etc.)
   - "exercise_order" to specify the exercise sequence
   - Number of "target_sets"
   - Specific "target_reps" (fixed or range like "5-8" or "8-12")
   - Clear "target_rpe" value
   - Helpful "instructions" with technique tips and ALWAYS specifying the exercise type (Main, Secondary, Accessory)
   - Include appropriate "type" value based on the exercise measurement method:
     * "weight" for exercises measured by weight (default for most strength exercises)
     * "time" for timed exercises (planks, hangs, cardio, etc.)
     * "reps" for exercises measured only by repetitions (typically bodyweight exercises)
     * "cal" for exercises measured by calories burned
   - User can add "notes" during the session

3. Correctly break down complex rep schemes into separate exercises with different parameters:
   - If an exercise scheme includes different sets (e.g., Squat: 1×1@8 + 3×5@7), create separate entries:
   - { "name": "Squat", "target_sets": 1, "target_reps": "1", "target_rpe": 8, "instructions": "Main exercise - Top single" }
   - { "name": "Squat", "target_sets": 3, "target_reps": "5", "target_rpe": 7, "instructions": "Main exercise - Working sets" }

4. Consider the following when generating:
   - The current training plan phase and the user's focus
   - User's readiness values (if available)
   - Previous workouts in the training history
   - The specific day of the week and its position in the training cycle

5. Adjust volume and intensity based on readiness values:
   - Low readiness (1-4): Reduce volume or intensity by 10-20%
   - Medium readiness (5-7): Maintain planned volume and intensity
   - High readiness (8-10): Consider slight increases in volume or intensity

6. When creating a new session based on a completed one:
   - The new session should represent a progressive increase
   - Consider the user's performance in the previous session
   - CRITICAL: Carefully read and consider the user's exercise notes from the previous session - these contain important feedback like pain, discomfort, or technique issues
   - If a user noted discomfort or pain with a specific exercise, either modify the exercise, reduce the load, or suggest an alternative exercise
   - Ensure you maintain appropriate progression - generally 2.5-5% weight increase for successful exercises
   - Ensure variety and balance in exercise selection
   - Consider the current training phase in the overall plan
   - The new session should be for the NEXT week (i.e., if completing Week 3 Session 2, create Week 4 Session 2)

7. Always preserve user notes when making exercise recommendations:
   - If a user added a note like "Shoulder hurt, used lighter weight" to Bench Press, reflect this in your new session
   - Include specific guidance in the exercise instructions that acknowledge and address user feedback
   - Example: If user noted shoulder pain during Bench Press, your new session might include instructions like "Due to previous shoulder discomfort, use a slightly wider grip or consider floor press as an alternative if pain persists"

Start with a brief explanation of your training session and how it fits into the overall plan, before creating the JSON object with the type "sessionPlan".
`;