'use client'

import { useAuth } from '@/components/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { usePathname } from 'next/navigation'
import { ModeToggle } from './mode-toggle'
import { LogOutIcon } from 'lucide-react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export function Header() {
  const { signOut, user } = useAuth()
  const pathname = usePathname()
  const [sessionName, setSessionName] = useState<string | null>(null)
  
  // Use an effect to track session name changes
  useEffect(() => {
    // Check if we're on a session page
    const sessionMatch = pathname.match(/\/dashboard\/sessions\/(\d+)/)
    
    if (sessionMatch && typeof window !== 'undefined') {
      // Try to get session name from sessionStorage
      const storedName = window.sessionStorage.getItem('currentSessionName')
      setSessionName(storedName)
      
      // Set up a storage event listener to update if another component changes it
      const handleStorageChange = () => {
        const updatedName = window.sessionStorage.getItem('currentSessionName')
        setSessionName(updatedName)
      }
      
      window.addEventListener('storage', handleStorageChange)
      
      // Poll for changes (in case sessionStorage is updated after this component mounts)
      const intervalId = setInterval(() => {
        const currentName = window.sessionStorage.getItem('currentSessionName')
        if (currentName !== sessionName) {
          setSessionName(currentName)
        }
      }, 500)
      
      return () => {
        window.removeEventListener('storage', handleStorageChange)
        clearInterval(intervalId)
      }
    } else {
      setSessionName(null)
    }
  }, [pathname, sessionName])
  
  // Extract the page title from the pathname
  const getPageTitle = () => {
    if (pathname === '/dashboard') return 'Dashboard'
    
    // For session detail pages, use the state variable
    if (pathname.match(/\/dashboard\/sessions\/\d+/)) {
      return 'Workout'
    }
    
    // Split the pathname and get the last segment
    const segments = pathname.split('/')
    const lastSegment = segments[segments.length - 1]
    
    // Capitalize the first letter
    return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background py-4 px-8">
      <div className="container flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="flex items-center">
            <Image 
              src="/logo.svg" 
              alt="HELF Logo" 
              width={22} 
              height={22} 
              className="mr-4 invert dark:invert-0" 
            />
            <h1 className="text-2xl font-bold">{getPageTitle()}</h1>
          </Link>
        </div>
        
        <div className="flex items-center gap-2">
          <ModeToggle />
          {user && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => signOut()}
              aria-label="Sign out"
            >
              <LogOutIcon className="h-4 w-4" />  
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}