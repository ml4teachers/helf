// src/components/assistant/utils.ts

// Function to detect if we're in a session context and get the session data
export function getCurrentSessionContext() {
  // Check if we're on a session detail page
  // Ensure this runs only in the browser
  if (typeof window === 'undefined') {
    return null;
  }

  const path = window.location.pathname;
  const sessionMatch = path.match(/\/dashboard\/sessions\/(\d+)/);

  if (sessionMatch && sessionMatch[1]) {
    const sessionId = parseInt(sessionMatch[1], 10);

    // If we have a valid session ID, return it
    if (!isNaN(sessionId)) {
      return { id: sessionId };
    }
  }

  return null;
}