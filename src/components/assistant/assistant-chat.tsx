// src/components/assistant/assistant-chat.tsx
"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useAssistant } from "./assistant-provider"; // Assuming assistant-provider is in the same directory
import { ChatMessages } from "./chat-messages";
import { ChatInputForm } from "./chat-input-form";
import { ConfirmationDialog } from "./confirmation-dialog";
import { WeekPreviewDialog } from "./week-preview-dialog";
import { getCurrentSessionContext } from "./utils";
import type { Message, AssistantChatRef, AssistantChatProps } from "./types";

// Main Assistant Chat Component
export const AssistantChat = forwardRef<AssistantChatRef, AssistantChatProps>(
  function AssistantChat({ closeDrawer }, ref) {
    // Context and State Initialization
    const { inputText, setInputText } = useAssistant();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState<string>(inputText || "");
    const [isLoading, setIsLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showWeekPreview, setShowWeekPreview] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<Record<
      string,
      unknown
    > | null>(null);
    const [pendingWeekPlan, setPendingWeekPlan] = useState<any>(null);
    const [isRecording] = useState(false); // Assuming AudioRecorder handles its own state
    const [processingAudio] = useState(false); // Assuming AudioRecorder handles its own state
    const [planCreated, setPlanCreated] = useState(false);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Effects
    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
      if (inputText) {
        setInput(inputText);
        // Auto-resize textarea
        setTimeout(() => resizeTextarea(), 0);
      }
    }, [inputText]);

    // --- Core Logic ---

    const resizeTextarea = () => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      resizeTextarea();
      if (setInputText) {
        setInputText(e.target.value);
      }
    };

    const handleTranscription = (text: string) => {
      setInput(text);
      if (textareaRef.current) {
        textareaRef.current.focus();
        setTimeout(() => resizeTextarea(), 0);
      }
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedInput = input.trim();
      if (!trimmedInput || isLoading) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: trimmedInput,
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      resizeTextarea(); // Reset height after sending
      setIsLoading(true);

      try {
        const startTime = Date.now();
        console.log(
          "Assistant request started at:",
          new Date(startTime).toISOString(),
        );

        const currentSession = getCurrentSessionContext();

        // Enhanced logging for diagnostics
        console.log("Request context:", {
          messageCount: messages.length + 1,
          hasSession: !!currentSession,
          sessionId: currentSession?.id || "none",
        });

        // Production-ready fetch with keepalive and explicit timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

        let fetchResponse;
        try {
          fetchResponse = await fetch("/api/assistant", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Request-Start-Time": startTime.toString(),
              Connection: "keep-alive",
            },
            body: JSON.stringify({
              messages: [...messages, userMessage].map(({ role, content }) => ({
                role,
                content,
              })),
              // Ensure currentSession is not null, pass undefined instead if null
              currentSession: currentSession || undefined,
            }),
            // Important for production
            signal: controller.signal,
            keepalive: true,
          });

          clearTimeout(timeoutId);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }

        const response = fetchResponse;

        const endTime = Date.now();
        const requestDuration = endTime - startTime;
        console.log(`API request took ${requestDuration}ms`);

        // Capture more info about non-OK responses
        if (!response.ok) {
          const statusCode = response.status;
          const statusText = response.statusText;
          let responseBody;
          try {
            responseBody = await response.text();
          } catch (e) {
            responseBody = "Could not read response body";
          }

          // Log detailed error info
          console.error("API Error details:", {
            statusCode,
            statusText,
            responseBody,
            duration: requestDuration,
          });

          throw new Error(
            `API Error (${statusCode}): ${statusText || "No status text"}`,
          );
        }

        // Parse JSON with better error handling
        let responseData;
        try {
          responseData = await response.json();
        } catch (parseError) {
          console.error("JSON parse error:", parseError);
          throw new Error("Invalid response format from server");
        }

        // Check for expected response format
        if (!responseData || typeof responseData.content !== "string") {
          console.error("Unexpected response structure:", responseData);
          throw new Error("Invalid response structure from server");
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: responseData.content,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // --- Structured Data Handling ---
        const jsonMatch = responseData.content.match(
          /```json\n([\s\S]*?)\n```/,
        );
        if (jsonMatch && jsonMatch[1]) {
          try {
            const structuredData = JSON.parse(jsonMatch[1]);
            if (structuredData && Object.keys(structuredData).length > 0) {
              const reviewMessageContent =
                structuredData.type === "trainingPlan"
                  ? "I have created a macro plan based on your specifications. Please review it."
                  : structuredData.type === "weekPlan"
                    ? "I have created a week with training sessions for you. Please review the weekly plan."
                    : structuredData.type === "sessionPlan"
                      ? "I have prepared a session plan. Please review it."
                      : "Please review the proposed changes.";

              const reviewMessage: Message = {
                id: (Date.now() + 3).toString(),
                role: "assistant",
                content: reviewMessageContent,
              };
              setMessages((prevMessages) => [...prevMessages, reviewMessage]);

              if (structuredData.type === "trainingPlan") {
                setPendingChanges(structuredData);
                localStorage.setItem(
                  "pendingTrainingPlan",
                  JSON.stringify(structuredData),
                );
                setShowConfirmation(true);
              } else if (structuredData.type === "weekPlan") {
                console.log("Week plan detected:", structuredData);
                // Make sure we pass the complete week structure
                if (structuredData.data) {
                  // Ensure we have the right structure for the week plan
                  if (
                    structuredData.data &&
                    typeof structuredData.data === "object" &&
                    "week_number" in structuredData.data &&
                    "sessions" in structuredData.data
                  ) {
                    setPendingWeekPlan(structuredData.data); // Store the data part
                  } else {
                    console.error(
                      "Week plan data has wrong format:",
                      structuredData.data,
                    );
                    setPendingWeekPlan({
                      week_number: 1,
                      focus: "Generated Week",
                      sessions: [],
                      ...(structuredData.data || {}),
                    });
                  }
                  localStorage.setItem(
                    "pendingWeekPlan",
                    JSON.stringify(structuredData),
                  ); // Store full structure
                  // Show the week preview dialog after a small delay to ensure state updates
                  setTimeout(() => setShowWeekPreview(true), 50);
                } else {
                  console.error(
                    "Week plan data is missing or invalid:",
                    structuredData,
                  );
                  const errorMessage: Message = {
                    id: (Date.now() + 10).toString(),
                    role: "assistant",
                    content:
                      "Sorry, there was an issue with the week plan format. Please try again.",
                  };
                  setMessages((prevMessages) => [
                    ...prevMessages,
                    errorMessage,
                  ]);
                }
              } else if (structuredData.type === "sessionPlan") {
                // If in session context, show confirmation immediately.
                // Otherwise, the assistant message itself is the confirmation.
                if (currentSession) {
                  setPendingChanges(structuredData);
                  setShowConfirmation(true);
                }
              } else {
                // Handle other types if needed, or just show confirmation
                setPendingChanges(structuredData);
                setShowConfirmation(true);
              }
            }
          } catch (parseError) {
            console.error("Error parsing structured JSON:", parseError);
            // Optionally add a message indicating JSON parse error
          }
        }
        // --- End Structured Data Handling ---
      } catch (error) {
        console.error("Error fetching assistant response:", error);

        // Detailed logging for all errors
        let errorDetails = {
          type: error instanceof Error ? error.name : "Unknown",
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        };
        console.error("Error details:", errorDetails);

        // Provide a user-friendly message based on error type
        let userMessage = "Sorry, something went wrong.";

        if (error instanceof Error) {
          if (
            error.message.includes("504") ||
            error.message.includes("timeout")
          ) {
            userMessage =
              "The request timed out. The server might be under heavy load.";
          } else if (
            error.message.includes("network") ||
            error.name === "TypeError"
          ) {
            userMessage =
              "There was a network error. Please check your internet connection.";
          } else if (error.message.includes("JSON")) {
            userMessage = "There was a problem with the server response.";
          } else if (error.message.includes("API Error")) {
            userMessage = `Server error: ${error.message}`;
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Error: ${userMessage}`,
          },
        ]);
      }

      // Final cleanup
      setIsLoading(false);
    };

    const confirmChanges = async () => {
      if (!pendingChanges) return; // Guard clause

      const type = pendingChanges.type;
      const data = pendingChanges.data;
      const currentSession = getCurrentSessionContext();
      const isInSessionContext = !!currentSession?.id;

      setShowConfirmation(false); // Close dialog immediately

      try {
        let apiEndpoint = "";
        let requestBody: any = {};
        let successMessage = "Changes applied successfully.";
        let requiresReload = false;
        let newPlanCreated = false; // Flag specifically for plan creation flow

        if (type === "sessionPlan" && isInSessionContext) {
          // --- Handle Session Plan Update/Creation ---
          const sessionData = data as any; // Type assertion
          const lastUserMessage = [...messages]
            .reverse()
            .find((msg) => msg.role === "user");
          const isNextWeekSession =
            lastUserMessage &&
            (lastUserMessage.content.toLowerCase().includes("next week") ||
              lastUserMessage.content
                .toLowerCase()
                .includes("generate the next session") ||
              lastUserMessage.content
                .toLowerCase()
                .includes(`week ${(sessionData?.week_number || 0) + 1}`)); // Approximate check

          if (isNextWeekSession) {
            // --- Create NEW Session for Next Week ---
            console.log("Creating new next-week session from the plan");

            const weekSessionMatch = lastUserMessage?.content.match(
              /Week (\d+)[^\d]*Session (\d+)/i,
            );
            const currentWeekNumber = weekSessionMatch
              ? parseInt(weekSessionMatch[1], 10)
              : sessionData?.week_number || 0;
            const currentSessionOrder = weekSessionMatch
              ? parseInt(weekSessionMatch[2], 10)
              : sessionData?.session_order || 0;

            const nextWeekNumber = currentWeekNumber + 1;
            const nextSessionOrder = currentSessionOrder; // Usually the same session order in the next week

            // Enforce correct week/session numbers
            sessionData.week_number = nextWeekNumber;
            sessionData.session_order = nextSessionOrder;

            apiEndpoint = "/api/weekplan"; // Use weekplan API to create a single session in a future week
            requestBody = {
              weekPlan: {
                week_number: nextWeekNumber,
                sessions: [sessionData], // API expects an array
              },
            };

            // Check if this was an auto-generated next session
            const isAutoCreated = lastUserMessage?.content.includes(
              "Based on my just completed session",
            );
            if (isAutoCreated) {
              // If auto-created, use a more subtle message
              successMessage = `Your next session for Week ${nextWeekNumber}, Session ${nextSessionOrder} has been created.`;
              // The auto-creation flow should redirect to the newly created session automatically
            } else {
              // Regular interactive flow
              successMessage = `I've created your next session for Week ${nextWeekNumber}, Session ${nextSessionOrder}. You'll find it in your dashboard.`;
            }

            newPlanCreated = true; // Indicate a plan element was created for button display
          } else {
            // --- Update CURRENT Session ---
            apiEndpoint = `/api/sessions/${currentSession.id}/update`;
            requestBody = { sessionPlan: data };
            successMessage =
              "The training session has been updated with the new plan.";
            requiresReload = true; // Force reload to see changes
          }
        } else if (type === "weekPlan") {
          // --- Create Week Plan (Handled in WeekPreviewDialog Accept) ---
          // This logic is now primarily handled in WeekPreviewDialog's accept handler
          // We might keep a simplified version here as a fallback if needed,
          // but ideally, the accept handler in WeekPreviewDialog handles API calls directly.
          console.warn(
            "confirmChanges called for weekPlan - this should ideally be handled in WeekPreviewDialog.",
          );
          // For safety, maybe just display a generic message here if this path is hit unexpectedly.
          successMessage = "Weekly plan processing initiated.";
          // Set newPlanCreated if appropriate (e.g., if it's the first week of a new plan)
          // This might require checking localStorage('approvedTrainingPlan') again here.
          if (localStorage.getItem("approvedTrainingPlan")) {
            newPlanCreated = true;
          }
        } else if (type === "trainingPlan") {
          // --- Accept Macro Plan (Handled in ConfirmationDialog Accept) ---
          // This step now just stores the approved plan and asks for the first week.
          // The actual creation happens when the first week is accepted.
          console.log(
            "Macro plan accepted, proceeding to first week generation request.",
          );
          // No API call here. Message is handled in the dialog accept handler.
          return; // Exit confirmChanges as the next step is handled by the dialog
        } else {
          // --- Handle Other Generic Changes (if any) ---
          console.warn(`Unhandled pending change type: ${type}`);
          successMessage = "The changes have been saved.";
          // Potentially add API calls for other types here if needed in the future
        }

        // --- Perform API Call (if endpoint is set) ---
        if (apiEndpoint) {
          const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(
              `API call failed (${response.status}): ${errorData}`,
            );
          }
          console.log(`API call to ${apiEndpoint} successful.`);
        }

        // --- Post-Success Actions ---
        const confirmationMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content: successMessage,
        };
        setMessages((prev) => [...prev, confirmationMessage]);

        if (newPlanCreated) {
          setPlanCreated(true); // Show the 'Go to Session' button
        }

        setPendingChanges(null); // Clear pending changes after successful processing

        if (requiresReload && currentSession) {
          // Add null check for currentSession
          setTimeout(() => {
            console.log("Reloading page for session update...");
            sessionStorage.removeItem("currentSessionName"); // Clear cached name if needed
            const timestamp = Date.now();
            // Use replace to avoid adding to history and ensure clean load
            window.location.replace(
              `/dashboard/sessions/${currentSession.id}?t=${timestamp}`,
            );
          }, 800);
        }
      } catch (error) {
        console.error("Error confirming changes:", error);
        const errMessage =
          error instanceof Error ? error.message : "Unknown error occurred.";
        const errorMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content: `There was a problem applying the changes: ${errMessage}`,
        };
        setMessages((prev) => [...prev, errorMessage]);
        // Keep pending changes so user might retry or adjust
        setShowConfirmation(true); // Re-open the confirmation dialog on error?
      }
    };

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        getMessages: () => messages,
        clearChat: () => {
          setMessages([]);
          setPlanCreated(false);
          setInput("");
          resizeTextarea();
          // Also clear any pending states
          setPendingChanges(null);
          setPendingWeekPlan(null);
          setShowConfirmation(false);
          setShowWeekPreview(false);
          localStorage.removeItem("pendingTrainingPlan");
          localStorage.removeItem("approvedTrainingPlan");
          localStorage.removeItem("pendingWeekPlan");
          // Reset context input if applicable
          if (setInputText) {
            setInputText("");
          }
        },
      }),
      [messages, setPlanCreated, setInputText],
    ); // Add setInputText dependency

    // --- Render ---
    return (
      <div className="flex flex-col h-full w-full overflow-hidden">
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          planCreated={planCreated}
          messagesEndRef={messagesEndRef} // Pass the ref, type adjusted in types.ts
          setInput={setInput}
          handleSubmit={handleSubmit}
        />

        <ChatInputForm
          input={input}
          isLoading={isLoading}
          isRecording={isRecording}
          processingAudio={processingAudio}
          textareaRef={textareaRef} // Pass the ref, type adjusted in types.ts
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          handleTranscription={handleTranscription}
          closeDrawer={closeDrawer}
        />

        <ConfirmationDialog
          showConfirmation={showConfirmation}
          setShowConfirmation={setShowConfirmation}
          pendingChanges={pendingChanges}
          setPendingChanges={setPendingChanges}
          confirmChanges={confirmChanges}
          setMessages={setMessages}
          setInput={setInput}
        />

        <WeekPreviewDialog
          showWeekPreview={showWeekPreview}
          setShowWeekPreview={setShowWeekPreview}
          pendingWeekPlan={pendingWeekPlan}
          setPendingWeekPlan={setPendingWeekPlan}
          setMessages={setMessages}
          setPendingChanges={setPendingChanges} // Pass this down
          setPlanCreated={setPlanCreated} // Pass setPlanCreated
        />
      </div>
    );
  },
);

// Add display name for debugging
AssistantChat.displayName = "AssistantChat";
