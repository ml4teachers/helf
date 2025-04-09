// src/components/profile/ModelSelector.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient' // Use browser client
import { User } from '@/lib/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select' // Assuming you have Select component
import { Label } from '@/components/ui/label' // Assuming you have Label component
import { Button } from '@/components/ui/button' // Assuming you have Button component
import { Loader2 } from 'lucide-react'

type ModelOption = 'gpt-4o-mini' | 'gpt-4o'

export function ModelSelector() {
  const [selectedModel, setSelectedModel] = useState<ModelOption>('gpt-4o-mini')
  const [initialModel, setInitialModel] = useState<ModelOption>('gpt-4o-mini')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchPreference() {
      setIsLoading(true)
      setError(null)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('preferred_ai_model')
          .eq('id', user.id)
          .single()

        if (fetchError) {
          console.error('Error fetching preference:', fetchError)
          setError('Failed to load preference.')
        } else if (data?.preferred_ai_model) {
          const model = data.preferred_ai_model as ModelOption
          setSelectedModel(model)
          setInitialModel(model) // Store initial value to check for changes
        }
      } else {
        setError('User not found.')
      }
      setIsLoading(false)
    }

    fetchPreference()
  }, [supabase])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferred_ai_model: selectedModel }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save preference.')
      }

      setInitialModel(selectedModel) // Update initial value on successful save
      setMessage('Model preference saved successfully!')
      setTimeout(() => setMessage(null), 3000) // Clear message after 3 seconds
    } catch (err: any) {
      console.error('Save error:', err)
      setError(err.message || 'An unexpected error occurred.')
      // Optionally revert selection
      // setSelectedModel(initialModel);
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges = selectedModel !== initialModel

  return (
    <div className="space-y-4">
      <Label htmlFor="model-select">Assistant AI Model</Label>
      {isLoading ? (
        <div className="flex items-center space-x-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading preference...</span>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <Select
            value={selectedModel}
            onValueChange={(value: ModelOption) => setSelectedModel(value)}
            disabled={isSaving}
          >
            <SelectTrigger id="model-select" className="w-[200px]">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            size="sm"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}
      <p className="text-xs text-muted-foreground">
        Choose the AI model for the assistant. GPT-4o is more capable but may be
        slower and cost more in the future.
      </p>
    </div>
  )
}