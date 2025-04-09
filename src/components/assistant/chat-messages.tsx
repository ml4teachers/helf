// src/components/assistant/chat-messages.tsx
'use client'

import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Card,
  CardTitle,
  CardHeader,
  CardDescription,
} from '@/components/ui/card';
import { MessageList } from './message-list'; // Assuming message-list is in the same directory
import type { Message, QuickOption, AssistantSubcomponentProps } from './types';

// Define quick options data
const quickOptions: QuickOption[] = [
  {
    title: "Create a new training plan",
    description: "Get a personalized powerlifting program",
    input: "I need a new training plan for powerlifting"
  },
  {
    title: "Optimize my current program",
    description: "Get suggestions to improve your training",
    input: "Help me optimize my current training program"
  },
  {
    title: "Structure my training",
    description: "Learn how to plan your training week",
    input: "How should I structure my training week?"
  },
  {
    title: "Improve my deadlift",
    description: "Get accessory exercises for deadlift",
    input: "What are good accessory exercises for improving my deadlift?"
  }
];

// Props specifically needed for ChatMessages
interface ChatMessagesProps extends Pick<AssistantSubcomponentProps,
  'messages' | 'isLoading' | 'planCreated' | 'messagesEndRef' | 'setInput' | 'handleSubmit'
> {}

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isLoading,
  planCreated,
  messagesEndRef,
  setInput,
  handleSubmit,
}) => {

  const renderQuickOptions = () => (
    <div className="flex-1 flex flex-col justify-between h-full">
      <div className="flex-grow"></div> {/* This pushes content to the bottom */}
      <div className="text-center mb-4">
        <p className="mb-3 mt-4 text-lg font-medium">Training Assistant</p>
        <p className="mb-4 px-8 text-muted-foreground">Ask me about your training plan, exercise technique, or for recommendations on your next workout.</p>
      </div>

      {/* Scroll Area Wrapper */}
      <ScrollArea className="w-full mb-6">
        <div className="flex gap-4 overflow-x-auto pb-2 px-4">
          {quickOptions.map((option, idx) => (
            <Card
              key={idx}
              onClick={() => {
                setInput(option.input);
                // Need to fake the event object for handleSubmit
                handleSubmit({ preventDefault: () => {} } as React.FormEvent);
              }}
              className="min-w-[220px] cursor-pointer hover:shadow-sm transition-shadow"
            >
              <CardHeader>
                <CardTitle className="text-sm">{option.title}</CardTitle>
                <CardDescription className="text-xs">{option.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="hidden" />
      </ScrollArea>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto py-4 flex flex-col w-full">
      {messages.length === 0 ? renderQuickOptions() :
        <div className="flex-1 flex flex-col w-full">
          <MessageList
            messages={messages}
            isLoading={isLoading}
          />
          {/* Action button shown after a plan or session has been created */}
          {planCreated && (
            <div className="flex justify-center mt-4">
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={async () => {
                  try {
                    // Check current URL path to determine context
                    const currentPath = window.location.pathname;
                    const isInSessionContext = currentPath.includes('/dashboard/sessions/');
                    
                    // If we're in a session context, this is likely after creating next session
                    // So we should just go back to dashboard/sessions
                    if (isInSessionContext) {
                      window.location.href = '/dashboard/sessions';
                      return;
                    }
                    
                    // Otherwise, we're likely after creating a new plan
                    // Try to find the first planned session first
                    let response = await fetch('/api/sessions?status=planned', {
                      method: 'GET'
                    });
                    
                    if (response.ok) {
                      const data = await response.json();
                      if (data.sessions && data.sessions.length > 0) {
                        // Navigate to the first planned session
                        window.location.href = `/dashboard/sessions/${data.sessions[0].id}`;
                        return;
                      }
                    }
                    
                    // If no planned session, try to find an upcoming session
                    response = await fetch('/api/sessions?status=upcoming', {
                      method: 'GET'
                    });
                    
                    if (response.ok) {
                      const data = await response.json();
                      if (data.sessions && data.sessions.length > 0) {
                        // Navigate to the first upcoming session
                        window.location.href = `/dashboard/sessions/${data.sessions[0].id}`;
                        return;
                      }
                    }
                    
                    // Fallback to the sessions list if no specific session found
                    window.location.href = '/dashboard/sessions';
                  } catch (error) {
                    console.error('Error finding session:', error);
                    window.location.href = '/dashboard/sessions';
                  }
                }}
              >
                {/* Change button text based on context - using React hook for window object */}
                {typeof window !== 'undefined' && window.location.pathname.includes('/dashboard/sessions/') 
                  ? 'View all sessions'
                  : 'Go to first session'
                }
              </Button>
            </div>
          )}
        </div>
      }
      <div ref={messagesEndRef} />
    </div>
  );
};