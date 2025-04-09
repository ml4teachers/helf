'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useAssistant } from '@/components/assistant/assistant-provider'
import { createClient } from '@/lib/supabaseClient'
import { getUserTrainingData } from '@/lib/trainingModulesNew/userTraining'
import { getNextTrainingSession } from '@/lib/trainingModulesNew/sessionManagement'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardList, Dumbbell, DumbbellIcon, Sparkles } from 'lucide-react'
import { BodyweightCard } from '@/components/dashboard/BodyweightCard'



export default function DashboardPage() {
  const { user } = useAuth()
  const { setIsOpen } = useAssistant()
  // Recent workouts state - we'll only use the setter
  const [, setRecentWorkouts] = useState<{id: number, date: string, name: string, exercises: Array<{name: string, type: string, details?: string, sets: Array<{weight?: number, reps?: number, rpe?: number | null, completed: boolean}>, notes?: string}>}[]>([])
  const [nextSession, setNextSession] = useState<{id: number, name?: string, notes?: string, session_order?: number} | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastActiveSessionId, setLastActiveSessionId] = useState<number | null>(null)
  
  useEffect(() => {
    async function fetchData() {
      if (!user) return
      
      try {
        const supabase = createClient()
        
        // Fetch data in parallel for better performance
        const [trainingData, nextSessionData] = await Promise.all([
          getUserTrainingData(supabase, user.id),
          getNextTrainingSession(supabase, user.id)
        ])
        
        setRecentWorkouts(trainingData.recentWorkouts)
        setNextSession(nextSessionData)
        
        // Check if there's a saved session to resume
        if (typeof window !== 'undefined') {
          const savedSessionId = localStorage.getItem('lastActiveSessionId');
          if (savedSessionId) {
            // First, check if the session is actually completed in the database
            try {
              const { data: sessionStatus } = await supabase
                .from('user_sessions')
                .select('status')
                .eq('id', savedSessionId)
                .single();
              
              // If the session is completed in the database, clear it from localStorage
              if (sessionStatus && sessionStatus.status === 'completed') {
                console.log('Session is already completed in database, clearing localStorage');
                localStorage.removeItem(`session_${savedSessionId}`);
                localStorage.removeItem('lastActiveSessionId');
              } else {
                // Check local storage for session data
                const sessionData = localStorage.getItem(`session_${savedSessionId}`);
                if (sessionData) {
                  try {
                    const parsedData = JSON.parse(sessionData);
                    const lastUpdated = new Date(parsedData.lastUpdated);
                    const now = new Date();
                    const hoursSinceLastUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
                    
                    // Only show resume option if session was active in the last 48 hours
                    // and the session isn't completed in the database
                    if (hoursSinceLastUpdate < 48) {
                      console.log('Found active session to resume:', savedSessionId);
                      setLastActiveSessionId(parseInt(savedSessionId, 10));
                    } else {
                      // Session data is too old, clear it
                      localStorage.removeItem(`session_${savedSessionId}`);
                      localStorage.removeItem('lastActiveSessionId');
                    }
                  } catch (e) {
                    console.error('Error parsing saved session data:', e);
                    // Clear invalid data
                    localStorage.removeItem(`session_${savedSessionId}`);
                    localStorage.removeItem('lastActiveSessionId');
                  }
                } else {
                  // No session data found, clear reference
                  localStorage.removeItem('lastActiveSessionId');
                }
              }
            } catch (err) {
              console.error('Error checking session status:', err);
              // Clear potentially invalid data
              localStorage.removeItem(`session_${savedSessionId}`);
              localStorage.removeItem('lastActiveSessionId');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [user])

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-medium">
          Welcome
          {typeof user?.user_metadata?.name === 'string'
            ? `, ${user.user_metadata.name.split(' ')[0]}`
            : ''}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ready to improve your helf today?
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {lastActiveSessionId ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Resume Session</span>
                <ClipboardList size={18} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <p>You have an active session that was not completed</p>
                <p className="text-muted-foreground">Continue where you left off</p>
                <div className="flex flex-col gap-2 mt-4">
                  <Button className="w-full" asChild>
                    <Link href={`/dashboard/sessions/${lastActiveSessionId}`}>
                      Resume Session
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : nextSession ? (
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Next Session</span>
                <ClipboardList size={18}/>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <p>{nextSession.name || `Session ${nextSession.session_order || ''}`}</p>
                <p className="text-muted-foreground">{nextSession.notes || 'No description available'}</p>
                <div className="flex flex-col gap-2 mt-4">
                  <Button className="w-full" asChild>
                    <Link href={`/dashboard/sessions/${nextSession.id}`}>
                      Start This Session
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/dashboard/sessions/new">
                      Create Empty Session
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center justify-between">Start Workout<ClipboardList size={18} /></div></CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {loading ? 'Loading your plan...' : 'No planned sessions found. Create a new session or get a plan.'}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsOpen(true)}>
                Get a Plan
              </Button>
              <Button asChild>
                <Link href="/dashboard/sessions/new">New Session</Link>
              </Button>
            </div>
            </CardContent>
          </Card>
        )}

        <BodyweightCard />

        <Card className="">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Training Assistant</span>
              <Sparkles size={18} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Get personalized training advice and plans
            </p>
            <Button className="mt-4 w-full" onClick={() => setIsOpen(true)}>
              Talk to Assistant
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}