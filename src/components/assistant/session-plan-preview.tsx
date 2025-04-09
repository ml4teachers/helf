'use client'

import React from 'react'
import { 
  Card,
  CardTitle,
  CardHeader,
  CardDescription,
  CardContent
} from '@/components/ui/card'

// Type for session plan (one individual session)
export type Exercise = {
  name: string
  variation?: string
  target_sets?: number
  target_reps?: string
  target_rpe?: number | null
  target_weight?: string
  instructions?: string
  notes?: string
  exercise_order?: number
}

export type SessionPlan = {
  name: string
  type?: string
  instructions?: string
  notes?: string
  exercises: Exercise[]
}

interface SessionPlanPreviewProps {
  sessionPlan: SessionPlan
}

export function SessionPlanPreview({ sessionPlan }: SessionPlanPreviewProps) {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col space-y-2">
        <h3 className="text-lg font-semibold">{sessionPlan.name}</h3>
        {sessionPlan.type && <p className="text-sm text-muted-foreground">{sessionPlan.type} Session</p>}
        {sessionPlan.notes && <p className="text-sm text-muted-foreground">{sessionPlan.notes}</p>}
      </div>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Session Exercises</CardTitle>
          <CardDescription>
            {sessionPlan.exercises.length} exercises in this session
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sessionPlan.exercises.sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0)).map((exercise, i) => (
              <div key={i} className="border rounded-md p-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{exercise.name}</p>
                    {exercise.variation && (
                      <p className="text-xs text-muted-foreground">
                        {exercise.variation}
                      </p>
                    )}
                  </div>
                  <div className="text-xs">
                    {exercise.target_sets && exercise.target_reps && (
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {exercise.target_sets} × {exercise.target_reps}
                      </span>
                    )}
                    {exercise.target_rpe !== undefined && exercise.target_rpe !== null && (
                      <span className="ml-1 bg-muted px-2 py-0.5 rounded-full">
                        RPE {exercise.target_rpe}
                      </span>
                    )}
                  </div>
                </div>
                {(exercise.instructions || exercise.notes) && (
                  <div className="space-y-1 mt-1">
                    {exercise.instructions && (
                      <p className="text-xs text-muted-foreground">
                        {exercise.instructions}
                      </p>
                    )}
                    {exercise.notes && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Notes:</span> {exercise.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}