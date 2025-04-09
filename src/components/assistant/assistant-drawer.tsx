'use client'

import React, { useRef } from 'react'
import { useAssistant } from './assistant-provider'
import { AssistantChat } from './assistant-chat'
import type { AssistantChatRef } from './types'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'

export function AssistantDrawer() {
  const { isOpen, setIsOpen } = useAssistant()
  const chatRef = useRef<AssistantChatRef | null>(null)

  const handleSummarize = async () => {
    console.log("Drawer closing, attempting summarization via ref...");

    // Hole Nachrichten über die Ref-Methode
    const currentMessages = chatRef.current?.getMessages();

    if (!currentMessages) {
        console.error("Could not get messages from chat component ref.");
        return;
    }

    // Filtere System-Nachrichten und prüfe, ob genug relevanter Inhalt da ist
    const relevantMessages = currentMessages.filter(m => m.role === 'user' || m.role === 'assistant');
    if (relevantMessages.length < 2) {
        console.log("Not enough user/assistant messages to summarize.");
        return;
    }

    try {
        const response = await fetch('/api/assistant/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: relevantMessages }), // Sende relevante Nachrichten
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Summarization failed');
        console.log("Summarization API result:", result);
        // Optional: Feedback via Toast
    } catch (error) {
        console.error("Failed to trigger summarization on close:", error);
        // Optional: Fehler via Toast
    }
  };

  // Wird aufgerufen, wenn der Drawer geöffnet oder geschlossen wird
  const handleOpenChange = (open: boolean) => {
    if (!open && isOpen) { // Nur auslösen, wenn von offen -> geschlossen gewechselt wird
        handleSummarize();
    }
    setIsOpen(open); // Aktualisiere den Zustand über deinen Hook
  };

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange} repositionInputs={false}>
      <DrawerTitle></DrawerTitle>
      <DrawerContent className="h-[80dvh] max-w-[100vw] flex flex-col">    
        <div className="flex-1 overflow-hidden flex flex-col w-full items-end">
          <AssistantChat ref={chatRef} closeDrawer={() => setIsOpen(false)} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}