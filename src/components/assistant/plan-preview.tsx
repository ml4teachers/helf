'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Card,
  CardTitle,
  CardHeader,
  CardDescription,
  CardContent
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Types for plan and session preview display
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

export type Plan = {
  name: string
  description?: string
  goal?: string
  weeks: Week[]
}

interface PlanPreviewProps {
  plan: Plan
}



export function PlanPreview({ plan }: PlanPreviewProps) {
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  
  // Get all available week numbers
  const weekNumbers = plan.weeks.map(week => week.week_number)
  
  // Find the currently selected week
  const currentWeek = plan.weeks.find(week => week.week_number === selectedWeek) || plan.weeks[0]
  
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col space-y-2">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
        {plan.goal && <p className="text-sm font-medium">Goal: {plan.goal}</p>}
      </div>
      
      <Tabs defaultValue="overview">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Week Details</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="pt-4">
          <div className="space-y-3">
            <p className="text-sm font-medium">{plan.weeks.length} week program</p>
            <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
              {plan.weeks.map(week => (
                <Card key={week.week_number} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Week {week.week_number}</CardTitle>
                    {week.focus && (
                      <CardDescription>{week.focus}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      {week.sessions.length} sessions
                    </p>
                    {week.instructions && <p className="text-xs mt-1 text-muted-foreground">{week.instructions}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="details" className="pt-4">
          <div className="flex items-center justify-between mb-4 space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const index = weekNumbers.indexOf(selectedWeek)
                if (index > 0) setSelectedWeek(weekNumbers[index - 1])
              }}
              disabled={selectedWeek === weekNumbers[0]}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <span className="font-medium">
              Week {selectedWeek} {currentWeek.focus ? `- ${currentWeek.focus}` : ''}
            </span>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const index = weekNumbers.indexOf(selectedWeek)
                if (index < weekNumbers.length - 1) setSelectedWeek(weekNumbers[index + 1])
              }}
              disabled={selectedWeek === weekNumbers[weekNumbers.length - 1]}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {currentWeek.instructions && (
            <div className="mb-4 text-sm text-muted-foreground space-y-1">
              <p>{currentWeek.instructions}</p>
            </div>
          )}
          
          <div className="space-y-3">
            {currentWeek.sessions.map(session => (
              <Card key={session.name}>
                <CardHeader>
                  <CardTitle className="text-base">{session.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {(session.instructions || session.notes) && (
                    <div className="mb-2 space-y-1">
                      {session.instructions && (
                        <p className="text-sm text-muted-foreground">{session.instructions}</p>
                      )}
                      {session.notes && (
                        <p className="text-sm text-muted-foreground"><span className="font-medium">Notes:</span> {session.notes}</p>
                      )}
                    </div>
                  )}
                  
                  {session.exercises && session.exercises.length > 0 ? (
                    <div className="space-y-2">
                      {session.exercises.map((exercise, i) => (
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
                              {exercise.target_rpe && (
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
  )
}