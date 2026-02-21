import type { EquipmentType } from '@/lib/plan/generatePlan';
import type { ConstraintSet, PlanExercise, VariantExercise } from '@/lib/coach/types';

const normalize = (value: string) => value.toLowerCase().trim();

const equipmentAllowed = (equipmentType: EquipmentType, available: string[], location: string) => {
  if (equipmentType === 'bodyweight' || equipmentType === 'running') return true;
  if (location === 'outdoor') return false;
  return available.map(normalize).includes(normalize(equipmentType));
};

const inferBaseKey = (exerciseKey: string): string => {
  if (exerciseKey.includes('bench')) return 'barbell_bench_press';
  if (exerciseKey.includes('squat')) return 'barbell_back_squat';
  if (exerciseKey.includes('row')) return 'barbell_row';
  if (exerciseKey.includes('pullup')) return 'strict_pullup';
  if (exerciseKey.includes('interval')) return 'interval_run';
  return exerciseKey;
};

export const pickSubstitute = (
  baseExercise: PlanExercise,
  context: ConstraintSet,
  variantsCatalog: VariantExercise[]
): PlanExercise => {
  const isBanned = context.banned.map(normalize).includes(normalize(baseExercise.exercise_key));
  const equipmentOk = equipmentAllowed(baseExercise.equipment_type, context.equipment, context.location);
  const baseInjured = context.injuries.some((injury) => normalize(baseExercise.exercise_name).includes(normalize(injury)));

  if (!isBanned && equipmentOk && !baseInjured) return baseExercise;

  const baseKey = inferBaseKey(baseExercise.exercise_key);
  const candidate = variantsCatalog
    .filter((variant) => variant.base_key === baseKey)
    .filter((variant) => !context.banned.map(normalize).includes(normalize(variant.variant_key)))
    .filter((variant) => equipmentAllowed(variant.equipment_type, context.equipment, context.location))
    .sort((a, b) => a.priority - b.priority)[0];

  if (!candidate) return baseExercise;

  return {
    ...baseExercise,
    exercise_key: candidate.variant_key,
    exercise_name: candidate.name,
    equipment_type: candidate.equipment_type,
    notes: [baseExercise.notes, `Substitution coach: ${baseExercise.exercise_name} → ${candidate.name}`].filter(Boolean).join(' · ')
  };
};
