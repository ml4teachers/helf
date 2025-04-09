// src/components/assistant/confirmation-dialog.tsx
'use client'

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PlanPreview } from './plan-preview'; // Assuming plan-preview is in the same directory
import { SessionPlanPreview } from './session-plan-preview'; // Assuming session-plan-preview is in the same directory
import type { Message, AssistantSubcomponentProps } from './types';

// Props needed for ConfirmationDialog
interface ConfirmationDialogProps extends Pick<AssistantSubcomponentProps,
  'showConfirmation' | 'setShowConfirmation' | 'pendingChanges' | 'setPendingChanges' |
  'confirmChanges' | 'setMessages' | 'setInput'
> {}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  showConfirmation,
  setShowConfirmation,
  pendingChanges,
  setPendingChanges,
  confirmChanges,
  setMessages,
  setInput,
}) => {

  const handleReject = () => {
    setShowConfirmation(false);

    // On macro plan rejection: Ask for adjustments
    if (pendingChanges?.type === 'trainingPlan') {
      const followUpMessage: Message = {
        id: (Date.now() + 4).toString(),
        role: 'assistant',
        content: 'What adjustments would you like to make to the training plan? I can adjust the number of training weeks, training frequency, or the goal.',
      };
      setMessages(prevMessages => [...prevMessages, followUpMessage]);
      localStorage.removeItem('pendingTrainingPlan');
    }
    // On weekly plan rejection (This case might be handled by WeekPreviewDialog now, but keeping for safety)
    else if (pendingChanges?.type === 'weekPlan') {
      const followUpMessage: Message = {
        id: (Date.now() + 4).toString(),
        role: 'assistant',
        content: 'What adjustments would you like to make to the weekly plan? I can change the exercise selection, sets, or intensity.',
      };
      setMessages(prevMessages => [...prevMessages, followUpMessage]);
      localStorage.removeItem('pendingWeekPlan');
    }

    setPendingChanges(null);
  };

  const handleAccept = () => {
    // On macro plan: First ask for training for the first week
    if (pendingChanges?.type === 'trainingPlan') {
      setShowConfirmation(false);

      // Store the plan in localStorage (not in the database yet!)
      localStorage.setItem('approvedTrainingPlan', JSON.stringify(pendingChanges));

      // Ask for training sessions for the first week
      const weekRequestMessage: Message = {
        id: (Date.now() + 4).toString(),
        role: 'assistant',
        content: 'Great! You like the macro plan. Now I will create the detailed training plan for the first week. Are there any specific requests for the first week?',
      };
      setMessages(prevMessages => [...prevMessages, weekRequestMessage]);

      // Set input field for user convenience
      setInput('Please create the first training week.');
      // Clear pending changes for this dialog, but keep approved plan in localStorage
      setPendingChanges(null);
    }
    // For other plans (like sessionPlan): Normal confirmation
    else {
      confirmChanges(); // This will also setPendingChanges(null) on success
    }
  };

  return (
    <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {pendingChanges?.type === 'trainingPlan'
              ? 'Review your training plan'
              : pendingChanges?.type === 'sessionPlan'
                ? 'Review your training session'
                : 'Confirm the changes'}
          </DialogTitle>
          <DialogDescription>
            {pendingChanges?.type === 'trainingPlan'
              ? 'Please review the proposed training plan. If you agree with the macro plan, click "Accept Plan" to create a detailed weekly plan.'
              : pendingChanges?.type === 'sessionPlan'
                ? 'Please review the proposed training session and confirm the changes.'
                : 'Please review the proposed changes and confirm them.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          {pendingChanges && pendingChanges.type === 'trainingPlan' && (
            <PlanPreview plan={pendingChanges.data as import('./plan-preview').Plan} />
          )}

          {pendingChanges && pendingChanges.type === 'sessionPlan' && (
            <SessionPlanPreview sessionPlan={pendingChanges.data as import('./session-plan-preview').SessionPlan} />
          )}

          {pendingChanges && pendingChanges.type !== 'trainingPlan' && pendingChanges.type !== 'sessionPlan' && (
            <div className="mt-4 border rounded-md p-4 bg-muted/50">
              <pre className="text-xs whitespace-pre-wrap">
                {JSON.stringify(pendingChanges, null, 2)}
              </pre>
            </div>
          )}

          {!pendingChanges && (
            <div className="py-4 text-center text-muted-foreground">
              No changes available to confirm
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleReject}>
            {pendingChanges?.type === 'trainingPlan' ? 'Reject Plan' : 'Cancel'}
          </Button>
          <Button onClick={handleAccept}>
            {pendingChanges?.type === 'trainingPlan'
              ? 'Accept Plan'
              : pendingChanges?.type === 'sessionPlan'
                ? 'Apply Session'
                : 'Apply Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};