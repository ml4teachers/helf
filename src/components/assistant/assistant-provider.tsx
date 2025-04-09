'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { AssistantDrawer } from './assistant-drawer'

type AssistantContextType = {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  toggleDrawer: () => void
  hasWorkouts?: boolean
  sendMessage: (message: string) => Promise<{content: string} | undefined>
  messages: Array<{id: string, role: 'user' | 'assistant', content: string}>
  setInputText?: (text: string) => void
  inputText?: string
}

const AssistantContext = createContext<AssistantContextType | undefined>(undefined)

export function useAssistant() {
  const context = useContext(AssistantContext)
  if (context === undefined) {
    throw new Error('useAssistant must be used within an AssistantProvider')
  }
  return context
}

interface AssistantProviderProps {
  children: ReactNode
}

export function AssistantProvider({ children }: AssistantProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Array<{id: string, role: 'user' | 'assistant', content: string}>>([])
  const [inputText, setInputText] = useState<string>('')

  const toggleDrawer = () => {
    setIsOpen((prev) => !prev)
  }
  
  const sendMessage = async (message: string): Promise<{content: string} | undefined> => {
    try {
      // Add user message to messages
      const userMessage = {
        id: Date.now().toString(),
        role: 'user' as const,
        content: message
      }
      setMessages(prev => [...prev, userMessage])
      
      // Get current session data if we're in a session context
      const path = window.location.pathname
      const sessionMatch = path.match(/\/dashboard\/sessions\/(\d+)/)
      let currentSession = null
      
      if (sessionMatch && sessionMatch[1]) {
        const sessionId = parseInt(sessionMatch[1], 10)
        if (!isNaN(sessionId)) {
          currentSession = { id: sessionId }
        }
      }
      
      // Send message to API
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          currentSession
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to send message')
      }
      
      const data = await response.json()
      
      // Add assistant response to messages
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: data.content
      }
      setMessages(prev => [...prev, assistantMessage])
      
      return assistantMessage
    } catch (error) {
      console.error('Error sending message:', error)
      return undefined
    }
  }

  // Listen for custom event from mobile nav
  useEffect(() => {
    const handleToggleAssistant = () => {
      toggleDrawer()
    }

    window.addEventListener('toggleAssistant', handleToggleAssistant)
    return () => {
      window.removeEventListener('toggleAssistant', handleToggleAssistant)
    }
  }, [])

  return (
    <AssistantContext.Provider value={{ 
      isOpen, 
      setIsOpen, 
      toggleDrawer, 
      sendMessage,
      messages,
      inputText,
      setInputText
    }}>
      {children}
      <AssistantDrawer />
    </AssistantContext.Provider>
  )
}