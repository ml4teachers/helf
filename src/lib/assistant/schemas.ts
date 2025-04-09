// src/lib/assistant/schemas.ts
import { z } from 'zod';

// Schema for exercises in plans and sessions
export const exerciseSchema = z.object({
  name: z.string(),
  variation: z.string().optional(), // Changed from details to variation based on other files
  type: z.enum(['weight', 'reps', 'time', 'cal']).optional().default('weight'), // Added enum, default
  details: z.string().optional(), // Keep details for potential backwards compatibility?
  exercise_order: z.number().optional().default(1),
  target_sets: z.number().optional(),
  target_reps: z.string().optional(),
  target_rpe: z.union([z.number().min(0).max(10), z.null()]).optional(), // Added min/max
  target_weight: z.string().optional(), // Could be 'BW', '50kg', '70%'
  notes: z.string().optional(),
  instructions: z.string().optional(), // Added instructions field
});

// Schema for session in initial training plan (exercises optional)
export const trainingPlanSessionSchema = z.object({
  name: z.string(),
  type: z.string().optional(),
  notes: z.string().optional(),
  instructions: z.string().optional(), // Added instructions
  exercises: z.array(exerciseSchema).optional(),
  session_order: z.number().optional(),
});

// Schema for session in detailed week plan (requires exercises)
export const weekPlanSessionSchema = z.object({
  name: z.string(),
  type: z.string().optional(),
  notes: z.string().optional(),
  instructions: z.string().optional(), // Added instructions
  exercises: z.array(exerciseSchema), // Exercises required
  session_order: z.number().optional(),
});

// Define the week schema for training plan/week plan
export const weekSchema = z.object({
  week_number: z.number(),
  focus: z.string().optional(),
  notes: z.string().optional(), // Renamed from instructions in some previous types
  instructions: z.string().optional(), // Keep both for flexibility?
  // Use union for sessions to allow both types initially? Or keep separate schemas?
  // Let's keep weekSchema generic and validate sessions based on context later if needed
  sessions: z.array(trainingPlanSessionSchema), // Use the optional exercise schema here for the main plan
});

// Main training plan schema (used for initial creation)
export const trainingPlanSchema = z.object({
  type: z.literal('trainingPlan'),
  data: z.object({
    name: z.string().min(1, { message: "Plan name cannot be empty" }),
    description: z.string().optional(),
    goal: z.string().optional(),
    weeks: z.array(weekSchema).min(1, { message: "Plan must have at least one week" }),
    metadata: z.record(z.any()).optional(),
  }),
});

// Legacy schema for backwards compatibility
export const legacyPlanSchema = z.object({
  type: z.literal('trainingPlan'),
  data: z.object({
    name: z.string(),
    description: z.string().optional(), // Make optional
    durationWeeks: z.number().optional(), // Make optional
    weeklyStructure: z.array(z.any()).optional(),
    sessions: z.array(z.any()).optional(),
  }),
  // No longer need refine if both are optional, handle logic in conversion
});

// Schema for a single session plan generation/update
export const sessionPlanSchema = z.object({
  type: z.literal('sessionPlan'),
  data: z.object({
    name: z.string().min(1),
    type: z.string().optional(),
    notes: z.string().optional(),
    instructions: z.string().optional(),
    exercises: z.array(exerciseSchema), // Exercises usually required here
  })
});

// Schema for a weekly plan generation (used for next week's plan)
export const weekPlanSchema = z.object({
  type: z.literal('weekPlan'),
  data: z.object({
    week_number: z.number(),
    focus: z.string().optional(),
    notes: z.string().optional(),
    instructions: z.string().optional(),
    sessions: z.array(weekPlanSessionSchema), // Use the schema that requires exercises
  })
});

// Schema for an exercise update (metadata for DB)
export const exerciseUpdateSchema = z.object({
  type: z.literal('exerciseUpdate'),
  data: z.object({
    exerciseId: z.number(),
    // Update structure matches Partial<Exercise> more closely
    update: z.object({
      name: z.string().optional(),
      variation: z.string().optional(), // Use variation
      type: z.enum(['weight', 'reps', 'time', 'cal']).optional(), // Use enum
      description: z.string().optional(),
      // Removed fields less likely for AI to update directly:
      // details: z.string().optional(),
      // canonical_name: z.string().optional(),
      // muscle_groups: z.array(z.string()).optional(),
    }),
  }),
});

// Helper type for Zod validation errors
export type ZodErrorMap = { path: (string | number)[]; message: string }[];

// Function to extract a detailed error message from Zod errors
export function getZodErrorDetails(error: unknown): string {
    if (error instanceof z.ZodError) {
        return error.errors.map((err: any) => {
              const path = err.path.join('.');
              return `- ${path || 'error'}: ${err.message}`;
            }).join('\n');
    } else if (error instanceof Error) {
        return error.message;
    }
    return 'Unknown validation error';
}