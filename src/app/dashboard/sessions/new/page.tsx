'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import SessionForm from '../session-form'
import { ExerciseCard } from '../exercise-card'
import { createClient } from '@/lib/supabaseClient'
import { 
  createTrainingSession,
  getAllExercises,
  getUserTrainingPlan
} from '@/lib/trainingService'
import { useAuth } from '@/components/auth/auth-provider'
import { useAssistant } from '@/components/assistant/assistant-provider'
import { UISessionExercise } from '@/lib/types'

export default function NewSessionPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { sendMessage } = useAssistant()
  
  // Get template ID from URL if provided
  const searchParams = typeof window !== 'undefined' 
    ? new URLSearchParams(window.location.search) 
    : new URLSearchParams('')
  const templateId = searchParams.get('template')
  
  // State variables
  const [isLoading, setIsLoading] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(!!templateId)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableExercises, setAvailableExercises] = useState<{id: number, name: string, type: string, details?: string, description?: string}[]>([])
  
  const [session, setSession] = useState({
    id: 0,
    date: new Date().toISOString().split('T')[0],
    startTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
    endTime: '',
    name: 'New Training Session',
    type: 'strength',
    readiness: {
      score: 7
    },
    notes: '',
    status: 'in_progress'
  })

  const [exercises, setExercises] = useState<UISessionExercise[]>([])
  
  // Helper function to set cookies (for iOS compatibility)
  const setCookie = (name: string, value: string, days: number = 7) => {
    if (typeof document === 'undefined') return;
    
    let expires = '';
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = `; expires=${date.toUTCString()}`;
    }
    document.cookie = `${name}=${encodeURIComponent(value) || ''}${expires}; path=/`;
  };
  
  // Helper function to get cookies
  const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    
    const nameEQ = `${name}=`;
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
  };

  // Load available exercises and template (if provided)
  useEffect(() => {
    async function loadData() {
      if (!user) return
      
      try {
        const supabase = createClient()
        
        // Load exercises
        const exerciseList = await getAllExercises(supabase)
        
        setAvailableExercises(exerciseList.map(ex => ({
          id: ex.id,
          name: ex.name,
          type: ex.type || 'RPE',
          details: ex.details,
          description: ex.description
        })))
        
        // Check if we have a template ID to load
        if (templateId) {
          // Load the user's training plan to get session details
          const plan = await getUserTrainingPlan(supabase, user.id)
          
          if (plan && plan.sessions) {
            // Find the specific session from the plan
            const sessionTemplate = plan.sessions.find(s => s.id.toString() === templateId)
            
            if (sessionTemplate) {
              // Set session details from the template
              setSession(prev => ({
                ...prev,
                name: sessionTemplate.name || 'Training Session',
                notes: sessionTemplate.notes || '',
                type: sessionTemplate.type || 'strength',
              }))
              
              // TODO: In the new system, we would need to fetch exercises for this session
              // This will need to be implemented when we add exercise templates to planned sessions
              setExercises([])
            } else {
              // Template not found, start with empty list
              setExercises([])
            }
          } else {
            // No plan found, start with empty list
            setExercises([])
          }
        } else {
          // No template ID, start with empty exercises list
          setExercises([])
        }
      } catch (err) {
        console.error('Error loading data:', err)
        setError('Failed to load exercise data')
      } finally {
        setIsLoading(false)
        setLoadingTemplate(false)
      }
    }
    
    loadData()
  }, [user, templateId])

  const handleSessionChange = (field: string, value: string | number | Date) => {
    setSession({
      ...session,
      [field]: value,
    })
  }

  const handleReadinessChange = (value: number) => {
    setSession({
      ...session,
      readiness: {
        score: value
      },
    })
  }

  const handleExerciseChange = (exerciseId: number, field: string, value: string | number | null) => {
    setExercises(
      exercises.map((exercise) => {
        if (exercise.id === exerciseId) {
          return {
            ...exercise,
            [field]: value,
          }
        }
        return exercise
      })
    )
  }

  const handleSetChange = (exerciseId: number, setId: number, field: string, value: string | number | null) => {
    setExercises(
      exercises.map((exercise) => {
        if (exercise.id === exerciseId) {
          const currentSetIndex = exercise.sets.findIndex(set => set.id === setId);
          
          // If this is a weight, reps, or RPE field and has a valid value, copy to subsequent sets
          if ((field === 'weight' || field === 'reps' || field === 'rpe') && value !== null && value !== undefined) {
            // Return exercise with updated sets
            return {
              ...exercise,
              sets: exercise.sets.map((set: {id: number, set_number: number, weight?: number, reps?: number, rpe?: number | null, completed: boolean}, index: number) => {
                // For the current set and all following sets, update the specific field
                if (index >= currentSetIndex) {
                  return { ...set, [field]: value };
                }
                // Leave previous sets unchanged
                return set;
              }),
            };
          } else {
            // For other fields or null values, only update the specific set
            return {
              ...exercise,
              sets: exercise.sets.map((set: {id: number, set_number: number, weight?: number, reps?: number, rpe?: number | null, completed: boolean}) => {
                if (set.id === setId) {
                  return { ...set, [field]: value };
                }
                return set;
              }),
            };
          }
        }
        return exercise
      })
    )
  }

  const addExercise = () => {
    // Create a new exercise with default values
    const tempId = -Math.floor(Math.random() * 10000) - 1;
    const newExercise: UISessionExercise = {
      id: tempId, // Large negative random ID
      entry_id: tempId, // Same temp ID for entry_id
      session_id: 0, // Will be assigned when saved
      name: 'New Exercise',
      type: 'RPE', // Default to RPE type
      variation: '', // Add empty variation field
      sets: [
        {
          id: 1,
          set_number: 1,
          weight: 0,
          reps: 0,
          rpe: 7,
          completed: false
        }
      ],
      notes: '',
      exercise_order: exercises.length + 1,
    }
    
    setExercises([...exercises, newExercise])
  }

  const deleteExercise = (exerciseId: number) => {
    setExercises(exercises.filter((exercise) => exercise.id !== exerciseId))
  }

  const addSet = (exerciseId: number) => {
    setExercises(
      exercises.map((exercise) => {
        if (exercise.id === exerciseId) {
          const maxSetNumber = Math.max(...exercise.sets.map(set => set.set_number), 0)
          const newSetId = -Math.max(...exercise.sets.map(set => Math.abs(set.id)), 0) - 1
          
          // For the first set or if there are no sets yet
          if (exercise.sets.length === 0) {
            return {
              ...exercise,
              sets: [
                {
                  id: 1,
                  set_number: 1,
                  weight: 0,
                  reps: 0,
                  rpe: 7,
                  completed: false
                },
              ],
            }
          }
          
          // Otherwise, copy the last set's values
          const lastSet = exercise.sets[exercise.sets.length - 1]
          return {
            ...exercise,
            sets: [
              ...exercise.sets,
              {
                id: newSetId,
                set_number: maxSetNumber + 1,
                weight: lastSet.weight ?? 0,
                reps: lastSet.reps ?? 0,
                rpe: lastSet.rpe ?? null,
                completed: false
              },
            ],
          }
        }
        return exercise
      })
    )
  }

  const deleteSet = (exerciseId: number, setId: number) => {
    setExercises(
      exercises.map((exercise) => {
        if (exercise.id === exerciseId) {
          return {
            ...exercise,
            sets: exercise.sets.filter((set) => set.id !== setId),
          }
        }
        return exercise
      })
    )
  }

  const handleReplaceExercise = (exerciseId: number, newExerciseId: number, newExerciseName: string, newExerciseType: string, newDetails?: string, newDescription?: string) => {
    setExercises(
      exercises.map((exercise) => {
        if (exercise.id === exerciseId) {
          return {
            ...exercise,
            id: newExerciseId,
            name: newExerciseName,
            type: newExerciseType,
            details: newDetails || '',
            description: newDescription || '',
          }
        }
        return exercise
      })
    )
  }

  const finishSession = async () => {
    if (!user) return
    
    try {
      setIsLoading(true)
      const supabase = createClient()
      
      // Prepare session data for creation
      const sessionData = {
        user_id: user.id,
        name: session.name,
        type: session.type,
        scheduled_date: session.date,
        status: 'in_progress',
        notes: session.notes,
        readiness_score: session.readiness.score,
        exercises: exercises.map((exercise, index) => ({
          exercise_id: exercise.id,
          exercise_order: index + 1,
          notes: exercise.notes,
          target_sets: exercise.target_sets,
          target_reps: exercise.target_reps,
          target_rpe: exercise.target_rpe,
          target_weight: exercise.target_weight,
          sets: exercise.sets.map(set => ({
            set_number: set.set_number,
            weight: set.weight,
            reps: set.reps,
            rpe: set.rpe,
            completed: false,
            notes: ''
          }))
        }))
      }
      
      const result = await createTrainingSession(
        supabase,
        user.id,
        sessionData
      )
      
      // Redirect to the new session detail page
      router.push(`/dashboard/sessions/${result.sessionId}`)
    } catch (err) {
      console.error('Error creating session:', err)
      setError('Failed to create training session. Please try again.')
      setIsLoading(false)
    }
  }

  const cancelSession = () => {
    if (window.confirm('Are you sure you want to cancel this session?')) {
      // Navigate back to sessions list
      router.push('/dashboard')
    }
  }
  
  const generateSession = async () => {
    if (!user) return
    
    try {
      setIsGenerating(true)
      
      // Determine the current day of the week
      const currentDate = new Date(session.date)
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDate.getDay()]
      
      // Build prompt for the assistant based on the user's data
      const prompt = `I need a workout for today (${dayOfWeek}). 
      
      My readiness score is: ${session.readiness.score}/10
      
      ${session.notes ? `Additional notes: ${session.notes}` : ''}
      
      Please generate a single detailed workout session for today using the sessionPlan format.`
      
      // Send message to assistant and wait for response
      const response = await sendMessage(prompt)
      
      // Parse the JSON from the response
      const jsonMatch = response?.content?.match(/```json\n([\s\S]*?)\n```/)
      if (jsonMatch && jsonMatch[1]) {
        try {
          const sessionPlan = JSON.parse(jsonMatch[1])
          
          if (sessionPlan.type === 'sessionPlan' && sessionPlan.data) {
            // Update session details from the plan
            setSession(prev => ({
              ...prev,
              name: sessionPlan.data.name || prev.name,
              type: sessionPlan.data.type || prev.type,
              notes: sessionPlan.data.notes || prev.notes
            }))
            
            // Transform the exercises into our format
            const newExercises = sessionPlan.data.exercises.map((ex: {
              name: string;
              details?: string;
              notes?: string;
              target_sets?: number;
              target_reps?: string;
              target_rpe?: number;
              target_weight?: string;
            }, index: number) => {
              // Find if this exercise already exists in our database
              let exerciseId = -1 * (index + 1) // Default to a negative ID for new exercises
              const existingExercise = availableExercises.find(e => 
                e.name.toLowerCase() === ex.name.toLowerCase()
              )
              
              if (existingExercise) {
                exerciseId = existingExercise.id
              }
              
              // Create the sets based on the target sets
              const targetSets = ex.target_sets || 3
              const sets = Array.from({ length: targetSets }, (_, i) => ({
                id: -(index * 100 + i + 1), // Unique negative ID for each set
                set_number: i + 1,
                weight: 0, // User will need to fill this in
                reps: parseInt(ex.target_reps || '0'),
                rpe: ex.target_rpe || 7,
                completed: false
              }))
              
              return {
                id: exerciseId,
                name: ex.name,
                type: 'RPE',
                details: ex.details || '',
                sets,
                notes: ex.notes || '',
                exercise_order: index + 1,
                target_sets: ex.target_sets,
                target_reps: ex.target_reps,
                target_rpe: ex.target_rpe,
                target_weight: ex.target_weight
              }
            })
            
            // Set the exercises
            setExercises(newExercises)
          }
        } catch (err) {
          console.error('Error parsing session plan:', err)
          setError('Failed to parse generated session. Please try again.')
        }
      } else {
        setError('No valid session plan was generated. Please try again.')
      }
    } catch (err) {
      console.error('Error generating session:', err)
      setError('Failed to generate workout session. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  if (isLoading || loadingTemplate) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="text-muted-foreground">
            {isLoading ? 'Saving session data...' : 'Loading template data...'}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border p-4 text-red-500">
        <p>{error}</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => setError(null)}
        >
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">New Training Session</h1>
      </div>
      
      <SessionForm 
        session={session}
        onSessionChange={handleSessionChange}
        onReadinessChange={handleReadinessChange}
        onGenerateSession={generateSession}
        isGenerating={isGenerating}
      />
      
      <div className="space-y-4">
        {exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            onExerciseChange={handleExerciseChange}
            onSetChange={handleSetChange}
            onDeleteExercise={deleteExercise}
            onAddSet={addSet}
            onDeleteSet={deleteSet}
            onReplaceExercise={handleReplaceExercise}
          />
        ))}
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <Button onClick={addExercise} className="flex-1">
          Add Exercise
        </Button>
        <Button onClick={finishSession} variant="secondary" className="flex-1">
          Save Session
        </Button>
        <Button onClick={cancelSession} variant="outline" className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  )
}