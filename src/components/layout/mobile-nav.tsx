'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ClipboardList, ChartLine, Sparkles, UserCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { useAuth } from '@/components/auth/auth-provider'

const navItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard size={24} />, // LayoutDashboard Icon
  },
  {
    name: 'Session',
    href: '/dashboard/session',
    icon: <ClipboardList size={24} />,
    dynamic: true, // This will check for active sessions
  },
  {
    name: 'Plan',
    href: '/dashboard/plan',
    icon: <ChartLine size={24} />,
  },
  {
    name: 'Assistant',
    href: '#',
    action: 'assistant',
    icon: <Sparkles size={24} />,
  },
  {
    name: 'Profile',
    href: '/dashboard/profile',
    icon: <UserCircle size={24} />,
  },
]

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)

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

  // Check for active sessions when the component mounts
  useEffect(() => {
    const checkForActiveSessions = async () => {
      if (typeof window !== 'undefined') {
        // First check for active session in cookies (for iOS compatibility)
        const cookieSessionId = getCookie('session_id_ref');
        if (cookieSessionId) {
          const cookieData = getCookie(`session_data_${cookieSessionId}`);
          if (cookieData) {
            try {
              const parsedData = JSON.parse(cookieData);
              // Verify the session exists and is not completed
              if (parsedData?.session && parsedData.session.status !== 'completed') {
                setActiveSessionId(parseInt(cookieSessionId, 10));
                console.log('Found active session in cookies:', cookieSessionId);
                return;
              }
            } catch (e) {
              console.error('Error parsing saved session cookie data:', e);
            }
          }
        }
        
        // If not found in cookies, check localStorage
        const savedSessionId = localStorage.getItem('lastActiveSessionId');
        if (savedSessionId) {
          const sessionData = localStorage.getItem(`session_${savedSessionId}`);
          if (sessionData) {
            try {
              const parsedData = JSON.parse(sessionData);
              // Verify the session exists and is not completed
              if (parsedData?.session && parsedData.session.status !== 'completed') {
                setActiveSessionId(parseInt(savedSessionId, 10));
                console.log('Found active session in localStorage:', savedSessionId);
                return;
              }
            } catch (e) {
              console.error('Error parsing saved session data:', e);
            }
          }
          
          // Clean up invalid localStorage references
          localStorage.removeItem(`session_${savedSessionId}`);
          localStorage.removeItem('lastActiveSessionId');
        }
        
        // If no active session in localStorage, check for planned sessions
        if (user) {
          try {
            const supabase = createClient();
            const { data: session } = await supabase
              .from('user_sessions')
              .select('id, status, scheduled_date')
              .eq('user_id', user.id)
              .eq('status', 'planned')
              .order('scheduled_date', { ascending: true })
              .limit(1)
              .single();
              
            if (session) {
              console.log('Found next planned session in database:', session.id);
              setActiveSessionId(session.id);
            } else {
              console.log('No active or planned sessions found');
              setActiveSessionId(null);
            }
          } catch (error) {
            console.error('Error checking for planned sessions:', error);
            setActiveSessionId(null);
          }
        }
      }
    };
    
    checkForActiveSessions();
    
    // Re-check when storage changes
    const handleStorageChange = () => {
      checkForActiveSessions();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user]);

  return (
    <nav className="fixed bottom-0 left-0 z-50 w-full border-t bg-background py-2">
      <div className="mx-auto grid max-w-md grid-cols-5 px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '#' && pathname.startsWith(`${item.href}/`))
          
          // Assistant button handling
          if (item.action === 'assistant') {
            return (
              <button
                key={item.name}
                onClick={() => {
                  // This will be handled by the AssistantProvider
                  window.dispatchEvent(new CustomEvent('toggleAssistant'))
                }}
                className={cn(
                  "flex flex-col items-center justify-center space-y-1 rounded-md p-2 text-xs",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span className="h-6 w-6">{item.icon}</span>
                <span>{item.name}</span>
              </button>
            )
          }
          
          // Special handling for Sessions nav item to redirect to active session if available
          if (item.dynamic && item.name === 'Session') {
            return (
              <button
                key={item.name}
                onClick={() => {
                  // Simplify navigation logic:
                  // 1. If we have an active session ID (which has been verified in the useEffect),
                  //    go directly to that session
                  // 2. If no active session, go to the session redirect page which will handle the logic
                  if (activeSessionId) {
                    console.log('Navigating to session:', activeSessionId);
                    router.push(`/dashboard/sessions/${activeSessionId}`);
                  } else {
                    console.log('No active session found, redirecting to session handler');
                    // Use the /dashboard/session path which will handle finding the next planned session
                    // or creating a new one
                    router.push('/dashboard/session');
                  }
                }}
                className={cn(
                  "flex flex-col items-center justify-center space-y-1 rounded-md p-2 text-xs",
                  isActive || pathname.includes('/dashboard/sessions/') ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span className="h-6 w-6">{item.icon}</span>
                <span>{activeSessionId ? 'Resume' : 'Session'}</span>
              </button>
            );
          }
          
          // Standard nav items
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 rounded-md p-2 text-xs",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className="h-6 w-6">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}