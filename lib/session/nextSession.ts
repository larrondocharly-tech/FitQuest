import type { EquipmentType, Goal } from '@/lib/plan/generatePlan';
import { applyDeload, isDeloadWeek } from '@/lib/cycle/cycle';
import {
  getLastPerformance,
  recommendWeight,
  type ExerciseLogForProgression,
  type Recommendation
} from '@/lib/progression/recommendWeight';

type PlanExercise = {
  exercise_key: string;
  exercise_name: string;
  equipment_type: EquipmentType;
  sets: string;
  reps: string;
  target_reps_min: number;
  target_reps_max: number;
  notes?: string;
};

export type SessionBlueprintExercise = {
  exercise_key: string;
  exercise_name: string;
  equipment_type: EquipmentType;
  sets: string;
  reps: string;
  target_reps_min: number;
  target_reps_max: number;
  notes?: string;
  recommended_weight: number | null;
  recommended_reps: string;
  progression_note?: string;
};

export type SessionBlueprint = {
  cycle_week: number;
  deload: boolean;
  day: string;
  focus: string;
  exercises: SessionBlueprintExercise[];
};

export const buildNextSessionBlueprint = ({
  day,
  goal,
  cycleWeek,
  logsByExercise,
  equipmentType
}: {
  day: { day: string; focus: string; exercises: PlanExercise[] };
  goal: Goal;
  cycleWeek: number;
  logsByExercise: Record<string, ExerciseLogForProgression[]>;
  equipmentType?: EquipmentType;
}): SessionBlueprint => {
  const deload = isDeloadWeek(cycleWeek);

  const exercises = day.exercises.map((exercise) => {
    const logs = logsByExercise[exercise.exercise_key] ?? [];
    const lastPerformance = getLastPerformance(logs, exercise.target_reps_min, exercise.target_reps_max);
    const recommendation: Recommendation = recommendWeight({
      goal,
      targetRepsRange: { min: exercise.target_reps_min, max: exercise.target_reps_max },
      lastWeight: lastPerformance.lastWeight,
      lastReps: lastPerformance.lastReps,
      lastRpe: lastPerformance.lastRpe,
      equipment: equipmentType ?? exercise.equipment_type,
      failedBelowTargetMinTwice: lastPerformance.failedBelowTargetMinTwice,
      targetMaxHitTwiceRecently: lastPerformance.targetMaxHitTwiceRecently
    });

    if (!deload) {
      return {
        ...exercise,
        recommended_weight: recommendation.recommendedWeight,
        recommended_reps: recommendation.recommendedReps,
        progression_note: recommendation.progressionNote
      };
    }

    const deloaded = applyDeload({ exercise, recommendation });

    return {
      ...exercise,
      sets: deloaded.sets,
      notes: [exercise.notes, deloaded.note].filter(Boolean).join(' · '),
      recommended_weight: deloaded.recommendedWeight,
      recommended_reps: recommendation.recommendedReps,
      progression_note: deloaded.progressionNote
    };
  });

  return {
    cycle_week: cycleWeek,
    deload,
    day: day.day,
    focus: day.focus,
    exercises
  };
};
