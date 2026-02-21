import type { Archetype, Baseline, EquipmentType, Goal } from '@/lib/plan/generatePlan';
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
  pattern?: string;
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
  recommended_pace_sec_per_km?: number | null;
  progression_note?: string;
};

export type SessionBlueprint = {
  cycle_week: number;
  deload: boolean;
  day: string;
  focus: string;
  exercises: SessionBlueprintExercise[];
};

const round = (value: number) => Math.round(value * 2) / 2;

const getRunningPaces = (baseline: Baseline) => {
  const fiveK = typeof baseline.fivek_time_sec === 'number' ? baseline.fivek_time_sec : null;
  const cooper = typeof baseline.cooper_m === 'number' ? baseline.cooper_m : null;
  const easyFromBaseline = typeof baseline.easy_pace_sec_per_km === 'number' ? baseline.easy_pace_sec_per_km : null;

  const fiveKPace = fiveK ? fiveK / 5 : cooper ? 720 / (cooper / 1000) : null;
  const easy = easyFromBaseline ?? (fiveKPace ? Math.round(fiveKPace * 1.2) : null);
  const tempo = fiveKPace ? Math.round(fiveKPace * 1.06) : easy ? Math.round(easy * 0.9) : null;
  const intervals = fiveKPace ? Math.round(fiveKPace * 0.95) : tempo ? Math.round(tempo * 0.95) : null;

  return { easy, tempo, intervals };
};

const baselineStartingPoint = (exercise: PlanExercise, archetype: Archetype, baseline: Baseline): Recommendation & { pace?: number | null } => {
  const key = exercise.exercise_key;

  if (archetype === 'running') {
    const paces = getRunningPaces(baseline);
    const pace = key.includes('interval') ? paces.intervals : key.includes('tempo') ? paces.tempo : paces.easy;
    return {
      recommendedWeight: null,
      recommendedReps: `${exercise.target_reps_min}-${exercise.target_reps_max}`,
      progressionNote: pace ? 'Allure recommandée calculée depuis ton baseline.' : 'Reste en aisance respiratoire (RPE 6-7).',
      pace
    };
  }

  if (archetype === 'calisthenics') {
    const pullups = typeof baseline.pullups_max === 'number' ? baseline.pullups_max : null;
    const pushups = typeof baseline.pushups_max === 'number' ? baseline.pushups_max : null;
    const dips = typeof baseline.dips_max === 'number' ? baseline.dips_max : null;

    if (key.includes('pullup') && pullups) {
      const target = Math.max(exercise.target_reps_min, Math.min(exercise.target_reps_max, pullups - 2));
      return { recommendedWeight: null, recommendedReps: `${target}-${Math.min(target + 1, exercise.target_reps_max)}`, progressionNote: 'Stop 1-2 reps before failure.' };
    }

    if (key.includes('dip') && dips) {
      const target = Math.max(exercise.target_reps_min, Math.min(exercise.target_reps_max, dips - 2));
      return { recommendedWeight: null, recommendedReps: `${target}-${Math.min(target + 1, exercise.target_reps_max)}`, progressionNote: 'Stop 1-2 reps before failure.' };
    }

    if (key.includes('push') && pushups) {
      const target = Math.max(exercise.target_reps_min, Math.min(exercise.target_reps_max, pushups - 2));
      return { recommendedWeight: null, recommendedReps: `${target}-${Math.min(target + 2, exercise.target_reps_max)}`, progressionNote: 'Stop 1-2 reps before failure.' };
    }

    return { recommendedWeight: null, recommendedReps: `${exercise.target_reps_min}-${exercise.target_reps_max}` };
  }

  if (archetype === 'weightlifting') {
    const frontSquat3rm = typeof baseline.front_squat_3rm_kg === 'number' ? baseline.front_squat_3rm_kg : null;
    const clean3rm = typeof baseline.power_clean_3rm_kg === 'number' ? baseline.power_clean_3rm_kg : null;
    const press5rm = typeof baseline.strict_press_5rm_kg === 'number' ? baseline.strict_press_5rm_kg : null;

    if (key.includes('front_squat') && frontSquat3rm) {
      return { recommendedWeight: round(frontSquat3rm * 0.8), recommendedReps: `${exercise.target_reps_min}-${exercise.target_reps_max}`, progressionNote: 'Baseline 3RM utilisé de manière conservatrice.' };
    }

    if ((key.includes('snatch') || key.includes('clean')) && clean3rm) {
      return { recommendedWeight: round(clean3rm * 0.6), recommendedReps: `${exercise.target_reps_min}-${exercise.target_reps_max}`, progressionNote: 'Technique load 50-70% de ta base.' };
    }

    if (key.includes('press') && press5rm) {
      return { recommendedWeight: round(press5rm * 0.9), recommendedReps: `${exercise.target_reps_min}-${exercise.target_reps_max}` };
    }
  }

  const bench5rm = typeof baseline.bench_press_5rm_kg === 'number' ? baseline.bench_press_5rm_kg : null;
  const squat5rm = typeof baseline.squat_5rm_kg === 'number' ? baseline.squat_5rm_kg : null;
  const row8rm = typeof baseline.row_8rm_kg === 'number' ? baseline.row_8rm_kg : null;

  if (key.includes('bench') && bench5rm) {
    return { recommendedWeight: round(bench5rm * 0.92), recommendedReps: `${exercise.target_reps_min}-${exercise.target_reps_max}`, progressionNote: 'Démarrage à ~90-95% de ton 5RM.' };
  }

  if (key.includes('squat') && squat5rm) {
    return { recommendedWeight: round(squat5rm * 0.92), recommendedReps: `${exercise.target_reps_min}-${exercise.target_reps_max}`, progressionNote: 'Démarrage à ~90-95% de ton 5RM.' };
  }

  if (key.includes('row') && row8rm) {
    return { recommendedWeight: round(row8rm * 0.95), recommendedReps: `${exercise.target_reps_min}-${exercise.target_reps_max}` };
  }

  return { recommendedWeight: null, recommendedReps: `${exercise.target_reps_min}-${exercise.target_reps_max}` };
};

export const buildNextSessionBlueprint = ({
  day,
  goal,
  cycleWeek,
  logsByExercise,
  equipmentType,
  archetype = 'hypertrophy',
  baseline = {}
}: {
  day: { day: string; focus: string; exercises: PlanExercise[] };
  goal: Goal;
  cycleWeek: number;
  logsByExercise: Record<string, ExerciseLogForProgression[]>;
  equipmentType?: EquipmentType;
  archetype?: Archetype;
  baseline?: Baseline;
}): SessionBlueprint => {
  const deload = isDeloadWeek(cycleWeek);

  const exercises = day.exercises.map((exercise) => {
    const logs = logsByExercise[exercise.exercise_key] ?? [];

    if (!logs.length) {
      const starter = baselineStartingPoint(exercise, archetype, baseline);
      return {
        ...exercise,
        recommended_weight: starter.recommendedWeight,
        recommended_reps: starter.recommendedReps,
        recommended_pace_sec_per_km: starter.pace ?? null,
        notes: [exercise.notes, starter.pace ? `Pace cible: ${starter.pace}s/km` : null].filter(Boolean).join(' · '),
        progression_note: starter.progressionNote
      };
    }

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
        progression_note: recommendation.progressionNote,
        recommended_pace_sec_per_km: null
      };
    }

    const deloaded = applyDeload({ exercise, recommendation });

    return {
      ...exercise,
      sets: deloaded.sets,
      notes: [exercise.notes, deloaded.note].filter(Boolean).join(' · '),
      recommended_weight: deloaded.recommendedWeight,
      recommended_reps: recommendation.recommendedReps,
      progression_note: deloaded.progressionNote,
      recommended_pace_sec_per_km: null
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
