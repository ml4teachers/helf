'use client'

import React from 'react'
import { 
  Card,
  CardTitle,
  CardHeader,
  CardDescription,
  CardContent
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Types for a full week session preview
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

export type Session = {
  name: string
  type?: string
  instructions?: string
  notes?: string
  exercises: Exercise[]
  session_order?: number
}

export type Week = {
  week_number: number
  focus?: string
  instructions?: string
  sessions: Session[]
}

interface WeekPreviewProps {
  week: Week
}

export function WeekPreview({ week }: WeekPreviewProps) {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col space-y-2">
        <h3 className="text-lg font-semibold">Week {week.week_number}{week.focus ? `: ${week.focus}` : ''}</h3>
        {week.instructions && <p className="text-sm text-muted-foreground">{week.instructions}</p>}
      </div>
      
      <Tabs defaultValue="overview">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Session Details</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="pt-4">
          <div className="space-y-3">
            <p className="text-sm font-medium">{week.sessions.length} training sessions</p>
            <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
              {week.sessions.map((session, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-base">{session.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      {session.exercises.length} exercises
                      {session.notes && <span className="block text-muted-foreground">{session.notes}</span>}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="details" className="pt-4">
          <div className="space-y-3">
            {week.sessions.map((session, sessionIndex) => (
              <Card key={sessionIndex}>
                <CardHeader>
                  <CardTitle className="text-base">{session.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {session.notes && (
                    <p className="text-sm text-muted-foreground">{session.notes}</p>
                  )}
                  {session.exercises.length > 0 ? (
                    <div className="space-y-2">
                      {session.exercises.sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0)).map((exercise, i) => (
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
                                  {exercise.target_sets} sets × {exercise.target_reps}
                                </span>
                              )}
                              {exercise.target_rpe !== undefined && exercise.target_rpe !== null && (
                                <span className="ml-1 bg-muted px-2 py-0.5 rounded-full">
                                  @RPE {exercise.target_rpe}
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
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Details will be generated when you start this session
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}