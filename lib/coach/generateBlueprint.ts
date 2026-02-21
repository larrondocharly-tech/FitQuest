import { applyDeload, isDeloadWeek } from '@/lib/cycle/cycle';
import { detectPlateau } from '@/lib/coach/plateau';
import { baselineToZones, formatPaceRange, recommendPaceForWorkout } from '@/lib/coach/running';
import { pickSubstitute } from '@/lib/coach/substitute';
import type { BlueprintInput, SessionBlueprint, SessionBlueprintExercise } from '@/lib/coach/types';
import { getLastPerformance, recommendWeight, type Recommendation } from '@/lib/progression/recommendWeight';

export const generateSessionBlueprint = ({
  planDay,
  archetype,
  baseline,
  goal,
  logsByExercise,
  constraints,
  variantsCatalog,
  cycleWeek
}: BlueprintInput): SessionBlueprint => {
  const deload = isDeloadWeek(cycleWeek);
  const zones = baselineToZones(baseline);

  const exercises: SessionBlueprintExercise[] = planDay.exercises.map((rawExercise) => {
    const substituted = pickSubstitute(rawExercise, constraints, variantsCatalog);
    const logs = logsByExercise[rawExercise.exercise_key] ?? [];
    const plateau = detectPlateau(rawExercise.exercise_key, logs, {
      min: rawExercise.target_reps_min,
      max: rawExercise.target_reps_max
    });

    let exercise = substituted;
    if (plateau.isPlateau) {
      const swap = variantsCatalog
        .filter((variant) => variant.base_key === rawExercise.exercise_key && variant.variant_key !== substituted.exercise_key)
        .sort((a, b) => a.priority - b.priority)[0];
      if (swap) {
        exercise = {
          ...substituted,
          exercise_key: swap.variant_key,
          exercise_name: swap.name,
          equipment_type: swap.equipment_type,
          notes: [substituted.notes, `Plateau détecté: bascule vers ${swap.name}.`].filter(Boolean).join(' · ')
        };
      }
    }

    if (archetype === 'running') {
      const pace = recommendPaceForWorkout(exercise.exercise_key, zones, cycleWeek);
      return {
        ...exercise,
        recommended_weight: null,
        recommended_reps: `${exercise.target_reps_min}-${exercise.target_reps_max}`,
        recommended_pace_sec_per_km: pace,
        target_pace_min_per_km: formatPaceRange(pace),
        progression_note: pace ? `Allure cible ${formatPaceRange(pace)}` : 'Courir en aisance respiratoire.'
      };
    }

    const lastPerformance = getLastPerformance(logs, exercise.target_reps_min, exercise.target_reps_max);
    const recommendation: Recommendation = recommendWeight({
      goal,
      targetRepsRange: { min: exercise.target_reps_min, max: exercise.target_reps_max },
      lastWeight: lastPerformance.lastWeight,
      lastReps: lastPerformance.lastReps,
      lastRpe: lastPerformance.lastRpe,
      equipment: exercise.equipment_type,
      failedBelowTargetMinTwice: lastPerformance.failedBelowTargetMinTwice,
      targetMaxHitTwiceRecently: lastPerformance.targetMaxHitTwiceRecently
    });

    if (!deload) {
      return {
        ...exercise,
        recommended_weight: recommendation.recommendedWeight,
        recommended_reps: recommendation.recommendedReps,
        progression_note: [recommendation.progressionNote, plateau.isPlateau ? plateau.reason : null].filter(Boolean).join(' · '),
        recommended_pace_sec_per_km: null
      };
    }

    const deloaded = applyDeload({ exercise, recommendation });
    return {
      ...exercise,
      sets: deloaded.sets,
      recommended_weight: deloaded.recommendedWeight,
      recommended_reps: recommendation.recommendedReps,
      progression_note: deloaded.progressionNote,
      recommended_pace_sec_per_km: null,
      notes: [exercise.notes, deloaded.note].filter(Boolean).join(' · ')
    };
  });

  return {
    cycle_week: cycleWeek,
    deload,
    day: planDay.day,
    focus: planDay.focus,
    exercises
  };
};
