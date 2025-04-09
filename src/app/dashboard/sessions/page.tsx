'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function SessionsPage() {
  const router = useRouter()
  
  // This page is now just a redirect to the plan page
  useEffect(() => {
    router.push('/dashboard/plan')
  }, [router])
  
  // Show a simple loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="text-muted-foreground">Redirecting to your training plan...</div>
      </div>
    </div>
  )
}