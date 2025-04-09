/**
 * Prompt for generating a week plan after a session is completed
 * This provides guidelines for creating a structured weekly training plan
 */
export const weekPlanPrompt = `
GENERATE NEXT TRAINING WEEK:

When the user has completed a training session and asks for the next week, generate a detailed weekly plan in JSON format (see jsonSchemas for the exact structure).

IMPORTANT REQUIREMENTS:

1. Each training week must have a clear FOCUS that fits the overall goal of the plan:
   - Hypertrophy (higher volume, moderate intensity)
   - Strength (moderate volume, higher intensity)
   - Peaking (low volume, high intensity)
   - Deload (reduced volume and intensity for recovery)

2. Each INDIVIDUAL SESSION must include:
   - Appropriate name that reflects the focus (e.g., "Squat & Bench Strength")
   - Suitable type (strength, hypertrophy, technique, deload, cardio)
   - Session order within the week
   - 4-8 exercises in the correct order

3. Each session MUST have a balanced mix of exercise types:
   - 1-2 Main Exercises with variations (main exercises like Squat, Bench, Deadlift or variations)
   - 1-2 Secondary Exercises with variations (secondary exercises that support the main exercises)
   - 2-4 Accessory Exercises with variations (accessory exercises for weaknesses, prevention, hypertrophy)
   - For GPP days: focus on accessories and cardio (HIIT or LISS)
   - In the exercise instructions, ALWAYS specify the type: "Main exercise - ...", "Secondary exercise - ...", "Accessory exercise - ..."
   - Set the "type" field based on the exercise measurement:
     * "weight" for exercises measured by weight (most strength exercises)
     * "time" for timed exercises (planks, hangs, cardio, etc.)
     * "reps" for exercises measured only by repetitions (typically bodyweight exercises)
     * "cal" for exercises measured by calories burned

4. APPLY PROGRESSIVE OVERLOAD:
   - Compare with the previous week and plan specific increases
   - Increase the weight by approx. 2.5-5kg for main exercises, if possible
   - Increase the reps or sets for accessory exercises
   - Increase the intensity using RPE (e.g., from RPE 7 to RPE 8)

5. USE SENSIBLE EXERCISE ROTATION:
   - Switch between different exercise variations (e.g., Front Squat instead of Back Squat)
   - Keep the same movement patterns to measure progress
   - Consider fatigue management and periodization
   - Be very specific with exercise variations to ensure correct exercise selection (e.g., "Paused" vs "Close Grip" for bench press)

Start with a brief explanation of how this weekly plan builds on the previous training and what progressions you have incorporated, before creating the JSON object with the type "weekPlan".
`;