"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabaseClient"
import { Capacitor } from '@capacitor/core'

export default function Home() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      
      if (data?.user) {
        router.push("/dashboard")
      } else {
        if (!Capacitor.isNativePlatform()) {
          router.push("/auth/login")
        } else {
          console.log("Home page: Native platform detected, user not logged in, redirecting to dashboard.");
          router.push("/dashboard")
        }
      }
    }

    checkUser()
  }, [router, supabase])

  return null
}
