"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import SessionForm from "../session-form";
import { ExerciseCard } from "../exercise-card";
import { createClient } from "@/lib/supabaseClient";
import {
  getSessionWithExercises,
  updateTrainingSession,
  deleteTrainingSession,
} from "@/lib/trainingModulesNew/sessionManagement";
import { UISessionExercise } from "@/lib/types";
import { useAuth } from "@/components/auth/auth-provider";
import { useAssistant } from "@/components/assistant/assistant-provider";

// Import storage service functions
import {
  saveSessionData,
  loadSessionData,
  deleteSessionData,
  saveLastActiveSessionId,
  getLastActiveSessionId,
  setSessionValue,
  removeSessionValue,
  STORAGE_KEYS,
} from "@/lib/trainingModulesNew/storageService";

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = parseInt(params.id as string, 10);
  const { user } = useAuth();
  const { setIsOpen, setInputText, sendMessage } = useAssistant();

  // State variables
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState({
    id: 0,
    date: "",
    startTime: "",
    endTime: "",
    name: "",
    type: "",
    readiness: {
      score: 7,
    },
    notes: "",
    status: "planned",
    week_number: null as number | null,
    session_order: null as number | null,
  });
  const [exercises, setExercises] = useState<UISessionExercise[]>([]);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(
    null,
  );

  // Function to delete an exercise from the list
  const deleteExercise = (exerciseId: number) => {
    setExercises(exercises.filter((exercise) => exercise.id !== exerciseId));
  };

  // Function to save session state using IndexedDB
  const saveSessionToStorage = async () => {
    if (typeof window !== "undefined" && session.id) {
      // Only save data if the session is not completed
      if (session.status !== "completed") {
        const sessionData = {
          session,
          exercises,
          lastUpdated: new Date().toISOString(),
        };

        try {
          // Save to IndexedDB
          await saveSessionData(sessionId, sessionData);
          saveLastActiveSessionId(sessionId);

          console.log("Session data saved to persistent storage:", sessionId);
        } catch (e) {
          console.error("Error saving session data:", e);
        }
      }
    }
  };

  // Function to auto-save changes
  const scheduleAutoSave = () => {
    // Clear any existing timer
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    // Set a new timer to save after 3 seconds of inactivity
    const timer = setTimeout(() => {
      saveSessionToStorage();
    }, 3000);

    setAutoSaveTimer(timer);
  };

  useEffect(() => {
    const loadData = async () => {
      if (!user || isNaN(sessionId)) {
        router.push("/dashboard");
        return;
      }

      try {
        // Check if we need to force a fresh load from the server
        // (when a timestamp query parameter is present, it means we're reloading after an update)
        const forceRefresh =
          typeof window !== "undefined" &&
          (window.location.search.includes("t=") ||
            window.location.search.includes("force=true"));

        console.log("Loading session data, forceRefresh =", forceRefresh);

        // For force-refresh, merge server data with client-side storage if it exists
        let hasLocalData = false;
        if (forceRefresh && typeof window !== "undefined") {
          console.log(
            "FORCE REFRESH detected - will merge server data with any client changes",
          );
          // Check for existing data in IndexedDB
          const storedData = await loadSessionData(sessionId);
          hasLocalData = !!storedData;
        }

        // First check if we have saved session data in client-side storage
        let sessionData = null;
        if (!forceRefresh && typeof window !== "undefined") {
          // Load from IndexedDB
          const storedData = await loadSessionData(sessionId);

          if (storedData) {
            try {
              sessionData = storedData;

              // Check if the data is recent (within the last minute)
              const lastUpdated = new Date(sessionData.lastUpdated);
              const now = new Date();
              const ageInSeconds =
                (now.getTime() - lastUpdated.getTime()) / 1000;

              // Refresh data if it's older than 60 seconds
              if (ageInSeconds > 60) {
                console.log("Stored data is stale, reloading from server");
                sessionData = null;
              } else {
                console.log("Found session data in persistent storage");
              }
            } catch (e) {
              console.error("Error handling saved session data:", e);
              sessionData = null;
            }
          }
        }

        // Remove the timestamp query parameter from the URL to prevent future forced refreshes
        if (forceRefresh && typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.search = "";
          window.history.replaceState({}, "", url.toString());
          console.log("Forcing data refresh from server");
          sessionData = null; // Force server refresh
        }

        if (
          !forceRefresh &&
          sessionData &&
          sessionData.session &&
          sessionData.exercises
        ) {
          // Use the saved data from client-side storage
          setSession(sessionData.session);
          setExercises(sessionData.exercises);
          console.log(
            "Loaded session from client-side storage, last updated:",
            new Date(sessionData.lastUpdated).toLocaleString(),
          );
        } else {
          // Fetch from the server
          console.log("Loading fresh session data from server");
          const supabase = createClient();
          const data = await getSessionWithExercises(supabase, sessionId);

          // If we're forcing a refresh but have local data, preserve user's input
          // by merging the server-side exercises with the local ones
          if (forceRefresh && hasLocalData && sessionData?.exercises) {
            const localExercises = sessionData.exercises;

            // Merge the server-side exercises with any local changes
            // For each server exercise, if a matching local exercise exists, preserve local sets data
            const mergedExercises = data.exercises.map((serverExercise) => {
              const matchingLocalExercise = localExercises.find(
                (e: { id: number }) => e.id === serverExercise.id,
              );

              if (matchingLocalExercise) {
                // Preserve user input from the local exercise while keeping the structure from server
                return {
                  ...serverExercise,
                  sets: matchingLocalExercise.sets,
                };
              }

              return serverExercise;
            });

            setSession(data.session);
            setExercises(mergedExercises);
            console.log("Merged server data with local changes for exercises");
          } else {
            // No local data or not a forced refresh, just use server data
            setSession(data.session);
            setExercises(data.exercises);
          }

          // Save to persistent storage for future use
          setTimeout(() => {
            saveSessionToStorage();
          }, 500);
        }

        // Store session name in sessionStorage for the header
        // Use week and session order if available, otherwise use the name
        if (typeof window !== "undefined") {
          const weekNumber = session.week_number;
          const sessionOrder = session.session_order;

          if (weekNumber && sessionOrder) {
            const sessionLabel = `Week ${weekNumber} Session ${sessionOrder}`;
            // Use the storage service utility
            setSessionValue(STORAGE_KEYS.CURRENT_SESSION_NAME, sessionLabel);
          } else if (session.name) {
            setSessionValue(STORAGE_KEYS.CURRENT_SESSION_NAME, session.name);
          }

          // Save this as the last active session
          saveLastActiveSessionId(sessionId);

          // Create and dispatch a storage event to notify the header
          const event = new Event("storage");
          window.dispatchEvent(event);
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Error loading session:", err);
        setError(
          "Failed to load training session. It may have been deleted or you may not have permission to view it.",
        );
        setIsLoading(false);
      }
    };

    loadData();

    // Cleanup when navigating away
    return () => {
      // Only save if the session isn't being completed (check status)
      if (session.status !== "completed") {
        // Save immediately without delay to ensure it happens before navigation
        saveSessionToStorage();
        console.log("Saved session data on navigation away:", sessionId);
      }

      // Clear auto-save timer
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }

      if (typeof window !== "undefined") {
        // Remove from sessionStorage using the service utility
        removeSessionValue(STORAGE_KEYS.CURRENT_SESSION_NAME);

        // Create and dispatch a storage event to notify the header
        const event = new Event("storage");
        window.dispatchEvent(event);
      }
    };
  }, [sessionId, router, user, window?.location?.search]);

  const handleSessionChange = (
    field: string,
    value: string | number | Date,
  ) => {
    setSession({
      ...session,
      [field]: value,
    });

    // Update sessionStorage when the name changes
    if (field === "name" && typeof window !== "undefined") {
      setSessionValue(STORAGE_KEYS.CURRENT_SESSION_NAME, String(value));

      // Create and dispatch a storage event to notify the header
      const event = new Event("storage");
      window.dispatchEvent(event);
    }

    // Schedule auto-save
    scheduleAutoSave();
  };

  const handleReadinessChange = (value: number) => {
    setSession({
      ...session,
      readiness: {
        ...session.readiness,
        score: value,
      },
    });

    // Schedule auto-save
    scheduleAutoSave();
  };

  const handleExerciseChange = (
    exerciseId: number,
    field: string,
    value: string | number | null,
  ) => {
    setExercises(
      exercises.map((exercise) => {
        if (exercise.id === exerciseId) {
          return {
            ...exercise,
            [field]: value,
          };
        }
        return exercise;
      }),
    );

    // Schedule auto-save
    scheduleAutoSave();
  };

  const handleSetChange = (
    exerciseId: number,
    setId: number,
    field: string,
    value: string | number | null,
  ) => {
    // For adding functionality to auto-fill following sets
    setExercises(
      exercises.map((exercise) => {
        if (exercise.id === exerciseId) {
          const currentSetIndex = exercise.sets.findIndex(
            (set) => set.id === setId,
          );

          // If this is a weight, reps, or RPE field and has a valid value, copy to subsequent sets
          if (
            (field === "weight" || field === "reps" || field === "rpe") &&
            value !== null &&
            value !== undefined
          ) {
            // Return exercise with updated sets
            return {
              ...exercise,
              sets: exercise.sets.map((set, index) => {
                // For the current set and all following sets, update the specific field
                if (index >= currentSetIndex) {
                  return { ...set, [field]: value };
                }
                // Leave previous sets unchanged
                return set;
              }),
            };
          } else {
            // For other fields or null values, only update the specific set
            return {
              ...exercise,
              sets: exercise.sets.map((set) => {
                if (set.id === setId) {
                  return { ...set, [field]: value };
                }
                return set;
              }),
            };
          }
        }
        return exercise;
      }),
    );

    // Schedule auto-save
    scheduleAutoSave();
  };

  const addSet = (exerciseId: number) => {
    setExercises(
      exercises.map((exercise) => {
        if (exercise.id === exerciseId) {
          const maxSetNumber = Math.max(
            ...exercise.sets.map((set) => set.set_number),
            0,
          );
          const newSetId =
            -Math.max(...exercise.sets.map((set) => Math.abs(set.id)), 0) - 1;
          const lastSet = exercise.sets[exercise.sets.length - 1];

          return {
            ...exercise,
            sets: [
              ...exercise.sets,
              {
                id: newSetId, // Negative ID indicates a new set that doesn't exist in the database yet
                set_number: maxSetNumber + 1,
                weight: lastSet?.weight || 0,
                reps: lastSet?.reps || 0,
                rpe: lastSet?.rpe ?? null,
                completed: false,
              },
            ],
          };
        }
        return exercise;
      }),
    );

    // Schedule auto-save
    scheduleAutoSave();
  };

  const deleteSet = (exerciseId: number, setId: number) => {
    setExercises(
      exercises.map((exercise) => {
        if (exercise.id === exerciseId) {
          return {
            ...exercise,
            sets: exercise.sets.filter((set) => set.id !== setId),
          };
        }
        return exercise;
      }),
    );

    // Schedule auto-save
    scheduleAutoSave();
  };

  const handleReplaceExercise = (
    exerciseId: number,
    newExerciseId: number,
    newExerciseName: string,
    newExerciseType: string,
    newVariation?: string,
    newDescription?: string,
  ) => {
    console.log(
      `Replacing exercise ID ${exerciseId} with new ID ${newExerciseId}: ${newExerciseName} (${newVariation || "no variation"})`,
    );

    // Find the exercise to replace so we can log the entry_id for debugging
    const exerciseToReplace = exercises.find((e) => e.id === exerciseId);
    if (exerciseToReplace) {
      console.log(
        `Exercise being replaced has entry_id: ${exerciseToReplace.entry_id}. This entry will be updated in the database.`,
      );
    }

    setExercises(
      exercises.map((exercise) => {
        if (exercise.id === exerciseId) {
          // Create the updated exercise
          const updatedExercise = {
            ...exercise,
            id: newExerciseId,
            name: newExerciseName,
            type: newExerciseType,
            // Use the variation field directly instead of details
            variation: newVariation || "",
            // Keep backward compatibility for details field
            details: newVariation || "",
            description: newDescription || "",
          };

          console.log(`Updated exercise in UI state: `, {
            id: updatedExercise.id,
            name: updatedExercise.name,
            entry_id: updatedExercise.entry_id,
          });

          return updatedExercise;
        }
        return exercise;
      }),
    );

    // Schedule auto-save immediately to ensure persistent storage
    scheduleAutoSave();
  };

  const addExercise = () => {
    // Create a new exercise with default values
    const newExercise: UISessionExercise = {
      id: -Math.floor(Math.random() * 10000) - 1, // Large negative random ID
      entry_id: -Math.floor(Math.random() * 10000) - 1, // Temporary negative entry ID
      session_id: sessionId,
      name: "New Exercise",
      type: "RPE", // Default to RPE type
      variation: "", // Add empty variation field
      sets: [
        {
          id: -Math.floor(Math.random() * 10000) - 1,
          set_number: 1,
          weight: 0,
          reps: 0,
          rpe: 7,
          completed: false,
        },
      ],
      notes: "",
      exercise_order: exercises.length + 1,
    };

    setExercises([...exercises, newExercise]);

    // Schedule auto-save
    scheduleAutoSave();
  };

  const saveChanges = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const supabase = createClient();

      // Mark all exercise sets as completed if they have valid data
      const completedExercises = exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => ({
          ...set,
          // Mark as completed if we have weight and reps data
          completed: set.weight && set.reps ? true : set.completed,
        })),
      }));

      await updateTrainingSession(
        supabase,
        sessionId,
        {
          date: session.date,
          name: session.name,
          type: session.type,
          notes: session.notes,
          readiness: { score: session.readiness.score },
          status: "completed", // Mark as completed when saved
        },
        completedExercises,
      );

      // Clear persistent storage data for this completed session
      if (typeof window !== "undefined") {
        console.log(
          "Clearing persistent storage for completed session:",
          sessionId,
        );
        deleteSessionData(sessionId);

        // If this was the last active session, clear that reference as well
        const lastActiveId = getLastActiveSessionId();
        if (lastActiveId === sessionId.toString()) {
          saveLastActiveSessionId("");
        }
      }

      // Check if this session is part of a plan and has a week_number and session_order
      if (session.week_number && session.session_order) {
        // Set a prompt for the assistant to generate the next similar session for the following week
        // Include week and session numbers explicitly to help with extraction and validation
        const nextWeekNumber = session.week_number
          ? session.week_number + 1
          : 1;
        const sessionOrder = session.session_order || 1;

        const promptText = `
Based on my just completed session (Week ${session.week_number}, Session ${session.session_order}), 
please generate the NEXT session for Week ${nextWeekNumber}, Session ${sessionOrder}.

IMPORTANT: 
1. The session MUST be for Week ${nextWeekNumber}, Session ${sessionOrder}
2. Please carefully review the exercise notes from this session - they contain valuable feedback 
   about how exercises felt, any pain/discomfort I experienced, and other important information.

For exercises where I noted discomfort or issues, please suggest appropriate modifications or alternatives.
For exercises that went well, apply appropriate progressive overload (typically 2.5-5% weight increase).

Please create a complete sessionPlan JSON that I can implement for my next training session.
        `.trim();

        // Set the prompt text without opening the drawer
        if (setInputText && typeof setInputText === "function") {
          setInputText(promptText);
        }

        // Show user a dialog to choose whether to auto-create or customize
        const userChoice = window.confirm(
          "Your session has been saved. Would you like to automatically create your next training session? Press OK for automatic creation, or Cancel to customize with the assistant.",
        );

        try {
          // Shows that something is happening to reassure the user
          setIsLoading(true);

          // If sendMessage function is available, use it
          if (sendMessage && typeof sendMessage === "function") {
            // Set a reasonable timeout for the AI response (20 seconds)
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Request timed out")), 20000),
            );

            try {
              // Send the message to generate the next session plan with timeout
              const responsePromise = sendMessage(promptText);
              const response = await Promise.race([
                responsePromise,
                timeoutPromise,
              ]);

              // If we got here, the request was successful
              console.log("Successfully generated follow-up session");

              // Handle response according to user's choice
              if (userChoice) {
                // Wait a moment for the background processing to complete
                setTimeout(() => {
                  router.push("/dashboard/plan");
                }, 1500);
              } else {
                // User wants to customize - open the assistant with the response
                setIsOpen(true);
                setIsLoading(false);
              }
            } catch (error) {
              console.error(
                "Error or timeout when sending message to assistant:",
                error,
              );

              // Show an error message to the user
              window.alert(
                "There was a problem creating your next session. Don't worry - your current session has been saved. " +
                  "You'll be redirected to your training plan overview, where you can see your progress.",
              );

              // Always redirect to plan page after error
              setTimeout(() => {
                router.push("/dashboard/plan");
              }, 1000);
            }
          } else {
            // If sendMessage isn't available, handle fallbacks
            console.warn(
              "sendMessage function not available, falling back to basic behavior",
            );

            if (userChoice) {
              // No AI generation possible, redirect to plan page
              router.push("/dashboard/plan");
            } else {
              // User wanted to customize, so show assistant with preset prompt
              setIsOpen(true);
              setIsLoading(false);
            }
          }
        } catch (error) {
          // Catch any unhandled errors in the entire flow
          console.error("Unexpected error in session completion flow:", error);
          setError(
            "An unexpected error occurred. Your session has been saved, but we could not create the next one.",
          );
          setIsLoading(false);

          // After a short delay, go to plan page
          setTimeout(() => {
            router.push("/dashboard/plan");
          }, 3000);
        }
      } else {
        // If not part of a plan, navigate back to dashboard
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Error updating session:", err);
      setError("Failed to update training session. Please try again.");
      setIsLoading(false);
    }
  };

  const deleteSession = async () => {
    if (
      !user ||
      !window.confirm("Are you sure you want to delete this session?")
    ) {
      return;
    }

    try {
      setIsLoading(true);
      const supabase = createClient();

      await deleteTrainingSession(supabase, sessionId);

      // Navigate back to dashboard
      router.push("/dashboard");
    } catch (err) {
      console.error("Error deleting session:", err);
      setError("Failed to delete training session. Please try again.");
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="text-muted-foreground">Loading session data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border p-4 text-red-500">
        <p>{error}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/dashboard")}
        >
          Back to Dashboard
        </Button>
      </div>
    );
  }

  // Format week and session info - Create a label for the UI
  const sessionLabel =
    session.week_number && session.session_order
      ? `Week ${session.week_number} Session ${session.session_order}`
      : session.name || `Session ${session.id}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{sessionLabel}</div>
          {session.date && (
            <div className="text-xs text-muted-foreground">
              {new Date(session.date).toLocaleDateString()}
            </div>
          )}
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>

      <SessionForm
        session={session}
        onSessionChange={handleSessionChange}
        onReadinessChange={handleReadinessChange}
      />

      <div className="space-y-4">
        {exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            onExerciseChange={handleExerciseChange}
            onSetChange={handleSetChange}
            onDeleteExercise={deleteExercise}
            onAddSet={addSet}
            onDeleteSet={deleteSet}
            onReplaceExercise={handleReplaceExercise}
          />
        ))}

        {exercises.length === 0 && (
          <Button
            variant="outline"
            className="w-full border-dashed py-6 flex items-center gap-2"
            onClick={() => {
              const promptText = `Please suggest exercises for Week ${session.week_number || "unknown"} Session ${session.session_order || "unknown"} based on my training plan and current readiness level of ${session.readiness.score}/10. I'd like a well-structured and balanced session.`;
              if (setInputText) {
                setInputText(promptText);
              }
              setIsOpen(true);
            }}
          >
            <Sparkles className="h-4 w-4" />
            Generate Exercises with Assistant
          </Button>
        )}

        <Button
          variant="outline"
          className="w-full border-dashed py-6"
          onClick={addExercise}
        >
          + Add Exercise
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <Button onClick={saveChanges} className="flex-1">
          Save and Complete Session
        </Button>
        <Button
          onClick={deleteSession}
          variant="destructive"
          className="flex-1"
        >
          Delete Session
        </Button>
      </div>
    </div>
  );
}
