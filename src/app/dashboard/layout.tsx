'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { MobileNav } from '@/components/layout/mobile-nav'
import { useAuth } from '@/components/auth/auth-provider'
import { Capacitor } from '@capacitor/core'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  // Extra protection - redirect unauthenticated users
  useEffect(() => {
    if (!loading && !user) {
      console.log('Dashboard layout - redirecting unauthenticated user')
      if (!Capacitor.isNativePlatform()) {
        router.push('/auth/login')
      } else {
        console.log('Dashboard layout - native platform detected, skipping redirect.')
      }
    }
  }, [user, loading, router])

  // Show loading indicator while checking auth
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pb-16">
        <div className="container p-4">{children}</div>
      </main>
      <MobileNav />
    </div>
  )
}