'use client'

import { 
  Card, 
  CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

type Session = {
  id?: number
  date: string
  startTime?: string
  endTime?: string
  name?: string
  type?: string
  readiness: {
    score?: number
  }
  notes?: string
  status?: string
}

type SessionFormProps = {
  session: Session
  onSessionChange: (field: string, value: string | number | Date) => void
  onReadinessChange: (value: number) => void
  onGenerateSession?: () => void
  isGenerating?: boolean
}

export default function SessionForm({
  session,
  onSessionChange,
  onReadinessChange,
  onGenerateSession,
  isGenerating = false,
}: SessionFormProps) {

  // Helper, um Readiness auf [1..10] zu begrenzen
  const clampReadiness = (val: number) => {
    if (val < 1) return 1
    if (val > 10) return 10
    return val
  }
  
  // Set today's date if the date field is empty
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // If date is empty, automatically set it to today
  if (!session.date) {
    // Use setTimeout to ensure the update happens after initial render
    setTimeout(() => {
      onSessionChange('date', today);
    }, 0);
  }

  return (
    <Card>
      <CardContent className="grid gap-4">
        
        {/* Name & Date in einer Zeile */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label htmlFor="name" className="text-sm font-medium">
              Session Name
            </label>
            <Input
              id="name"
              type="text"
              value={session.name || ''}
              placeholder="e.g., Upper Body Strength"
              onChange={(e) => onSessionChange('name', e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="date" className="text-sm font-medium">
              Date
            </label>
            <Input
              id="date"
              type="date"
              className="w-full appearance-none truncate"
              value={session.date}
              onChange={(e) => onSessionChange('date', e.target.value)}
            />
          </div>
        </div>

        {/* Start / End / Readiness in einer Zeile */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col">
            <label htmlFor="startTime" className="text-sm font-medium">
              Start
            </label>
            <Input
              id="startTime"
              type="time"
              value={session.startTime || ''}
              onChange={(e) => onSessionChange('startTime', e.target.value)}
            />
          </div>
          
          <div className="flex flex-col">
            <label htmlFor="endTime" className="text-sm font-medium">
              End
            </label>
            <Input
              id="endTime"
              type="time"
              value={session.endTime || ''}
              onChange={(e) => onSessionChange('endTime', e.target.value)}
            />
          </div>
          
          <div className="flex flex-col">
            <label htmlFor="readinessScore" className="text-sm font-medium">
              Readiness
            </label>
            <Input
              id="readinessScore"
              type="number"
              min="1"
              max="10"
              step="1"
              value={session.readiness.score?.toString() || ''}
              onChange={(e) => {
                const raw = e.target.value
                // Falls Feld leer: readiness = 1
                if (raw === '') {
                  onReadinessChange(1)
                  return
                }
                const parsed = parseInt(raw, 10)
                if (isNaN(parsed)) {
                  onReadinessChange(1)
                  return
                }
                onReadinessChange(clampReadiness(parsed))
              }}
            />
          </div>
        </div>
        
        {/* Hidden Type */}
        <input
          type="hidden"
          id="type"
          value={session.type || ''}
          onChange={(e) => onSessionChange('type', e.target.value)}
        />
        
        {/* Notes */}
        <div className="flex flex-col">
          <label htmlFor="notes" className="text-sm font-medium">
            Session Notes
          </label>
          <Textarea
            id="notes"
            value={session.notes || ''}
            placeholder="How was your session today?"
            onChange={(e) => onSessionChange('notes', e.target.value)}
          />
        </div>
        
        {/* Optional: Generate Session Button */}
        {onGenerateSession && (
          <Button 
            onClick={onGenerateSession} 
            disabled={isGenerating}
            variant="secondary"
            className="mt-2"
          >
            {isGenerating ? 'Generating...' : 'Generate Workout Based on Readiness'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}