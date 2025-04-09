// src/components/profile/NameEditor.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Check, X, Edit } from 'lucide-react'

export function NameEditor() {
  const [name, setName] = useState<string>('')
  const [newName, setNewName] = useState<string>('')
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function fetchUserName() {
      setIsLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      const currentName = user?.user_metadata?.name || ''
      setName(currentName)
      setNewName(currentName)
      setIsLoading(false)
    }
    fetchUserName()
  }, [supabase])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    const { data: { user } } = await supabase.auth.getUser() // Re-fetch user just in case

    if (!user) {
        setError("User not found. Please log in again.");
        setIsSaving(false);
        return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      data: { name: newName.trim() || null }, // Send null if empty to clear name
    })

    if (updateError) {
      console.error("Error updating name:", updateError)
      setError('Failed to update name. Please try again.')
    } else {
      const updatedName = newName.trim() || '';
      setName(updatedName) // Update displayed name
      setSuccess('Name updated successfully!')
      setIsEditing(false)
      setTimeout(() => setSuccess(null), 3000) // Clear success message
    }
    setIsSaving(false)
  }

  const handleCancel = () => {
    setNewName(name) // Reset input field
    setIsEditing(false)
    setError(null) // Clear any errors
  }

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading name...</span>
      </div>
    )
  }

  return (
    <div>
      <Label htmlFor="user-name">Display Name</Label>
      {isEditing ? (
        <div className="flex items-center space-x-2">
          <Input
            id="user-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={isSaving}
            placeholder="Enter your display name"
            className="flex-grow"
          />
          <Button
            onClick={handleSave}
            disabled={isSaving || newName === name}
            size="icon"
            className="bg-green-600 hover:bg-green-700"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            <span className="sr-only">Save</span>
          </Button>
          <Button onClick={handleCancel} disabled={isSaving} size="icon" variant="ghost">
            <X className="h-4 w-4" />
            <span className="sr-only">Cancel</span>
          </Button>
        </div>
      ) : (
        <div className="flex space-x-2">
          <p className="text-sm text-muted-foreground pt-2 pr-8">
            {name || 'Not set'}
          </p>
          <Button onClick={() => setIsEditing(true)} size="icon" variant="ghost">
            <Edit className="h-4 w-4" />
            <span className="sr-only">Edit Name</span>
          </Button>
        </div>
      )}
       {error && <p className="text-sm text-destructive">{error}</p>}
       {success && <p className="text-sm text-green-600">{success}</p>}
    </div>
  )
}