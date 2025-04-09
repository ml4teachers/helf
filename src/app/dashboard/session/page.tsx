'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import { getNextTrainingSession } from '@/lib/trainingModulesNew/sessionManagement'
import { useAuth } from '@/components/auth/auth-provider'

export default function SessionRedirect() {
  const router = useRouter()
  const { user } = useAuth()

  // This component will automatically redirect to the next session
  // or to the session creation page if no active session is found
  useEffect(() => {
    async function redirectToSession() {
      if (!user) {
        return
      }

      try {
        // First check if there's an active session in localStorage
        let activeSessionId = null;
        
        if (typeof window !== 'undefined') {
          const savedSessionId = localStorage.getItem('lastActiveSessionId');
          if (savedSessionId) {
            const sessionData = localStorage.getItem(`session_${savedSessionId}`);
            if (sessionData) {
              try {
                // Try to parse the session data to make sure it's valid
                const parsedData = JSON.parse(sessionData);
                
                // Check if the session is not completed (prevent resuming completed sessions)
                if (parsedData && parsedData.session && parsedData.session.status !== 'completed') {
                  activeSessionId = parseInt(savedSessionId, 10);
                  console.log('Found active session in localStorage:', activeSessionId);
                } else {
                  console.log('Found completed session in localStorage, not resuming.');
                  // Clean up localStorage for completed sessions
                  localStorage.removeItem(`session_${savedSessionId}`);
                  localStorage.removeItem('lastActiveSessionId');
                }
              } catch (e) {
                console.error('Error parsing saved session data:', e);
              }
            }
          }
        }

        // If we have an active session in localStorage, redirect to it
        if (activeSessionId) {
          router.push(`/dashboard/sessions/${activeSessionId}`);
          return;
        }

        // Otherwise, check for the next session in the database
        try {
          console.log('Checking for next training session in database');
          const supabase = createClient();
          const nextSession = await getNextTrainingSession(supabase, user.id);
  
          if (nextSession) {
            console.log('Found next training session in database:', nextSession.id);
            // Redirect to the next active or planned session
            router.push(`/dashboard/sessions/${nextSession.id}`);
          } else {
            console.log('No sessions found, redirecting to plan page');
            // No active session found, redirect to plan page
            router.push('/dashboard/plan');
          }
        } catch (error) {
          console.error('Error fetching next training session:', error);
          // On error, redirect to plan page
          router.push('/dashboard/plan');
        }
      } catch (error) {
        console.error('Error fetching next session:', error);
        // On error, redirect to sessions overview
        router.push('/dashboard/plan');
      }
    }

    redirectToSession();
  }, [router, user])

  // Show a loading indicator while redirecting
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="text-muted-foreground">Loading your training session...</div>
      </div>
    </div>
  )
}