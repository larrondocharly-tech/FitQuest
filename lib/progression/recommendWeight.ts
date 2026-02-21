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
  equipment?: 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'band' | 'unknown';
  failedBelowTargetMinTwice?: boolean;
  targetMaxHitTwiceRecently?: boolean;
};

export type Recommendation = {
  recommendedWeight: number | null;
  recommendedReps: string;
  progressionNote?: string;
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

const getIncrement = (equipment: RecommendParams['equipment']): number => {
  if (equipment === 'dumbbell') return 1;
  if (equipment === 'barbell' || equipment === 'machine') return 2.5;
  return 2.5;
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
}: RecommendParams): Recommendation => {
  const recommendedReps = `${targetRepsRange.min}-${targetRepsRange.max}`;

  if (equipment === 'bodyweight') {
    if (lastReps !== null && lastReps >= targetRepsRange.max) {
      return {
        recommendedWeight: null,
        recommendedReps,
        progressionNote: 'Atteins le haut de plage: ajoute une variation plus difficile.'
      };
    }

    return { recommendedWeight: null, recommendedReps };
  }

  if (lastWeight === null || lastReps === null) {
    return { recommendedWeight: null, recommendedReps };
  }

  const increment = getIncrement(equipment);

  if (goal === 'muscle') {
    if (lastReps >= targetRepsRange.max && (lastRpe === null || lastRpe <= 8.5)) {
      return { recommendedWeight: roundToHalf(lastWeight + increment), recommendedReps };
    }

    if (lastReps < targetRepsRange.min) {
      return { recommendedWeight: Math.max(0, roundToHalf(lastWeight - 2.5)), recommendedReps };
    }

    return { recommendedWeight: roundToHalf(lastWeight), recommendedReps };
  }

  if (goal === 'strength') {
    if (failedBelowTargetMinTwice) {
      return { recommendedWeight: Math.max(0, roundToHalf(lastWeight * 0.95)), recommendedReps };
    }

    if (lastReps >= targetRepsRange.max) {
      return { recommendedWeight: roundToHalf(lastWeight + increment), recommendedReps };
    }

    return { recommendedWeight: roundToHalf(lastWeight), recommendedReps };
  }

  if (goal === 'fat_loss' || goal === 'general') {
    if (targetMaxHitTwiceRecently) {
      return { recommendedWeight: roundToHalf(lastWeight + increment), recommendedReps };
    }

    return { recommendedWeight: roundToHalf(lastWeight), recommendedReps };
  }

  return { recommendedWeight: roundToHalf(lastWeight), recommendedReps };
};
