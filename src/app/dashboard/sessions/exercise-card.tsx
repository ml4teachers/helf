'use client'

import { useState, useEffect } from 'react'
import { 
  Card, 
  CardHeader, 
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { calculateE1RM, findBestSet, cn } from '@/lib/utils'
import { ProgressChart } from '@/components/ui/progress-chart'
import { useAssistant } from '@/components/assistant/assistant-provider'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Pencil, 
  HelpCircle 
} from 'lucide-react'
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { createClient } from '@/lib/supabaseClient'
import { getAllExercises, getExerciseHistory } from '@/lib/trainingService'
import { UISessionExercise } from '@/lib/types'
import { useAuth } from '@/components/auth/auth-provider'

type ExerciseCardProps = {
  exercise: UISessionExercise
  onExerciseChange: (exerciseId: number, field: string, value: string | number | null) => void
  onSetChange: (exerciseId: number, setId: number, field: string, value: string | number | null) => void
  onDeleteExercise: (exerciseId: number) => void
  onAddSet: (exerciseId: number) => void
  onDeleteSet: (exerciseId: number, setId: number) => void
  onReplaceExercise: (exerciseId: number, newExerciseId: number, newExerciseName: string, newExerciseType: string, newVariation?: string, newDescription?: string) => void
}

export function ExerciseCard({
  exercise,
  onExerciseChange,
  onSetChange,
  onDeleteExercise,
  onAddSet,
  onDeleteSet,
  onReplaceExercise,
}: ExerciseCardProps) {
  // Show notes by default for non-weight type exercises
  const [showNotes, setShowNotes] = useState(exercise.type !== 'weight')
  const { toggleDrawer, setInputText, setIsOpen } = useAssistant()

  // State for exercise history
  const [exerciseHistory, setExerciseHistory] = useState<{
    date: string;
    sets: { weight: number; reps: number; rpe: number | null }[];
  }[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const { user } = useAuth()
  
  // Load exercise history when dialog opens
  const loadExerciseHistory = async () => {
    if (!user || exercise.id <= 0) return
    
    setLoadingHistory(true)
    try {
      const supabase = createClient()
      const history = await getExerciseHistory(supabase, user.id, exercise.id)
      // Type casting to ensure compatibility
      setExerciseHistory(history as {
        date: string;
        sets: { weight: number; reps: number; rpe: number | null }[];
      }[])
    } catch (err) {
      console.error('Error loading exercise history:', err)
      // Fall back to empty or mock data
      setExerciseHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  // Display target values if they exist
  const hasTargets = exercise.target_sets || exercise.target_reps || exercise.target_weight || exercise.target_rpe

  // Handle input change with decimal format conversion
  const handleNumberInput = (exerciseId: number, setId: number, field: string, value: string) => {
    // Replace comma with period for decimal values
    const sanitizedValue = value.replace(',', '.');
    
    // Parse value based on field type
    let parsedValue: number | null = null;
    
    if (sanitizedValue === '') {
      parsedValue = null;
    } else if (field === 'reps') {
      parsedValue = parseInt(sanitizedValue);
    } else if (field === 'rpe') {
      // Ensure RPE is not greater than 10
      const rpe = parseFloat(sanitizedValue);
      parsedValue = rpe > 10 ? 10 : rpe;
    } else {
      parsedValue = parseFloat(sanitizedValue);
    }
    
    // Update the current set
    onSetChange(exerciseId, setId, field, parsedValue);
  };

  // Auto-fill target values or previous set values
  useEffect(() => {
    if (exercise.sets.length > 0) {
      // Find the most recently added set (assuming it's the last one)
      const newSetIndex = exercise.sets.length - 1;
      const newSet = exercise.sets[newSetIndex];
      
      // Only auto-fill if this set has no values yet
      if ((newSet.weight === undefined || newSet.weight === null) &&
          (newSet.reps === undefined || newSet.reps === null)) {
        
        // For first set, use target values if available
        if (newSetIndex === 0) {
          if (exercise.target_weight) {
            // Try to parse target weight, which might be a string like "60-80%"
            const targetWeight = parseFloat(exercise.target_weight);
            if (!isNaN(targetWeight)) {
              onSetChange(exercise.id, newSet.id, 'weight', targetWeight);
            }
          }
          
          if (exercise.target_reps) {
            // Try to parse target reps, which might be a string like "8-10"
            const repsParts = exercise.target_reps.split('-');
            if (repsParts.length > 0) {
              const targetReps = parseInt(repsParts[0]);
              if (!isNaN(targetReps)) {
                onSetChange(exercise.id, newSet.id, 'reps', targetReps);
              }
            }
          }
          
          if (exercise.target_rpe) {
            onSetChange(exercise.id, newSet.id, 'rpe', exercise.target_rpe);
          }
        } 
        // For subsequent sets, copy from previous set
        else if (newSetIndex > 0) {
          const prevSet = exercise.sets[newSetIndex - 1];
          if (prevSet.weight !== undefined && prevSet.weight !== null) {
            onSetChange(exercise.id, newSet.id, 'weight', prevSet.weight);
          }
          if (prevSet.reps !== undefined && prevSet.reps !== null) {
            onSetChange(exercise.id, newSet.id, 'reps', prevSet.reps);
          }
          if (prevSet.rpe !== undefined && prevSet.rpe !== null) {
            onSetChange(exercise.id, newSet.id, 'rpe', prevSet.rpe);
          }
        }
      }
    }
  }, [exercise.sets.length, exercise.id, exercise.target_weight, exercise.target_reps, exercise.target_rpe, onSetChange, exercise.sets]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 mr-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" className="text-lg font-medium p-0 h-auto hover:bg-transparent flex flex-col items-start">
                  <span className="truncate max-w-[200px]">{exercise.name}</span>
                  {exercise.variation && (
                    <span className="text-sm text-muted-foreground">
                      {exercise.variation}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]" onOpenAutoFocus={(e) => {
              e.preventDefault()
              loadExerciseHistory()
            }}>
              <DialogHeader>
                <DialogTitle>{exercise.name} History</DialogTitle>
                {exercise.variation && <p className="text-sm text-muted-foreground mt-1">{exercise.variation}</p>}
              </DialogHeader>
            
              <div className="mt-4 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Replace Exercise</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <ExerciseSelect 
                      defaultValue={exercise.name + (exercise.variation ? ` (${exercise.variation})` : '')}
                      onSelected={(id, name, type, variation, description) => onReplaceExercise(exercise.id, id, name, type, variation, description)}
                    />
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-4">Exercise History</h3>
                  {loadingHistory ? (
                    <div className="text-center py-4">
                      <div className="text-sm text-muted-foreground">Loading exercise history...</div>
                    </div>
                  ) : exerciseHistory.length > 0 ? (
                    <div className="space-y-3">
                      {exerciseHistory.map((entry) => {
                        // Find the best set based on estimated 1RM
                        const bestSet = findBestSet(entry.sets);
                        const e1rm = bestSet?.e1rm;
                        
                        return (
                          <div key={entry.date} className="border rounded-md p-3">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{entry.date}</span>
                              {bestSet ? (
                                <div className="text-right">
                                  <span>
                                    Best: {bestSet.weight} kg × {bestSet.reps} @RPE {bestSet.rpe || 8}
                                  </span>
                                  {e1rm && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      e1RM: {e1rm} kg
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">No valid sets recorded</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="text-sm text-muted-foreground">No history found for this exercise.</div>
                    </div>
                  )}
                </div>
                
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-2">Progress Chart (Est. 1RM)</h3>
                  <div className="h-48 rounded-md">
                    {loadingHistory ? (
                      <div className="h-full flex items-center justify-center bg-muted/30">
                        <span className="text-sm text-muted-foreground">Loading progress data...</span>
                      </div>
                    ) : exerciseHistory.length > 0 ? (
                      <ProgressChart 
                        data={exerciseHistory.map(entry => {
                          // Find the best set for this entry
                          const bestSet = findBestSet(entry.sets);
                          
                          // Ensure valid date for timestamp calculation
                          let timestamp: number;
                          try {
                            timestamp = new Date(entry.date).getTime();
                            // Check if timestamp is valid
                            if (isNaN(timestamp)) {
                              console.warn(`Invalid date format detected: ${entry.date}`);
                              // Use current time as fallback
                              timestamp = Date.now();
                            }
                          } catch (e) {
                            console.error(`Error parsing date: ${entry.date}`, e);
                            timestamp = Date.now();
                          }
                          
                          return {
                            date: entry.date,
                            timestamp,
                            weight: bestSet?.weight || null,
                            reps: bestSet?.reps || null,
                            rpe: bestSet?.rpe || null,
                            e1rm: bestSet?.e1rm || null
                          };
                        })}
                        height={180}
                        showAxisLabels={true}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center bg-muted/30">
                        <span className="text-sm text-muted-foreground">No progress data available yet</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
          
          {/* Action buttons on the right side */}
          <div className="flex items-start space-x-2">            
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                const question = `Explain ${exercise.name}${exercise.variation ? ` (${exercise.variation})` : ''}?`;
                if (setInputText) {
                  setInputText(question);
                }
                toggleDrawer();
                setIsOpen(true);
              }}
              title="Get help with this exercise"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title="Change exercise"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Replace Exercise</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <ExerciseSelect 
                    defaultValue={exercise.name + (exercise.variation ? ` (${exercise.variation})` : '')}
                    onSelected={(id, name, type, variation, description) => onReplaceExercise(exercise.id, id, name, type, variation, description)}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        {exercise.description && exercise.description !== "NULL" && (
          <p className="text-xs text-muted-foreground mt-1 px-1">{exercise.description}</p>
        )}

        {/* Display target values if they exist */}
        {hasTargets && (
          <div className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium">Target: </span>
            {exercise.target_sets && <span>{exercise.target_sets} sets </span>}
            {exercise.target_reps && <span>× {exercise.target_reps} </span>}
            {exercise.target_weight && <span>@ {exercise.target_weight} </span>}
            {exercise.target_rpe && <span>RPE {exercise.target_rpe}</span>}
          </div>
        )}
        
        {/* Display exercise instructions if they exist */}
        {exercise.instructions && (
          <div className="text-xs">
            <span className="font-medium">{exercise.instructions}</span>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {exercise.type === 'weight' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left pb-2">Set</th>
                  <th className="text-left pb-2">Weight (kg)</th>
                  <th className="text-left pb-2">Reps</th>
                  <th className="text-left pb-2">RPE</th>
                  <th className="text-right pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {exercise.sets.map((set) => (
                <tr key={set.id} className="border-t">
                  <td className="py-3 pr-4">
                    <span className="font-medium">{set.set_number}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={set.weight ?? ''}
                      onChange={(e) => handleNumberInput(
                        exercise.id, 
                        set.id, 
                        'weight', 
                        e.target.value
                      )}
                      className="h-8 w-20"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={set.reps ?? ''}
                      onChange={(e) => handleNumberInput(
                        exercise.id, 
                        set.id, 
                        'reps', 
                        e.target.value
                      )}
                      className="h-8 w-16"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={set.rpe ?? ''}
                      placeholder="N/A"
                      onChange={(e) => handleNumberInput(
                        exercise.id, 
                        set.id, 
                        'rpe', 
                        e.target.value
                      )}
                      className="h-8 w-16"
                    />
                  </td>
                  <td className="py-3 text-right">
                    {exercise.sets.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onDeleteSet(exercise.id, set.id)}
                      >
                        ×
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Add Set button moved below the table for better mobile layout */}
          {exercise.type === 'weight' && (
            <div className="mt-4">
              <Button 
                variant="outline" 
                size="sm"
                className="w-full"
                onClick={() => onAddSet(exercise.id)}
              >
                Add Set
              </Button>
            </div>
          )}
        </div>
        )}
        
      {/* Only show button row for weight exercises */}
      {exercise.type === 'weight' && (
        <div className="grid grid-cols-2 gap-6 mt-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowNotes(!showNotes)}
          >
            {showNotes ? "Hide Notes" : "Add Note"}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-destructive"
            onClick={() => onDeleteExercise(exercise.id)}
          >
            Remove
          </Button>
        </div>
      )}
      
      {showNotes && (
        <div className="space-y-2">
          <Textarea
            id={`notes-${exercise.id}`}
            value={exercise.notes || ''}
            placeholder="Add notes for this exercise..."
            onChange={(e) => onExerciseChange(exercise.id, 'notes', e.target.value)}
            className="min-h-[80px] resize-none"
          />
        </div>
      )}
      
      {/* Add a remove button at the bottom for non-weight exercises */}
      {exercise.type !== 'weight' && (
        <div className="mt-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-destructive"
            onClick={() => onDeleteExercise(exercise.id)}
          >
            Remove Exercise
          </Button>
        </div>
      )}
      </CardContent>
    </Card>
  )
}

// Exercise selection component with search functionality
function ExerciseSelect({ defaultValue, onSelected }: {
  defaultValue: string;
  onSelected: (id: number, name: string, type: string, variation?: string, description?: string) => void;
}) {
  const [open, setOpen] = useState(false)
  const [exercises, setExercises] = useState<{id: number, name: string, variation?: string, type: string, description?: string}[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  
  useEffect(() => {
    async function loadExercises() {
      if (!user) return
      
      try {
        const supabase = createClient()
        const exerciseList = await getAllExercises(supabase)
        
        setExercises(exerciseList.map(ex => ({
          id: ex.id,
          name: ex.name,
          variation: ex.variation || undefined,
          type: ex.type || 'Main',
          description: ex.description || undefined
        })))
      } catch (err) {
        console.error('Error loading exercises:', err)
        // Fallback to empty array
        setExercises([])
      } finally {
        setLoading(false)
      }
    }
    
    loadExercises()
  }, [user])
  
  if (loading) {
    return (
      <Button variant="outline" disabled className="w-full justify-start">
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading exercises...
        </span>
      </Button>
    )
  }
  
  // If database has no exercises, provide some defaults
  const options = exercises.length > 0 ? exercises : [
    { id: -1, name: 'Squat', type: 'Main' },
    { id: -2, name: 'Bench Press', type: 'Main' },
    { id: -3, name: 'Deadlift', type: 'Main' },
    // Add more fallback options if needed
  ]
  
  // Group exercises by name first to prioritize variations, then by type
  const exercisesByName = options.reduce((groups, exercise) => {
    if (!groups[exercise.name]) {
      groups[exercise.name] = [];
    }
    groups[exercise.name].push(exercise);
    return groups;
  }, {} as Record<string, typeof options>);
  
  // Sort each group so variations of current exercise appear at the top
  const currentName = defaultValue.split(' (')[0]; // Extract current exercise name
  
  // Create combined grouped structure - first by same name (variations), then by type
  const exerciseGroups: Record<string, typeof options> = {};
  
  // First, add variations of the current exercise as a special group if they exist
  if (currentName && exercisesByName[currentName] && exercisesByName[currentName].length > 0) {
    exerciseGroups["Variations"] = [...exercisesByName[currentName]];
    // Remove this name from the original groups so we don't show duplicates
    delete exercisesByName[currentName];
  }
  
  // Then add all other exercises grouped by type
  options.forEach(exercise => {
    // Skip if this exercise is already in the Variations group
    if (exercise.name === currentName) return;
    
    // Skip NULL type exercises or use 'Other' for empty/missing types
    const type = !exercise.type || exercise.type === 'NULL' ? 'Other' : exercise.type;
    if (!exerciseGroups[type]) {
      exerciseGroups[type] = [];
    }
    // Only add if not already added (to avoid duplicates)
    if (!exerciseGroups[type].some(e => e.id === exercise.id)) {
      exerciseGroups[type].push(exercise);
    }
  });
  
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full justify-start text-left font-normal"
      >
        <span className="truncate">{defaultValue || "Select exercise..."}</span>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command className="rounded-lg border shadow-md">
          <CommandInput placeholder="Search exercises..." />
          <CommandList>
            <CommandEmpty>No exercises found.</CommandEmpty>
            {Object.entries(exerciseGroups).map(([type, exercises]) => (
              <CommandGroup key={type} heading={type}>
                {exercises.map((exercise) => (
                  <CommandItem
                    key={exercise.id}
                    value={`${exercise.name}${exercise.variation ? ' ' + exercise.variation : ''}`}
                    onSelect={() => {
                      // Always call onSelected when an exercise is selected, regardless of whether it's the same exercise
                      // with a different variation or a completely different exercise
                      onSelected(exercise.id, exercise.name, exercise.type || 'weight', exercise.variation, exercise.description)
                      setOpen(false)
                    }}
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
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}