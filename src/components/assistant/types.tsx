// src/components/assistant/types.ts

// Basic message structure
export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// Define what the ref exposes externally
export interface AssistantChatRef {
  getMessages: () => Message[]; // Function returning the message list
  clearChat: () => void; // Keep the clearChat functionality
}

// Props for the main AssistantChat component
export interface AssistantChatProps {
  closeDrawer?: () => void;
}

// Props for subcomponents that need access to state and handlers
export interface AssistantSubcomponentProps {
  messages: Message[];
  input: string;
  isLoading: boolean;
  isRecording: boolean;
  processingAudio: boolean;
  planCreated: boolean;
  showConfirmation: boolean;
  showWeekPreview: boolean;
  pendingChanges: Record<string, unknown> | null;
  pendingWeekPlan: any;
  // Allow refs to be potentially null initially
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleTranscription: (text: string) => void;
  confirmChanges: () => Promise<void>;
  setShowConfirmation: React.Dispatch<React.SetStateAction<boolean>>;
  setShowWeekPreview: React.Dispatch<React.SetStateAction<boolean>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  setPendingChanges: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>;
  setPendingWeekPlan: React.Dispatch<React.SetStateAction<any>>;
  setPlanCreated: React.Dispatch<React.SetStateAction<boolean>>;
}

// Type for Quick Options
export type QuickOption = {
  title: string;
  description: string;
  input: string;
}