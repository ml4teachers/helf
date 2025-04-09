'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'
import { AuthError } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

type AuthContextType = {
  user: User | null
  loading: boolean
  signIn: (provider: 'google') => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  saveLastPath: (path: string) => void
}

const AUTH_RELATED_PATHS = ['/auth', '/login', '/register', '/forgot-password']
const LAST_PATH_STORAGE_KEY = 'helf_last_non_auth_path'
const DEFAULT_REDIRECT_PATH = '/dashboard'

// Helper functions for storage
function getLastPath(): string {
  if (typeof window === 'undefined') return DEFAULT_REDIRECT_PATH

  // Try to get from cookie first (more reliable on iOS)
  const cookieValue = getCookie(LAST_PATH_STORAGE_KEY)
  if (cookieValue) return cookieValue
  
  // Fall back to localStorage
  const storedValue = localStorage.getItem(LAST_PATH_STORAGE_KEY)
  return storedValue || DEFAULT_REDIRECT_PATH
}

function saveLastPath(path: string): void {
  if (typeof window === 'undefined' || !path) return
  if (path === DEFAULT_REDIRECT_PATH) return // Don't save the default

  // Don't save auth related paths
  if (AUTH_RELATED_PATHS.some(authPath => path.startsWith(authPath))) return

  console.log(`[AuthProvider] Saving last path: ${path}`)
  localStorage.setItem(LAST_PATH_STORAGE_KEY, path)
  setCookie(LAST_PATH_STORAGE_KEY, path, 7) // Save as cookie too for iOS
}

// Cookie helper functions
function setCookie(name: string, value: string, days: number = 7) {
  if (typeof document === 'undefined') return
  
  let expires = ''
  if (days) {
    const date = new Date()
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000))
    expires = `; expires=${date.toUTCString()}`
  }
  document.cookie = `${name}=${value || ''}${expires}; path=/`
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  
  const nameEQ = `${name}=`
  const ca = document.cookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) === ' ') c = c.substring(1, c.length)
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length)
  }
  return null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  
  // Track path changes to save the last non-auth path
  useEffect(() => {
    if (pathname && !AUTH_RELATED_PATHS.some(authPath => pathname.startsWith(authPath))) {
      saveLastPath(pathname)
    }
  }, [pathname])

  useEffect(() => {
    // Check authenticated user
    const checkUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()
        
        if (error) {
          if (error instanceof AuthError && error.name === 'AuthSessionMissingError') {
            console.log('No session found, user needs to sign in')
          } else {
            console.error('Error getting authenticated user:', error)
          }
          setLoading(false)
          return
        }
        
        if (data?.user) {
          setUser(data.user)
        }
      } catch (error) {
        console.error('Exception during auth check:', error)
      } finally {
        setLoading(false)
      }
    }

    checkUser()

    // Listen for auth changes
    let authListener: { subscription: { unsubscribe: () => void } } | null = null
    
    try {
      const { data: listener } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          setUser(session?.user ?? null)
          
          if (event === 'SIGNED_IN') {
            // Get the last non-auth path or default to /dashboard
            const lastPath = getLastPath()
            console.log(`[AuthProvider] User signed in, redirecting to: ${lastPath}`)
            if (!Capacitor.isNativePlatform()) {
              router.push(lastPath)
            } else {
              console.log('[AuthProvider] Native platform detected, skipping web redirect after SIGNED_IN.')
            }
          }
          
          if (event === 'SIGNED_OUT') {
            if (!Capacitor.isNativePlatform()) {
              router.push('/auth/login')
            } else {
              console.log('[AuthProvider] Native platform detected, skipping web redirect after SIGNED_OUT.')
            }
          }
        }
      )
      
      authListener = listener
    } catch (error) {
      console.error('Error setting up auth listener:', error)
    }

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe()
      }
    }
  }, [router, supabase])

  const signIn = async (provider: 'google') => {
    setLoading(true)
    
    try {
      // Determine appropriate redirect URL
      const redirectUrl = process.env.NODE_ENV === 'production'
        ? 'https://forhealth.com/auth/callback'
        : `${window.location.origin}/auth/callback`;
        
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
        },
      })
      
      if (error) {
        console.error('Error signing in:', error)
      }
    } catch (e) {
      console.error('OAuth sign in error:', e)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Error signing out:', error)
    }
    
    setLoading(false)
  }

  const signInWithPassword = async (email: string, password: string) => {
    setLoading(true)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        console.error('Error signing in with password:', error)
        throw error
      }
      
      // Get the last non-auth path or default to /dashboard
      const lastPath = getLastPath()
      console.log(`[AuthProvider] User signed in with password, redirecting to: ${lastPath}`)
      if (!Capacitor.isNativePlatform()) {
        router.push(lastPath)
      } else {
        console.log('[AuthProvider] Native platform detected, skipping web redirect after password sign in.')
      }
    } catch (e) {
      console.error('Password sign in error:', e)
      throw e
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signIn, 
      signInWithPassword, 
      signOut,
      saveLastPath: (path) => saveLastPath(path) 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  
  return context
}