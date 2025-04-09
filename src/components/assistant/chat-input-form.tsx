// src/components/assistant/chat-input-form.tsx
'use client'

import React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AudioRecorder } from './audio-recorder';
import { X, ArrowUp } from 'lucide-react';
import type { AssistantSubcomponentProps } from './types';
import type { AssistantChatProps } from './types';

interface ChatInputFormProps extends Pick<AssistantSubcomponentProps,
  'input' | 'isLoading' | 'isRecording' | 'processingAudio' |
  'textareaRef' | 'handleInputChange' | 'handleSubmit' | 'handleTranscription'
>, Pick<AssistantChatProps, 'closeDrawer'> {}

export const ChatInputForm: React.FC<ChatInputFormProps> = ({
  input,
  isLoading,
  isRecording,
  processingAudio,
  textareaRef,
  handleInputChange,
  handleSubmit,
  handleTranscription,
  closeDrawer,
}) => {
  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-end gap-2 p-2 border-t">
        {closeDrawer && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={closeDrawer}
            className="rounded-full shrink-0"
            aria-label="Close chat"
          >
            <X className="w-6 h-6" />
          </Button>
        )}

        <Textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about your training..."
          disabled={isLoading || isRecording || processingAudio}
          rows={1} // Beibehalten
          // Padding weiter reduziert: py-1.5 (6px top/bottom)
          className="resize-none max-h-[150px] rounded-xl px-3 py-1.5 text-base w-full custom-scrollbar"
          onKeyDown={(e) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const isSubmitShortcut = (isMac && e.metaKey && e.key === 'Enter') || (!isMac && e.ctrlKey && e.key === 'Enter');

            if (isSubmitShortcut) {
              e.preventDefault();
              if (input.trim() && !isLoading && !isRecording && !processingAudio) {
                handleSubmit(e);
              }
            }
          }}
          style={{
            height: 'auto',      // Beibehalten für Wachstum
            overflowY: 'auto',   // Beibehalten für Scrollen
            minHeight: 'unset',  // Versucht, die Standard-min-height aufzuheben
          }}
        />


          {!input?.trim() ? (
            <AudioRecorder
              onTranscription={handleTranscription}
              disabled={isLoading}
            />
          ) : (
            <Button
              type="submit"
              disabled={isLoading || isRecording || processingAudio}
              variant="default"
              size="icon"
              className="rounded-full"
              aria-label="Send message"
            >
              <ArrowUp className="w-5 h-5"/>
            </Button>
          )}

      </div>
    </form>
  );
};