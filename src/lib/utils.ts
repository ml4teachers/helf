import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calculates the estimated one-rep max (E1RM) based on weight, reps, and RPE.
 */

type RPEBasedInput = {
  weight: number;
  reps: number;
  rpe: number;
};

type PercentBasedInput = {
  weight: number;
  percent1RM: number; // z.B. 85 für 85%
};

export function calculateE1RM(
  input: RPEBasedInput | PercentBasedInput
): number | null {
  if ('rpe' in input && 'reps' in input) {
    const { weight, reps, rpe } = input;

    // Abbruch bei ungültigen Werten
    if (weight <= 0 || reps <= 0 || rpe < 6 || rpe > 10) return null;

    // Epley-basierte Schätzung angepasst auf RPE (vereinfachtes Modell)
    // Näherung: Jedes RPE unter 10 = ca. 1 mehr RIR (Reps in Reserve)
    const rir = 10 - rpe;
    const effectiveReps = reps + rir;

    // Epley-Formel (modifiziert)
    const e1rm = weight * (1 + effectiveReps * 0.0333);
    return Math.round(e1rm * 10) / 10; // auf 1 Dezimalstelle gerundet
  }

  if ('percent1RM' in input) {
    const { weight, percent1RM } = input;

    if (weight <= 0 || percent1RM <= 0 || percent1RM >= 100) return null;

    const e1rm = weight / (percent1RM / 100);
    return Math.round(e1rm * 10) / 10;
  }

  return null; // fallback
}

/**
 * Finds the best set in a collection of sets, based on estimated 1RM
 */
export function findBestSet(sets: Array<{ weight?: number | null; reps?: number | null; rpe?: number | null }>): {
  weight: number;
  reps: number;
  rpe: number;
  e1rm: number | null;
} | null {
  if (!sets || sets.length === 0) return null;
  
  // Filter sets with valid data for E1RM calculation
  const validSets = sets.filter(set => 
    set.weight !== undefined && set.weight !== null && set.weight > 0 &&
    set.reps !== undefined && set.reps !== null && set.reps > 0
  );
  
  if (validSets.length === 0) return null;
  
  // Calculate E1RM for each valid set
  const setsWithE1RM = validSets.map(set => {
    // Use a default RPE of 8 if not specified
    const rpe = set.rpe !== undefined && set.rpe !== null && set.rpe >= 6 && set.rpe <= 10 
      ? set.rpe 
      : 8;
    
    const e1rm = calculateE1RM({
      weight: set.weight as number,
      reps: set.reps as number,
      rpe: rpe
    });
    
    return {
      weight: set.weight as number,
      reps: set.reps as number,
      rpe: rpe,
      e1rm: e1rm
    };
  });
  
  // Sort by E1RM (descending) and take the best one
  setsWithE1RM.sort((a, b) => {
    if (a.e1rm === null && b.e1rm === null) return 0;
    if (a.e1rm === null) return 1;
    if (b.e1rm === null) return -1;
    return b.e1rm - a.e1rm;
  });
  
  return setsWithE1RM[0];
}