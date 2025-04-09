// src/components/assistant/week-preview-dialog.tsx
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
import { WeekPreview } from './week-preview'; // Assuming week-preview is in the same directory
import type { Message, AssistantSubcomponentProps } from './types';

// Props needed for WeekPreviewDialog
interface WeekPreviewDialogProps extends Pick<AssistantSubcomponentProps,
  'showWeekPreview' | 'setShowWeekPreview' | 'pendingWeekPlan' | 'setPendingWeekPlan' |
  'setMessages' | 'setPendingChanges' | 'setPlanCreated' // Need setPlanCreated here
> {}

export const WeekPreviewDialog: React.FC<WeekPreviewDialogProps> = ({
  showWeekPreview,
  setShowWeekPreview,
  pendingWeekPlan,
  setPendingWeekPlan,
  setMessages,
  setPendingChanges, // We still need this to trigger confirmChanges logic indirectly
  setPlanCreated, // Pass setPlanCreated
}) => {

  const handleReject = () => {
    setShowWeekPreview(false);

    // On rejection: Ask for adjustments
    const followUpMessage: Message = {
      id: (Date.now() + 5).toString(),
      role: 'assistant',
      content: 'What adjustments would you like to make to the weekly plan? I can change the exercises, sets, repetitions or intensity.',
    };
    setMessages(prevMessages => [...prevMessages, followUpMessage]);
    localStorage.removeItem('pendingWeekPlan');
    setPendingWeekPlan(null);
  };

  const handleAccept = async () => {
    setShowWeekPreview(false); // Close the dialog immediately

    if (!pendingWeekPlan) return;
    
    console.log('Accepting week plan:', pendingWeekPlan);

    // Trigger the logic to save the plan (both macro and week if applicable)
    try {
        // Check format of pendingWeekPlan
        console.log('Week plan structure being sent to API:', JSON.stringify(pendingWeekPlan, null, 2));
        
        // Fetch the macro plan from localStorage
        const storedMacroPlan = localStorage.getItem('approvedTrainingPlan');
        const macroPlanData = storedMacroPlan ? JSON.parse(storedMacroPlan) : null;

        // Show message indicating saving process
        const planningMessage: Message = {
            id: (Date.now() + 7).toString(),
            role: 'assistant',
            content: macroPlanData
                ? "I'm now saving your complete training plan to the database..."
                : "I'm now saving your weekly plan to the database...",
        };
        setMessages(prevMessages => [...prevMessages, planningMessage]);

        // --- Direct API Calls for Plan Creation ---

        let macroPlanId = null;
        // 1. Create Macro Plan if exists
        if (macroPlanData && macroPlanData.type === 'trainingPlan') {
            console.log('Creating macro plan from localStorage:', macroPlanData);
            const macroPlanResponse = await fetch('/api/plan/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trainingPlan: macroPlanData }),
            });

            if (!macroPlanResponse.ok) {
                const errorData = await macroPlanResponse.text();
                throw new Error(`Failed to create macro plan: ${macroPlanResponse.status} - ${errorData}`);
            }
            const macroPlanResult = await macroPlanResponse.json();
            macroPlanId = macroPlanResult.planId;
            console.log('Macro plan created successfully with ID:', macroPlanId);
        }

        // 2. Create Weekly Plan
        console.log('Creating weekly plan:', pendingWeekPlan);
        const weekPlanResponse = await fetch('/api/weekplan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Send the entire weekPlan object, ensure it includes week_number
            body: JSON.stringify({ weekPlan: pendingWeekPlan }),
        });

        if (!weekPlanResponse.ok) {
            const errorData = await weekPlanResponse.text();
            throw new Error(`Failed to create week plan: ${weekPlanResponse.status} - ${errorData}`);
        }
        const weekPlanResult = await weekPlanResponse.json();
        console.log('Week plan creation success:', weekPlanResult);

        // --- End Direct API Calls ---

        // Clear temporary data
        localStorage.removeItem('pendingTrainingPlan');
        localStorage.removeItem('approvedTrainingPlan');
        localStorage.removeItem('pendingWeekPlan');

        // Show success message and trigger button
        const completeMessage: Message = {
            id: (Date.now() + 8).toString(),
            role: 'assistant',
            content: `Your training plan has been created successfully! You can now start with your first session or ask further questions.`,
        };
        setMessages(prevMessages => [...prevMessages, completeMessage]);
        setPlanCreated(true); // Show the "Go to first session" button
        setPendingWeekPlan(null); // Clear the pending week plan state

    } catch (error) {
        console.error('Error processing plans on week accept:', error);
        const errorMessage: Message = {
            id: (Date.now() + 9).toString(),
            role: 'assistant',
            content: 'There was a problem saving the training plan. Please check the console for details and try again.',
        };
        setMessages(prevMessages => [...prevMessages, errorMessage]);
        // Keep pendingWeekPlan so user can retry
        setShowWeekPreview(true); // Re-open dialog on error? Or just show error message? Let's just show message.
    }
  };


  return (
    <Dialog open={showWeekPreview} onOpenChange={setShowWeekPreview}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Review your weekly plan</DialogTitle>
          <DialogDescription>
            Here you can see the detailed training plan for the week.
            Check if the exercises, sets and intensities meet your expectations.
            By clicking "Accept Weekly Plan", the plan will be saved to the database.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          {pendingWeekPlan && (<WeekPreview week={pendingWeekPlan as import('./week-preview').Week} />
          )}

          {!pendingWeekPlan && (
            <div className="py-4 text-center text-muted-foreground">
              No weekly plan available
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleReject}>
            Reject Plan
          </Button>
          <Button onClick={handleAccept}>
            Accept Weekly Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};