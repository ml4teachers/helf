/**
 * JSON schemas for various data structures used by the assistant
 * These are used for validation and documentation
 */

export const jsonSchemas = `
###################################################
# JSON FORMAT REQUIREMENTS
###################################################

IMPORTANT: When creating JSON responses, follow these rules:
1. DO NOT use comments in JSON (no // or /* */ comments)
2. Always use double quotes for keys and string values
3. Do not include trailing commas
4. Always include all required fields
5. For training plans, include ALL weeks, not just examples

###################################################
# JSON SCHEMAS
###################################################

# Exercise Schema
const exerciseSchema = {
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "variation": { "type": "string" },
    "type": { "type": "string", "enum": ["weight", "reps", "time", "cal"] },
    "exercise_order": { "type": "integer" },
    "target_sets": { "type": "integer" },
    "target_reps": { "type": "string" },
    "target_rpe": { "type": ["integer", "null"] },
    "target_weight": { "type": "string" },
    "instructions": { "type": "string" },
    "notes": { "type": "string" }
  },
  "required": ["name"]
}

# Session Schema
const sessionSchema = {
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "type": { "type": "string" },
    "instructions": { "type": "string" },
    "notes": { "type": "string" },
    "exercises": { "type": "array", "items": exerciseSchema },
    "session_order": { "type": "integer" }
  },
  "required": ["name", "exercises"]
}

# Week Schema
const weekSchema = {
  "type": "object",
  "properties": {
    "week_number": { "type": "integer" },
    "focus": { "type": "string" },
    "instructions": { "type": "string" },
    "notes": { "type": "string" },
    "sessions": { "type": "array", "items": sessionSchema }
  },
  "required": ["week_number", "sessions"]
}

# Training Plan Schema
const trainingPlanSchema = {
  "type": "object",
  "properties": {
    "type": { "type": "string", "enum": ["trainingPlan"] },
    "data": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "description": { "type": "string" },
        "goal": { "type": "string" },
        "weeks": { "type": "array", "items": weekSchema },
        "metadata": { "type": "object" }
      },
      "required": ["name", "weeks"]
    }
  },
  "required": ["type", "data"]
}

# Session Plan Schema
const sessionPlanSchema = {
  "type": "object",
  "properties": {
    "type": { "type": "string", "enum": ["sessionPlan"] },
    "data": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "type": { "type": "string" },
        "notes": { "type": "string" },
        "exercises": { "type": "array", "items": exerciseSchema }
      },
      "required": ["name", "exercises"]
    }
  },
  "required": ["type", "data"]
}

# Exercise Update Schema
const exerciseUpdateSchema = {
  "type": "object",
  "properties": {
    "type": { "type": "string", "enum": ["exerciseUpdate"] },
    "data": {
      "type": "object",
      "properties": {
        "exerciseId": { "type": "integer" },
        "update": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "type": { "type": "string", "enum": ["weight", "reps", "time", "cal", null] },
            "variation": { "type": "string" },
          }
        }
      },
      "required": ["exerciseId", "update"]
    }
  },
  "required": ["type", "data"]
}

# Week Plan Schema
const weekPlanSchema = {
  "type": "object",
  "properties": {
    "type": { "type": "string", "enum": ["weekPlan"] },
    "data": {
      "type": "object",
      "properties": {
        "week_number": { "type": "integer" },
        "focus": { "type": "string" },
        "instructions": { "type": "string" },
        "notes": { "type": "string" },
        "sessions": { "type": "array", "items": sessionSchema }
      },
      "required": ["week_number", "sessions"]
    }
  },
  "required": ["type", "data"]
}
`;