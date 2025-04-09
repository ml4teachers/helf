// src/components/profile/MemoryManager.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { UserAssistantMemory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose, // Import DialogClose
} from '@/components/ui/dialog'
import { Loader2, Plus, Trash2, Edit, X } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area' // Assuming you have ScrollArea

// Define common memory types or fetch them dynamically if needed
const MEMORY_TYPES = [
  'preference',
  'goal',
  'injury',
  'experience',
  'equipment',
  'pb', // Personal Best
  'fact', // General fact
  'summary', // Conversation summary
]

export function MemoryManager() {
  const [memories, setMemories] = useState<UserAssistantMemory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false) // For add/edit/delete
  const [error, setError] = useState<string | null>(null)

  // State for Add/Edit Dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMemory, setEditingMemory] = useState<UserAssistantMemory | null>(
    null
  )
  const [memoryType, setMemoryType] = useState<string>(MEMORY_TYPES[0])
  const [memoryContent, setMemoryContent] = useState<string>('')

  const supabase = createClient()

  const fetchMemories = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/user/memory')
      if (!response.ok) {
        throw new Error('Failed to fetch memories')
      }
      const data = await response.json()
      setMemories(data)
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching memories.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  const openAddDialog = () => {
    setEditingMemory(null)
    setMemoryType(MEMORY_TYPES[0])
    setMemoryContent('')
    setError(null) // Clear previous errors
    setIsDialogOpen(true)
  }

  const openEditDialog = (memory: UserAssistantMemory) => {
    setEditingMemory(memory)
    setMemoryType(memory.memory_type)
    setMemoryContent(memory.content)
    setError(null) // Clear previous errors
    setIsDialogOpen(true)
  }

  const handleDialogSave = async () => {
    setIsProcessing(true)
    setError(null)
    const url = editingMemory
      ? `/api/user/memory/${editingMemory.id}`
      : '/api/user/memory'
    const method = editingMemory ? 'PUT' : 'POST'

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memory_type: memoryType,
          content: memoryContent,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save memory.')
      }

      // Refresh list and close dialog
      fetchMemories()
      setIsDialogOpen(false)
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this memory?')) {
      return
    }
    setIsProcessing(true)
    setError(null)
    try {
      const response = await fetch(`/api/user/memory/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete memory.')
      }
      // Refresh list
      setMemories((prev) => prev.filter((mem) => mem.id !== id))
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div>
      <div className="flex flex-row justify-between pb-4">
        <div>
          <Label>Assistant Memory</Label>
          <p className="text-xs text-muted-foreground pt-2">
            Facts the assistant should know about you.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openAddDialog} className="mx-2">
              <Plus className="h-4 w-4" />Add Memory
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingMemory ? 'Edit Memory' : 'Add New Memory'}
              </DialogTitle>
              <DialogDescription>
                Enter details for the assistant to remember.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="memory-type" className="text-right">
                  Type
                </Label>
                <Select
                    value={memoryType}
                    onValueChange={(value: string) => setMemoryType(value)}
                    disabled={isProcessing}
                    // Note: shadcn Select doesn't use id directly on Select,
                    // but we can associate the label using htmlFor on the trigger if needed,
                    // though here it's visually clear.
                  >
                    <SelectTrigger className="col-span-3" id="memory-type">
                      <SelectValue placeholder="Select memory type" />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMORY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                      {/* Handle custom types if necessary */}
                       {editingMemory && !MEMORY_TYPES.includes(editingMemory.memory_type) && (
                         <SelectItem key={editingMemory.memory_type} value={editingMemory.memory_type}>
                           {editingMemory.memory_type.charAt(0).toUpperCase() + editingMemory.memory_type.slice(1)} (Custom)
                         </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="memory-content" className="text-right">
                  Content
                </Label>
                <Textarea
                  id="memory-content"
                  value={memoryContent}
                  onChange={(e) => setMemoryContent(e.target.value)}
                  className="col-span-3"
                  placeholder="Enter the fact or preference..."
                  disabled={isProcessing}
                />
              </div>
              {error && (
                  <p className="col-span-4 text-sm text-destructive text-center">{error}</p>
              )}
            </div>
            <DialogFooter>
              {/* Use DialogClose for the Cancel button */}
              <DialogClose asChild>
                 <Button type="button" variant="outline" disabled={isProcessing}>Cancel</Button>
              </DialogClose>
              <Button
                type="button"
                onClick={handleDialogSave}
                disabled={isProcessing || !memoryContent.trim()}
              >
                {isProcessing && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingMemory ? 'Save Changes' : 'Add Memory'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div>
        {isLoading ? (
          <div className="flex items-center justify-center space-x-2 text-muted-foreground py-4">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading memories...</span>
          </div>
        ) : memories.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No memories added yet.
          </p>
        ) : (
          <ScrollArea className="h-[300px] pr-4"> {/* Added pr-4 for scrollbar spacing */}
            <ul className="space-y-3">
              {memories.map((memory) => (
                <li
                  key={memory.id}
                  className="flex items-start justify-between space-x-2 rounded-md border p-3"
                >
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none capitalize">
                      {memory.memory_type}
                    </p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {memory.content}
                    </p>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(memory)}
                      disabled={isProcessing}
                      className="h-7 w-7"
                    >
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(memory.id)}
                      disabled={isProcessing}
                      className="h-7 w-7 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
        {error && !isLoading && (
             <p className="text-sm text-destructive text-center mt-4">{error}</p>
        )}
      </div>
    </div>
  )
}