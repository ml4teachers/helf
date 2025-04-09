'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabaseClient'
import { getUserTrainingPlan } from '@/lib/trainingService'
import { deleteTrainingPlan } from '@/lib/trainingModulesNew/planManagement'
import { useAuth } from '@/components/auth/auth-provider'
import { useAssistant } from '@/components/assistant/assistant-provider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, ClipboardList, BarChart, ChevronLeft, ChevronRight, Info, AlertTriangle } from 'lucide-react'
import { ExerciseProgressTracker } from '@/components/dashboard/ExerciseProgressTracker'

export default function PlanPage() {
  const { user } = useAuth()
  const { setIsOpen } = useAssistant()
  const router = useRouter()
  
  interface PlanSession {
    id: string | number;
    name?: string;
    type?: string;
    instructions?:string;
    notes?: string;
    session_order?: number;
    scheduled_date?: string;
    status?: string;
    mesocycle?: number;
    exercises?: Array<Record<string, unknown>>;
    weekFocus?: string;
    [key: string]: unknown;
  }

  interface PlanType {
    id?: number;
    name: string;
    weeks: number;
    description?: string;
    start_date: string;
    goal?: string;
    status?: string;
    currentWeek?: number;
    sessions: PlanSession[];
    sessionsByWeek?: Record<number, PlanSession[]>;
  }
  
  const [plan, setPlan] = useState<PlanType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    async function loadPlan() {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const supabase = createClient()
        const planData = await getUserTrainingPlan(supabase, user.id)
        
        // Ensure the data has all required fields for our PlanType
        if (planData) {
          // Create a properly typed plan data
          const typedPlanData: PlanType = {
            id: typeof planData.id === 'number' ? planData.id : undefined,
            name: typeof planData.name === 'string' ? planData.name : 'Training Plan',
            weeks: typeof planData.weeks === 'number' ? planData.weeks : 0,
            description: typeof planData.description === 'string' ? planData.description : undefined,
            // Use any available date field as start_date, or generate a new one
            start_date: new Date().toISOString(), // Default value
            goal: typeof planData.goal === 'string' ? planData.goal : undefined,
            status: typeof planData.status === 'string' ? planData.status : undefined,
            currentWeek: typeof planData.currentWeek === 'number' ? planData.currentWeek : undefined,
            sessions: Array.isArray(planData.sessions) ? planData.sessions as PlanSession[] : [],
            sessionsByWeek: planData.sessionsByWeek ? planData.sessionsByWeek as Record<number, PlanSession[]> : undefined
          }
          
          // Try to find a date field to use as start_date
          // Use type assertions to avoid TypeScript errors - we know this might not have the exact types,
          // but we're defensively coding with the typeof checks
          
          // @ts-expect-error - Using dynamic property access for type safety
          if (typeof planData.start_date === 'string') {
            // @ts-expect-error - Using dynamic property access for type safety
            typedPlanData.start_date = planData.start_date;
          } 
          // @ts-expect-error - Using dynamic property access for type safety
          else if (typeof planData.created_at === 'string') {
            // @ts-expect-error - Using dynamic property access for type safety
            typedPlanData.start_date = planData.created_at;
          } 
          // @ts-expect-error - Using dynamic property access for type safety
          else if (typeof planData.updated_at === 'string') {
            // @ts-expect-error - Using dynamic property access for type safety
            typedPlanData.start_date = planData.updated_at;
          }
          setPlan(typedPlanData)
        } else {
          setPlan(null)
        }
        
        // Set the selected week to the current week in the plan when data loads
        if (planData && planData.currentWeek) {
          setSelectedWeek(planData.currentWeek as number)
        }
      } catch (err) {
        console.error('Error loading training plan:', err)
        setError('Failed to load training plan. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    loadPlan()
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="text-muted-foreground">Loading training plan...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border p-4 text-red-500">
        <p>{error}</p>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">My Training Plan</h1>
        </div>
        
        <div className="rounded-lg border p-8 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <h2 className="text-lg font-medium">No Training Plan Found</h2>
            <p className="text-sm text-muted-foreground">
              You don&apos;t have an active training plan yet. Get a personalized plan tailored to your goals.
            </p>
            <Button onClick={() => setIsOpen(true)} className="mt-4">
              Create Plan with Assistant
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Group sessions by their intended training day (based on order)
  
  // Helper function to get sessions for the selected week
  const getSessionsForWeek = (weekNumber: number): PlanSession[] => {
    // First check if sessionsByWeek structure exists (new format)
    if (plan.sessionsByWeek && plan.sessionsByWeek[weekNumber]) {
      return plan.sessionsByWeek[weekNumber];
    }
    
    // Filter sessions by mesocycle (fallback for backward compatibility)
    return plan.sessions.filter((session) => 
      session.mesocycle === weekNumber
    );
  };
  
  // Get sessions for the currently selected week
  const currentWeekSessions = getSessionsForWeek(selectedWeek);
  
  // Debug: Check what data we have for exercises
  console.log('Plan sessions:', plan.sessions.map(s => ({
    id: s.id,
    name: s.name,
    exercisesCount: Array.isArray(s.exercises) ? s.exercises.length : 0
  })));
  
  // Get available weeks
  const availableWeeks = plan.sessionsByWeek 
    ? Object.keys(plan.sessionsByWeek).map(Number).sort((a, b) => a - b)
    : Array.from({ length: plan.weeks || 1 }, (_, i) => i + 1);
  
  // Week navigation handlers
  const handlePrevWeek = () => {
    const currentIndex = availableWeeks.indexOf(selectedWeek);
    if (currentIndex > 0) {
      setSelectedWeek(availableWeeks[currentIndex - 1]);
    }
  };
  
  const handleNextWeek = () => {
    const currentIndex = availableWeeks.indexOf(selectedWeek);
    if (currentIndex < availableWeeks.length - 1) {
      setSelectedWeek(availableWeeks[currentIndex + 1]);
    }
  };
  
  // Get week focus if available
  const getWeekFocus = () => {
    // Check if we have detailed week information
    if (plan.sessionsByWeek && 
        plan.sessionsByWeek[selectedWeek] && 
        plan.sessionsByWeek[selectedWeek][0] && 
        plan.sessionsByWeek[selectedWeek][0].weekFocus) {
      return plan.sessionsByWeek[selectedWeek][0].weekFocus;
    }
    return null;
  };
  
  const weekFocus = getWeekFocus();
  
  // Handle plan deletion
  const handleDeletePlan = async () => {
    if (!user || !plan?.id) return;
    
    try {
      setIsDeleting(true);
      const supabase = createClient();
      await deleteTrainingPlan(supabase, user.id, plan.id);
      
      // Close dialog and redirect to dashboard
      setShowDeleteDialog(false);
      setPlan(null);
      router.push('/dashboard');
      
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Failed to delete training plan. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Training Plan</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
            Adjust Plan
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-destructive" 
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete Plan
          </Button>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Training Plan
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this training plan? This action will permanently remove:
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 py-2">
            <p className="text-sm font-medium">This will delete:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>The entire training plan</li>
              <li>All training weeks</li>
              <li>All scheduled training sessions</li>
              <li>All exercises and sets within those sessions</li>
            </ul>
            <p className="text-sm text-destructive mt-4 font-medium">This action cannot be undone.</p>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePlan}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription className="mt-1">
                {plan.weeks > 1 ? `${plan.weeks}-week program` : '1-week program'}
              </CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              Started {plan.start_date ? new Date(plan.start_date).toLocaleDateString() : 'N/A'}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {plan.description || 'Your personalized training program'}
          </p>
          
          
          <Tabs defaultValue="sessions">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sessions">
                <ClipboardList className="h-4 w-4 mr-2" />
                Upcoming
              </TabsTrigger>
              <TabsTrigger value="weekly">
                <Calendar className="h-4 w-4 mr-2" />
                Past
              </TabsTrigger>
              <TabsTrigger value="progress">
                <BarChart className="h-4 w-4 mr-2" />
                Progress
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="sessions" className="mt-4 space-y-4">
              {plan.sessions.filter(session => 
                (session.status === 'upcoming' || session.status === 'planned') &&
                (!session.completed_date || session.completed_date === null)
              ).sort((a, b) => {
                // Sort by week number first, then by session order
                const weekA = Number(a.week_number || a.mesocycle || 1);
                const weekB = Number(b.week_number || b.mesocycle || 1);
                if (weekA !== weekB) return weekA - weekB;
                
                const orderA = a.session_order || 0;
                const orderB = b.session_order || 0;
                return orderA - orderB;
              }).map((session) => (
                <Card key={String(session.id)} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">
                        <Link href={`/dashboard/sessions/${session.id}`} className="hover:underline cursor-pointer">
                          {session.mesocycle && session.session_order 
                            ? `Week ${session.mesocycle} Session ${session.session_order}`
                            : (session.name as string) || 'Training Session'}
                        </Link>
                      </CardTitle>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/sessions/${session.id}`}>
                          View
                        </Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">
                      {Array.isArray(session.exercises) && session.exercises.length > 0 && (
                        <div className="space-y-1">
                          {session.exercises.slice(0, 3).map((exercise: any, index) => (
                            <div key={index} className="text-xs">
                              <Link href={`/dashboard/sessions/${session.id}`}>
                                <span className="font-medium hover:underline cursor-pointer">{exercise.name}</span>
                                {(exercise.variation || exercise.details) && 
                                  <span className="text-muted-foreground ml-1">({exercise.variation || exercise.details})</span>
                                }
                                {exercise.target_sets && exercise.target_reps && (
                                  <span className="text-muted-foreground ml-2">
                                    {exercise.target_sets} sets × {exercise.target_reps}
                                    {exercise.target_rpe && ` @RPE ${exercise.target_rpe}`}
                                    {exercise.target_weight && ` ${exercise.target_weight}kg`}
                                  </span>
                                )}
                              </Link>
                            </div>
                          ))}
                          {session.exercises.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{session.exercises.length - 3} more exercises
                            </div>
                          )}
                        </div>
                      )}
                      
                      {(!session.exercises || session.exercises.length === 0) && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Loading exercises...
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {!plan.sessions.some(session => 
                (session.status === 'upcoming' || session.status === 'planned') &&
                !session.completed_date
              ) && (
                <div className="text-center p-8 border border-dashed rounded-lg">
                  <Info className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No upcoming sessions found</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => setIsOpen(true)}
                  >
                    Create New Training Plan
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="weekly" className="mt-4 space-y-4">
              {plan.sessions.filter(session => 
                session.status === 'completed' || (typeof session.completed_date !== 'undefined' && session.completed_date !== null)
              ).sort((a, b) => {
                // Sort by completion date, most recent first
                const dateA = a.completed_date ? new Date(String(a.completed_date)).getTime() : 0;
                const dateB = b.completed_date ? new Date(String(b.completed_date)).getTime() : 0;
                return dateB - dateA;
              }).map((session) => (
                <Card key={String(session.id)} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">
                        <Link href={`/dashboard/sessions/${session.id}`} className="hover:underline cursor-pointer">
                          {session.mesocycle && session.session_order 
                            ? `Week ${session.mesocycle} Session ${session.session_order}`
                            : (session.name as string) || 'Training Session'}
                        </Link>
                      </CardTitle>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/sessions/${session.id}`}>
                          View
                        </Link>
                      </Button>
                    </div>
                    {typeof session.completed_date !== 'undefined' && session.completed_date !== null && (
                      <p className="text-xs text-muted-foreground">
                        Completed: {new Date(String(session.completed_date)).toLocaleDateString()}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">                 
                      {/* Show completed exercises if available */}
                      {Array.isArray(session.exercises) && session.exercises.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {session.exercises.slice(0, 3).map((exercise: any, index) => (
                            <div key={index} className="text-xs">
                              <Link href={`/dashboard/sessions/${session.id}`}>
                                <span className="font-medium hover:underline cursor-pointer">{exercise.name}</span>
                                {(exercise.variation || exercise.details) && 
                                  <span className="text-muted-foreground ml-1">({exercise.variation || exercise.details})</span>
                                }
                              </Link>
                              
                              {/* Show completed sets information if available */}
                              {Array.isArray(exercise.sets) && exercise.sets.length > 0 && (
                                <div className="pl-2 text-muted-foreground">
                                  {exercise.sets.filter((s: any) => s.completed).map((set: any, idx: number) => (
                                    <span key={idx} className="mr-2">
                                      {set.weight && set.reps ? `${set.weight}kg × ${set.reps}` : ''}
                                      {set.rpe ? ` @${set.rpe}` : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                              
                              {/* If no sets available, show target information */}
                              {(!Array.isArray(exercise.sets) || exercise.sets.length === 0) && exercise.target_sets && exercise.target_reps && (
                                <div className="pl-2 text-muted-foreground">
                                  Planned: {exercise.target_sets}×{exercise.target_reps}
                                  {exercise.target_rpe && ` @RPE ${exercise.target_rpe}`}
                                  {exercise.target_weight && ` ${exercise.target_weight}kg`}
                                </div>
                              )}
                            </div>
                          ))}
                          {session.exercises.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{session.exercises.length - 3} more exercises
                            </div>
                          )}
                        </div>
                      )}
                      
                      {(!session.exercises || session.exercises.length === 0) && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Loading exercises...
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {!plan.sessions.some(session => 
                session.status === 'completed' || session.completed_date
              ) && (
                <div className="text-center p-8 border border-dashed rounded-lg">
                  <Info className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No completed sessions yet</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="progress" className="mt-4">
              <ExerciseProgressTracker />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}