import type { Goal } from '@/lib/plan/generatePlan';

export type ExerciseLogForProgression = {
  weight_kg: number | null;
  reps: number;
  rpe: number | null;
  created_at: string;
  session_id: string;
};

export type LastPerformance = {
  lastWeight: number | null;
  lastReps: number | null;
  lastRpe: number | null;
  failedBelowTargetMinTwice: boolean;
  targetMaxHitTwiceRecently: boolean;
};

type RecommendParams = {
  goal: Goal;
  targetRepsRange: {
    min: number;
    max: number;
  };
  lastWeight: number | null;
  lastReps: number | null;
  lastRpe: number | null;
  equipment?: 'barbell' | 'dumbbell' | 'unknown';
  failedBelowTargetMinTwice?: boolean;
  targetMaxHitTwiceRecently?: boolean;
};

const roundToHalf = (value: number): number => Math.round(value * 2) / 2;

export const xpToLevel = (xp: number): number => Math.floor(xp / 250) + 1;

export const getLastPerformance = (
  logs: ExerciseLogForProgression[],
  targetMin: number,
  targetMax: number
): LastPerformance => {
  if (!logs.length) {
    return {
      lastWeight: null,
      lastReps: null,
      lastRpe: null,
      failedBelowTargetMinTwice: false,
      targetMaxHitTwiceRecently: false
    };
  }

  const sorted = [...logs].sort((a, b) => {
    const byDate = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (byDate !== 0) {
      return byDate;
    }

    return b.reps - a.reps;
  });

  const mostRecentSessionId = sorted[0].session_id;
  const mostRecentSessionSets = sorted.filter((entry) => entry.session_id === mostRecentSessionId);

  const bestSetInRecentSession = mostRecentSessionSets.reduce((best, current) => {
    const bestWeight = best.weight_kg ?? -Infinity;
    const currentWeight = current.weight_kg ?? -Infinity;

    if (currentWeight > bestWeight) {
      return current;
    }

    if (currentWeight === bestWeight && current.reps > best.reps) {
      return current;
    }

    return best;
  });

  const distinctSessions = Array.from(new Set(sorted.map((entry) => entry.session_id)));

  const recentSessionBest = distinctSessions.slice(0, 2).map((sessionId) => {
    const sessionSets = sorted.filter((entry) => entry.session_id === sessionId);
    return sessionSets.reduce((best, current) => {
      const bestWeight = best.weight_kg ?? -Infinity;
      const currentWeight = current.weight_kg ?? -Infinity;

      if (currentWeight > bestWeight) {
        return current;
      }

      if (currentWeight === bestWeight && current.reps > best.reps) {
        return current;
      }

      return best;
    });
  });

  const failedBelowTargetMinTwice =
    recentSessionBest.length >= 2 && recentSessionBest[0].reps < targetMin && recentSessionBest[1].reps < targetMin;

  const targetMaxHitTwiceRecently =
    recentSessionBest.length >= 2 && recentSessionBest[0].reps >= targetMax && recentSessionBest[1].reps >= targetMax;

  return {
    lastWeight: bestSetInRecentSession.weight_kg,
    lastReps: bestSetInRecentSession.reps,
    lastRpe: bestSetInRecentSession.rpe,
    failedBelowTargetMinTwice,
    targetMaxHitTwiceRecently
  };
};

export const recommendWeight = ({
  goal,
  targetRepsRange,
  lastWeight,
  lastReps,
  lastRpe,
  equipment = 'unknown',
  failedBelowTargetMinTwice = false,
  targetMaxHitTwiceRecently = false
}: RecommendParams): number | null => {
  if (lastWeight === null || lastReps === null) {
    return null;
  }

  const increment = equipment === 'dumbbell' ? 1 : 2.5;

  if (goal === 'muscle') {
    if (lastReps >= targetRepsRange.max && (lastRpe === null || lastRpe <= 8.5)) {
      return roundToHalf(lastWeight + increment);
    }

    if (lastReps < targetRepsRange.min) {
      return Math.max(0, roundToHalf(lastWeight - 2.5));
    }

    return roundToHalf(lastWeight);
  }

  if (goal === 'strength') {
    if (failedBelowTargetMinTwice) {
      return Math.max(0, roundToHalf(lastWeight * 0.95));
    }

    if (lastReps >= targetRepsRange.max) {
      return roundToHalf(lastWeight + 2.5);
    }

    return roundToHalf(lastWeight);
  }

  if (goal === 'fat_loss' || goal === 'general') {
    if (targetMaxHitTwiceRecently) {
      return roundToHalf(lastWeight + 2.5);
    }

    return roundToHalf(lastWeight);
  }

  return roundToHalf(lastWeight);
};
