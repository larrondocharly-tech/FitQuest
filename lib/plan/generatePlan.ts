export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced';
export type Goal = 'muscle' | 'strength' | 'fat_loss' | 'general';
export type Location = 'gym' | 'home';
export type Archetype = 'calisthenics' | 'hypertrophy' | 'weightlifting' | 'running';

export type Baseline = Record<string, number | null | undefined>;

export type UserPrefs = {
  hero_class: 'Warrior' | 'Mage' | 'Rogue' | 'Ninja' | 'Titan' | 'Ranger' | 'Runner' | string;
  training_level: TrainingLevel;
  goal: Goal;
  location: Location;
  days_per_week: 2 | 3 | 4 | 5 | 6 | number;
  equipment: string[];
  archetype?: Archetype;
  baseline?: Baseline;
};

export type EquipmentType = 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'band' | 'running' | 'unknown';

type ExercisePattern =
  | 'squat'
  | 'hinge'
  | 'horizontal_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'vertical_push'
  | 'delts_iso'
  | 'abs'
  | 'biceps'
  | 'triceps'
  | 'pull'
  | 'push'
  | 'legs'
  | 'core'
  | 'skill'
  | 'snatch_tech'
  | 'cleanjerk_tech'
  | 'front_squat'
  | 'pulls'
  | 'accessories'
  | 'intervals'
  | 'tempo'
  | 'easy'
  | 'long';

type Exercise = {
  exercise_key: string;
  exercise_name: string;
  pattern: ExercisePattern;
  kind: 'strength' | 'run';
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

type PlanDay = {
  day: string;
  focus: string;
  exercises: Exercise[];
};

export type GeneratedPlan = {
  title: string;
  meta: UserPrefs & { archetype: Archetype };
  split: string;
  days: PlanDay[];
};

type PatternDefinition = {
  pattern: ExercisePattern;
  sets: string;
  reps: string;
  notes?: string;
  target_duration_min?: number | null;
  target_distance_km?: number | null;
  target_intervals?: number | null;
  work_seconds?: number | null;
  rest_seconds?: number | null;
};

const weekdayLabels = ['Jour 1', 'Jour 2', 'Jour 3', 'Jour 4', 'Jour 5', 'Jour 6'];

const slugifyExercise = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const parseRepRange = (reps: string): { min: number; max: number } => {
  const numbers = reps.match(/\d+/g) ?? [];
  if (!numbers.length) return { min: 8, max: 12 };
  if (numbers.length === 1) {
    const value = Number(numbers[0]);
    return { min: value, max: value };
  }
  return { min: Number(numbers[0]), max: Number(numbers[1]) };
};

export const mapHeroClassToArchetype = (heroClass: string | null | undefined): Archetype => {
  if (heroClass === 'Ninja') return 'calisthenics';
  if (heroClass === 'Titan') return 'weightlifting';
  if (heroClass === 'Ranger' || heroClass === 'Runner') return 'running';
  return 'hypertrophy';
};

const normalizeGoal = (prefs: UserPrefs): Goal => {
  if (prefs.goal) return prefs.goal;
  return prefs.hero_class === 'Warrior' ? 'muscle' : 'general';
};

const chooseVariant = (pattern: ExercisePattern, location: Location, equipment: string[]) => {
  const has = (item: string) => equipment.includes(item);

  const gymMap: Record<ExercisePattern, { key: string; name: string; equipment_type: EquipmentType }> = {
    squat: { key: 'barbell_back_squat', name: 'Barbell Back Squat', equipment_type: 'barbell' },
    hinge: { key: 'barbell_romanian_deadlift', name: 'Barbell Romanian Deadlift', equipment_type: 'barbell' },
    horizontal_push: { key: 'barbell_bench_press', name: 'Barbell Bench Press', equipment_type: 'barbell' },
    horizontal_pull: { key: 'barbell_row', name: 'Barbell Row', equipment_type: 'barbell' },
    vertical_pull: { key: 'lat_pulldown', name: 'Lat Pulldown', equipment_type: 'machine' },
    vertical_push: { key: 'seated_db_shoulder_press', name: 'Seated Dumbbell Shoulder Press', equipment_type: 'dumbbell' },
    delts_iso: { key: 'db_lateral_raise', name: 'Dumbbell Lateral Raise', equipment_type: 'dumbbell' },
    abs: { key: 'cable_crunch', name: 'Cable Crunch', equipment_type: 'machine' },
    biceps: { key: 'ez_bar_curl', name: 'EZ-Bar Curl', equipment_type: 'barbell' },
    triceps: { key: 'cable_pushdown', name: 'Cable Triceps Pushdown', equipment_type: 'machine' },
    pull: { key: 'strict_pullup', name: 'Strict Pull-Ups', equipment_type: 'bodyweight' },
    push: { key: 'ring_dips', name: 'Dips', equipment_type: 'bodyweight' },
    legs: { key: 'walking_lunge', name: 'Walking Lunges', equipment_type: 'bodyweight' },
    core: { key: 'hollow_body_hold', name: 'Hollow Body Hold', equipment_type: 'bodyweight' },
    skill: { key: 'handstand_practice', name: 'Handstand Practice', equipment_type: 'bodyweight' },
    snatch_tech: { key: 'hang_power_snatch', name: 'Hang Power Snatch', equipment_type: 'barbell' },
    cleanjerk_tech: { key: 'hang_power_clean', name: 'Hang Power Clean + Push Jerk', equipment_type: 'barbell' },
    front_squat: { key: 'barbell_front_squat', name: 'Barbell Front Squat', equipment_type: 'barbell' },
    pulls: { key: 'clean_pull', name: 'Clean Pull', equipment_type: 'barbell' },
    accessories: { key: 'rear_delt_machine_fly', name: 'Rear Delt Machine Fly', equipment_type: 'machine' },
    intervals: { key: 'interval_run', name: 'Interval Run', equipment_type: 'running' },
    tempo: { key: 'tempo_run', name: 'Tempo Run', equipment_type: 'running' },
    easy: { key: 'easy_run', name: 'Easy Run', equipment_type: 'running' },
    long: { key: 'long_run', name: 'Long Run', equipment_type: 'running' }
  };

  const homeMap: Partial<Record<ExercisePattern, { key: string; name: string; equipment_type: EquipmentType }>> = {
    squat: has('dumbbells')
      ? { key: 'goblet_squat', name: 'Goblet Squat', equipment_type: 'dumbbell' }
      : { key: 'bodyweight_squat', name: 'Bodyweight Squat', equipment_type: 'bodyweight' },
    hinge: has('dumbbells')
      ? { key: 'db_romanian_deadlift', name: 'Dumbbell Romanian Deadlift', equipment_type: 'dumbbell' }
      : { key: 'band_good_morning', name: 'Band Good Morning', equipment_type: 'band' },
    horizontal_push: has('dumbbells')
      ? { key: 'db_floor_press', name: 'Dumbbell Floor Press', equipment_type: 'dumbbell' }
      : { key: 'pushup', name: 'Push-Ups', equipment_type: 'bodyweight' },
    horizontal_pull: has('dumbbells')
      ? { key: 'single_arm_db_row', name: 'Single-Arm Dumbbell Row', equipment_type: 'dumbbell' }
      : has('bands')
        ? { key: 'band_row', name: 'Band Row', equipment_type: 'band' }
        : { key: 'inverted_row', name: 'Inverted Row', equipment_type: 'bodyweight' },
    vertical_pull: has('pullup_bar')
      ? { key: 'pullup', name: 'Pull-Ups', equipment_type: 'bodyweight' }
      : { key: 'band_lat_pulldown', name: 'Band Lat Pulldown', equipment_type: 'band' },
    vertical_push: has('dumbbells')
      ? { key: 'db_shoulder_press', name: 'Dumbbell Shoulder Press', equipment_type: 'dumbbell' }
      : { key: 'pike_pushup', name: 'Pike Push-Up', equipment_type: 'bodyweight' },
    delts_iso: has('bands')
      ? { key: 'band_lateral_raise', name: 'Band Lateral Raise', equipment_type: 'band' }
      : { key: 'db_lateral_raise', name: 'Dumbbell Lateral Raise', equipment_type: has('dumbbells') ? 'dumbbell' : 'bodyweight' },
    abs: { key: 'plank', name: 'Plank', equipment_type: 'bodyweight' },
    biceps: has('bands')
      ? { key: 'band_curl', name: 'Band Curl', equipment_type: 'band' }
      : { key: 'db_curl', name: 'Dumbbell Curl', equipment_type: has('dumbbells') ? 'dumbbell' : 'bodyweight' },
    triceps: has('bands')
      ? { key: 'band_triceps_extension', name: 'Band Triceps Extension', equipment_type: 'band' }
      : { key: 'diamond_pushup', name: 'Diamond Push-Ups', equipment_type: 'bodyweight' }
  };

  if (location === 'home' && homeMap[pattern]) {
    return homeMap[pattern] as { key: string; name: string; equipment_type: EquipmentType };
  }

  return gymMap[pattern];
};

const resolvePattern = (patternDef: PatternDefinition, prefs: UserPrefs): Exercise => {
  const variant = chooseVariant(patternDef.pattern, prefs.location, prefs.equipment);
  const targetRange = parseRepRange(patternDef.reps);

  return {
    exercise_key: variant.key || slugifyExercise(variant.name),
    exercise_name: variant.name,
    pattern: patternDef.pattern,
    kind: variant.equipment_type === 'running' ? 'run' : 'strength',
    equipment_type: variant.equipment_type,
    sets: patternDef.sets,
    reps: patternDef.reps,
    target_reps_min: targetRange.min,
    target_reps_max: targetRange.max,
    notes: patternDef.notes,
    target_duration_min: patternDef.target_duration_min ?? null,
    target_distance_km: patternDef.target_distance_km ?? null,
    target_intervals: patternDef.target_intervals ?? null,
    work_seconds: patternDef.work_seconds ?? null,
    rest_seconds: patternDef.rest_seconds ?? null,
    target_pace_min_per_km: null,
    target_speed_kmh: null
  };
};

const buildPatternDays = (archetype: Archetype, daysPerWeek: number, goal: Goal): Array<{ focus: string; patterns: PatternDefinition[] }> => {
  const days = Math.min(6, Math.max(2, daysPerWeek));

  if (archetype === 'running') {
    const runningDays: Array<{ focus: string; patterns: PatternDefinition[] }> = [
      {
        focus: 'Fractionné',
        patterns: [
          { pattern: 'intervals', sets: '1', reps: '1', target_duration_min: 24, target_intervals: 6, work_seconds: 60, rest_seconds: 60, notes: 'Fractionné: 6 x (1:00 rapide / 1:00 récup). Échauffement et retour au calme inclus.' }
        ]
      },
      { focus: 'Tempo', patterns: [{ pattern: 'tempo', sets: '1', reps: '1', target_duration_min: 35, notes: 'Échauffement 10 min + tempo 10-20 min + retour au calme 10 min.' }] },
      { focus: 'Sortie longue', patterns: [{ pattern: 'long', sets: '1', reps: '1', target_duration_min: 60, notes: 'Sortie longue en aisance respiratoire.' }] },
      { focus: 'Footing facile', patterns: [{ pattern: 'easy', sets: '1', reps: '1', target_duration_min: 35, notes: 'Footing facile, régulier et relâché.' }] }
    ];
    return runningDays.slice(0, Math.min(days, runningDays.length));
  }

  if (archetype === 'calisthenics') {
    const cali: Array<{ focus: string; patterns: PatternDefinition[] }> = [
      { focus: 'Pull + Core', patterns: [{ pattern: 'pull', sets: '4', reps: '4-8' }, { pattern: 'core', sets: '3', reps: '20-40', notes: 'Arrête 1-2 reps avant échec' }, { pattern: 'skill', sets: '3', reps: '20-40' }] },
      { focus: 'Push + Legs', patterns: [{ pattern: 'push', sets: '4', reps: '5-10' }, { pattern: 'legs', sets: '4', reps: '8-12' }, { pattern: 'core', sets: '3', reps: '20-40' }] },
      { focus: 'Skill + Full Body', patterns: [{ pattern: 'skill', sets: '4', reps: '15-30' }, { pattern: 'pull', sets: '3', reps: '4-8' }, { pattern: 'push', sets: '3', reps: '6-12' }] }
    ];
    return Array.from({ length: days }, (_, i) => cali[i % cali.length]);
  }

  if (archetype === 'weightlifting') {
    const wl: Array<{ focus: string; patterns: PatternDefinition[] }> = [
      { focus: 'Snatch Technique', patterns: [{ pattern: 'snatch_tech', sets: '5', reps: '2-3' }, { pattern: 'front_squat', sets: '4', reps: '3-5' }, { pattern: 'accessories', sets: '3', reps: '8-12' }] },
      { focus: 'Clean & Jerk Technique', patterns: [{ pattern: 'cleanjerk_tech', sets: '5', reps: '2-3' }, { pattern: 'pulls', sets: '4', reps: '3-5' }, { pattern: 'accessories', sets: '3', reps: '8-12' }] },
      { focus: 'Strength Base', patterns: [{ pattern: 'front_squat', sets: '5', reps: '3-5' }, { pattern: 'vertical_push', sets: '3', reps: '5-8' }, { pattern: 'horizontal_pull', sets: '3', reps: '6-10' }] }
    ];
    return Array.from({ length: days }, (_, i) => wl[i % wl.length]);
  }

  const heavyReps = goal === 'strength' ? '3-5' : '5-8';
  const hypertrophyTemplate: Array<{ focus: string; patterns: PatternDefinition[] }> = [
    { focus: 'Upper A', patterns: [{ pattern: 'horizontal_push', sets: '3', reps: heavyReps }, { pattern: 'horizontal_pull', sets: '3', reps: '6-10' }, { pattern: 'vertical_push', sets: '3', reps: '6-10' }, { pattern: 'biceps', sets: '3', reps: '10-15' }, { pattern: 'triceps', sets: '3', reps: '10-15' }] },
    { focus: 'Lower A', patterns: [{ pattern: 'squat', sets: '3', reps: heavyReps }, { pattern: 'hinge', sets: '3', reps: '6-10' }, { pattern: 'abs', sets: '3', reps: '12-20' }] },
    { focus: 'Upper B', patterns: [{ pattern: 'vertical_pull', sets: '3', reps: '6-10' }, { pattern: 'horizontal_push', sets: '3', reps: '6-10' }, { pattern: 'horizontal_pull', sets: '3', reps: '6-10' }, { pattern: 'delts_iso', sets: '3', reps: '12-20' }, { pattern: 'triceps', sets: '3', reps: '10-15' }] }
  ];

  return Array.from({ length: days }, (_, i) => hypertrophyTemplate[i % hypertrophyTemplate.length]);
};

export const generatePlan = (prefs: UserPrefs): GeneratedPlan => {
  const normalizedGoal = normalizeGoal(prefs);
  const archetype = prefs.archetype ?? mapHeroClassToArchetype(prefs.hero_class);

  const normalizedPrefs: UserPrefs & { archetype: Archetype } = {
    ...prefs,
    goal: normalizedGoal,
    archetype
  };

  const patternDays = buildPatternDays(archetype, normalizedPrefs.days_per_week, normalizedGoal);
  const days = patternDays.map((patternDay, index) => ({
    day: weekdayLabels[index],
    focus: patternDay.focus,
    exercises: patternDay.patterns.map((entry) => resolvePattern(entry, normalizedPrefs))
  }));

  return {
    title: `Plan ${archetype} - ${normalizedPrefs.training_level}`,
    meta: normalizedPrefs,
    split: archetype,
    days
  };
};
