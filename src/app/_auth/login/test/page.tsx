'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
// Da wir keine separate Label-Komponente haben, nutzen wir einfaches label-Element
import { cn } from '@/lib/utils'
import Image from 'next/image'

export default function TestLoginPage() {
  const { signInWithPassword, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    
    try {
      await signInWithPassword(email, password)
    } catch (err) {
      console.error('Error during sign in:', err)
      setError('Invalid email or password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center mt-8 sm:mt-32 p-4 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Image 
            src="/logo.svg" 
            alt="HELF Logo" 
            width={68} 
            height={68} 
            className="mx-auto mb-2 invert dark:invert-0" 
          />
          <h1 className="text-3xl font-black tracking-tight">HELF</h1>
          <p className="mt-3 text-xl text-muted-foreground">
            Test Login
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Test Login</CardTitle>
            <CardDescription>
              Internal testing login page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <Input 
                  id="email"
                  type="email" 
                  placeholder="test@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                <Input 
                  id="password"
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              {error && (
                <div className="text-sm text-red-500 font-medium">
                  {error}
                </div>
              )}
              
              <Button
                type="submit"
                disabled={isLoading || loading}
                className={cn(
                  "w-full py-5 text-base mt-2",
                  isLoading && "opacity-70"
                )}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </span>
                ) : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}