import type { Archetype, Baseline, EquipmentType, Goal, Location } from '@/lib/plan/generatePlan';
import type { ExerciseLogForProgression } from '@/lib/progression/recommendWeight';

export type PlanExercise = {
  exercise_key: string;
  exercise_name: string;
  pattern?: string;
  kind?: 'strength' | 'run';
  equipment_type: EquipmentType;
  sets: string;
  reps: string;
  target_reps_min: number;
  target_reps_max: number;
  notes?: string;
  target_duration_min?: number | null;
  target_distance_km?: number | null;
  target_intervals?: number | null;
  work_seconds?: number | null;
  rest_seconds?: number | null;
  target_pace_min_per_km?: string | null;
  target_speed_kmh?: string | null;
};

export type PlanDay = {
  day: string;
  focus: string;
  exercises: PlanExercise[];
};

export type ConstraintSet = {
  injuries: string[];
  equipment: string[];
  location: Location | 'outdoor';
  banned: string[];
  preferred?: string[];
  timeCapMinutes?: number | null;
};

export type VariantExercise = {
  base_key: string;
  variant_key: string;
  name: string;
  equipment_type: EquipmentType;
  tags: string[];
  priority: number;
};

export type SessionBlueprintExercise = PlanExercise & {
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

export type BlueprintInput = {
  planDay: PlanDay;
  archetype: Archetype;
  baseline: Baseline;
  goal: Goal;
  logsByExercise: Record<string, ExerciseLogForProgression[]>;
  constraints: ConstraintSet;
  variantsCatalog: VariantExercise[];
  cycleWeek: number;
};
