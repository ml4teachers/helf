'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChartLine, Plus, X } from 'lucide-react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { createClient } from '@/lib/supabaseClient'
import { ProgressChart } from '@/components/ui/progress-chart'
import { findBestSet } from '@/lib/utils'

type Exercise = {
  id: number;
  name: string;
  type: string;
  variation?: string;
}

type ExerciseEntry = {
  id: number;
  exercise_id: number;
  exercise: Exercise;
  date: string;
  sets: Array<{
    id: number;
    weight: number | null;
    reps: number | null;
    rpe: number | null;
  }>;
}

type TrackedExercise = {
  id: number;
  name: string;
  variation?: string;
  error?: string | null;
  history: Array<{
    date: string;
    timestamp: number;
    weight: number | null;
    reps: number | null;
    rpe: number | null;
    e1rm: number | null;
  }>;
}

export function ExerciseProgressTracker() {
  const [isLoading, setIsLoading] = useState(true)
  const [exerciseList, setExerciseList] = useState<Exercise[]>([])
  const [trackedExercises, setTrackedExercises] = useState<TrackedExercise[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  // Load user's exercise history on component mount
  useEffect(() => {
    const loadExercises = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setError('User not authenticated')
          return
        }

        // Fetch completed exercises
        const { data: completedExercises, error: exercisesError } = await supabase
          .from('user_exercise_entries')
          .select(`
            id,
            exercise_id,
            exercises(id, name, type, variation),
            user_sessions!inner(id, user_id, scheduled_date, completed_date),
            user_exercise_sets(id, weight, reps, rpe, completed)
          `)
          .eq('user_sessions.user_id', user.id)
          .eq('user_sessions.status', 'completed')
          .order('created_at', { ascending: false })
        
        if (exercisesError) {
          throw exercisesError
        }

        if (!completedExercises || completedExercises.length === 0) {
          setExerciseList([])
          setIsLoading(false)
          return
        }

        // Extract unique exercises
        const uniqueExercises = new Map<number, Exercise>()
        
        completedExercises.forEach(entry => {
          const exercise = (entry.exercises as any) as Exercise
          if (exercise && !uniqueExercises.has(exercise.id)) {
            uniqueExercises.set(exercise.id, {
              id: exercise.id,
              name: exercise.name,
              type: exercise.type,
              variation: exercise.variation
            })
          }
        })

        setExerciseList(Array.from(uniqueExercises.values()))

        // Load previously tracked exercises from localStorage if available
        const savedExercises = localStorage.getItem('trackedExercises')
        if (savedExercises) {
          try {
            const parsed = JSON.parse(savedExercises)
            // Only load exercises that exist in our current exercise list
            const validExercises = parsed.filter((e: TrackedExercise) => 
              Array.from(uniqueExercises.values()).some(ue => ue.id === e.id)
            )
            
            if (validExercises.length > 0) {
              setTrackedExercises(validExercises)
              // Immediately load history for each tracked exercise
              validExercises.forEach((exercise: TrackedExercise) => {
                loadExerciseHistory(exercise.id)
              })
            }
          } catch (e) {
            console.error('Error parsing saved tracked exercises', e)
            // Continue with empty tracked exercises
          }
        }
      } catch (err) {
        console.error('Error loading exercises', err)
        setError('Failed to load exercise data')
      } finally {
        setIsLoading(false)
      }
    }

    loadExercises()
  }, [supabase])

  // Save tracked exercises to localStorage when they change
  useEffect(() => {
    if (trackedExercises.length > 0) {
      localStorage.setItem('trackedExercises', JSON.stringify(trackedExercises))
    }
  }, [trackedExercises])

  // Load history for a specific exercise
  const loadExerciseHistory = async (exerciseId: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log(`User not authenticated when loading history for exercise ${exerciseId}`)
        return
      }

      console.log(`Loading history for exercise ID ${exerciseId}`)

      // Verify the exercise exists first
      const { data: exerciseData, error: exerciseError } = await supabase
        .from('exercises')
        .select('id, name, type, variation')
        .eq('id', exerciseId)
        .single()
        
      if (exerciseError) {
        console.error(`Exercise with ID ${exerciseId} not found:`, exerciseError)
        // Update tracked exercises to show an error state instead of "Loading..."
        setTrackedExercises(current => 
          current.map(exercise => 
            exercise.id === exerciseId 
              ? { ...exercise, history: [], error: 'Exercise not found' } 
              : exercise
          )
        )
        return
      }
      
      // Fetch exercise entries for this exercise with a more reliable query structure
      // Use two separate queries for better reliability
      
      // 1. First, get all user's completed sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('id, scheduled_date, completed_date')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        
      if (sessionsError) {
        console.error('Error fetching completed sessions:', sessionsError)
        throw sessionsError
      }
      
      if (!sessions || sessions.length === 0) {
        console.log('No completed sessions found for user')
        // Set empty history but don't show error
        setTrackedExercises(current => 
          current.map(exercise => 
            exercise.id === exerciseId 
              ? { ...exercise, history: [] } 
              : exercise
          )
        )
        return
      }
      
      const sessionIds = sessions.map(s => s.id)
      
      // Safety check to avoid empty IN clause
      if (sessionIds.length === 0) {
        console.log('No session IDs to query')
        setTrackedExercises(current => 
          current.map(exercise => 
            exercise.id === exerciseId 
              ? { ...exercise, history: [] } 
              : exercise
          )
        )
        return
      }
      
      // 2. Then get exercise entries for this exercise in those sessions
      const { data: entries, error: entriesError } = await supabase
        .from('user_exercise_entries')
        .select(`
          id,
          exercise_id,
          session_id,
          exercises(id, name, type, variation),
          user_exercise_sets(id, weight, reps, rpe, completed)
        `)
        .eq('exercise_id', exerciseId)
        .in('session_id', sessionIds)
      
      if (entriesError) {
        console.error(`Error fetching exercise entries for exercise ${exerciseId}:`, entriesError)
        throw entriesError
      }
      
      if (!entries || entries.length === 0) {
        console.log(`No entries found for exercise ${exerciseId}`)
        setTrackedExercises(current => 
          current.map(exercise => 
            exercise.id === exerciseId 
              ? { ...exercise, history: [] } 
              : exercise
          )
        )
        return
      }
      
      // Map session dates to entries
      const entriesWithDates = entries.map(entry => {
        const session = sessions.find(s => s.id === entry.session_id)
        return {
          ...entry,
          date: session ? (session.completed_date || session.scheduled_date) : new Date().toISOString().split('T')[0]
        }
      })
      
      console.log(`Found ${entriesWithDates.length} entries for exercise ${exerciseId}`)
      
      // Process entries to create history data points
      const history = entriesWithDates.map(entry => {
        const date = entry.date
        // Safely handle undefined user_exercise_sets
        const sets = Array.isArray(entry.user_exercise_sets) ? entry.user_exercise_sets : []
        
        // Find the best set
        const completedSets = sets
          .filter(set => set.completed)
          .map(set => ({
            id: set.id,
            set_number: 1, // Not used for best set calculation
            weight: typeof set.weight === 'number' ? set.weight : null,
            reps: typeof set.reps === 'number' ? set.reps : null,
            rpe: typeof set.rpe === 'number' ? set.rpe : null,
            completed: true
          }))
        
        const bestSet = findBestSet(completedSets)
        
        // Format date for display
        let formattedDate
        try {
          formattedDate = new Date(date).toLocaleDateString()
          if (formattedDate === 'Invalid Date') {
            formattedDate = date
          }
        } catch (e) {
          formattedDate = date
        }
        
        // Calculate timestamp for chart
        let timestamp
        try {
          timestamp = new Date(date).getTime()
          if (isNaN(timestamp)) {
            timestamp = Date.now()
          }
        } catch (e) {
          timestamp = Date.now()
        }
        
        return {
          date: formattedDate,
          timestamp,
          weight: bestSet?.weight || null,
          reps: bestSet?.reps || null,
          rpe: bestSet?.rpe || null,
          e1rm: bestSet?.e1rm || null
        }
      })

      // Update the exercise in the tracked list
      setTrackedExercises(current => 
        current.map(exercise => 
          exercise.id === exerciseId 
            ? { ...exercise, history, error: null } 
            : exercise
        )
      )
    } catch (err) {
      console.error(`Error loading history for exercise ${exerciseId}`, err)
      // Update tracked exercises to show an error state
      setTrackedExercises(current => 
        current.map(exercise => 
          exercise.id === exerciseId 
            ? { ...exercise, history: [], error: 'Failed to load history' } 
            : exercise
          )
      )
    }
  }

  // Add an exercise to the tracked list
  const trackExercise = (exercise: Exercise) => {
    // Check if already tracked
    if (trackedExercises.some(e => e.id === exercise.id)) {
      return
    }
    
    const newExercise: TrackedExercise = {
      id: exercise.id,
      name: exercise.name,
      variation: exercise.variation,
      error: null,
      history: []
    }
    
    setTrackedExercises([...trackedExercises, newExercise])
    setDialogOpen(false)
    
    // Load history immediately
    loadExerciseHistory(exercise.id)
  }

  // Remove an exercise from tracking
  const removeExercise = (exerciseId: number) => {
    setTrackedExercises(current => 
      current.filter(exercise => exercise.id !== exerciseId)
    )
    
    // Update localStorage
    const updatedExercises = trackedExercises.filter(e => e.id !== exerciseId)
    if (updatedExercises.length > 0) {
      localStorage.setItem('trackedExercises', JSON.stringify(updatedExercises))
    } else {
      localStorage.removeItem('trackedExercises')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Progress Tracking</h3>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="flex gap-1 items-center">
              <Plus className="w-4 h-4" /> Track Exercise
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select Exercise to Track</DialogTitle>
            </DialogHeader>
            
            <div className="mt-4">
              <Command className="rounded-lg border shadow-md">
                <CommandInput placeholder="Search exercises..." />
                <CommandList>
                  <CommandEmpty>No exercises found.</CommandEmpty>
                  <CommandGroup heading="Your Exercises">
                    {exerciseList.map(exercise => (
                      <CommandItem
                        key={exercise.id}
                        value={`${exercise.name}${exercise.variation ? ' ' + exercise.variation : ''}`}
                        onSelect={() => trackExercise(exercise)}
                      >
                        <span>{exercise.name}</span>
                        {exercise.variation && (
                          <span className="text-muted-foreground text-xs ml-2">
                            {exercise.variation}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
              
              {exerciseList.length === 0 && !isLoading && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  No completed exercises found. Complete some training sessions to track your progress.
                </p>
              )}
              
              {isLoading && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  Loading your exercises...
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      {trackedExercises.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <ChartLine className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Add exercises to track your strength progress over time.
          </p>
          <Button 
            onClick={() => setDialogOpen(true)} 
            variant="outline" 
            className="mt-4"
          >
            <Plus className="w-4 h-4 mr-2" /> Track Exercise
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {trackedExercises.map(exercise => (
            <Card key={exercise.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base flex items-center">
                    {exercise.name}
                    {exercise.variation && (
                      <span className="text-sm text-muted-foreground ml-2 font-normal">
                        ({exercise.variation})
                      </span>
                    )}
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => removeExercise(exercise.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  {exercise.error ? (
                    <div className="h-full flex items-center justify-center bg-muted/30 rounded-md">
                      <span className="text-sm text-muted-foreground">{exercise.error}</span>
                    </div>
                  ) : exercise.history.length === 0 ? (
                    <div className="h-full flex items-center justify-center bg-muted/30 rounded-md">
                      <span className="text-sm text-muted-foreground">Loading history...</span>
                    </div>
                  ) : (
                    <ProgressChart
                      data={exercise.history}
                      height={180}
                      showAxisLabels={true}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}