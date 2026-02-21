export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced';
export type Goal = 'muscle' | 'strength' | 'fat_loss' | 'general';
export type Location = 'gym' | 'home';

export type UserPrefs = {
  hero_class: 'Warrior' | 'Mage' | 'Rogue' | string;
  training_level: TrainingLevel;
  goal: Goal;
  location: Location;
  days_per_week: 2 | 3 | 4 | 5 | 6 | number;
  equipment: string[];
};

type Exercise = {
  name: string;
  sets: string;
  reps: string;
  notes?: string;
};

type PlanDay = {
  day: string;
  focus: string;
  exercises: Exercise[];
};

export type GeneratedPlan = {
  title: string;
  meta: UserPrefs;
  split: string;
  days: PlanDay[];
};

type ExerciseLibrary = {
  horizontalPush: string;
  verticalPush: string;
  horizontalPull: string;
  verticalPull: string;
  squat: string;
  hinge: string;
  lateralRaise: string;
  curls: string;
  triceps: string;
  core: string;
  lunge: string;
};

const weekdayLabels = ['Jour 1', 'Jour 2', 'Jour 3', 'Jour 4', 'Jour 5', 'Jour 6'];

const normalizeGoal = (prefs: UserPrefs): Goal => {
  if (prefs.goal) {
    return prefs.goal;
  }

  return prefs.hero_class === 'Warrior' ? 'muscle' : 'general';
};

const getExerciseLibrary = (location: Location, equipment: string[]): ExerciseLibrary => {
  if (location === 'gym') {
    return {
      horizontalPush: 'Barbell Bench Press',
      verticalPush: 'Seated Dumbbell Shoulder Press',
      horizontalPull: 'Barbell Row',
      verticalPull: 'Lat Pulldown',
      squat: 'Back Squat',
      hinge: 'Deadlift / Romanian Deadlift',
      lateralRaise: 'Dumbbell Lateral Raise',
      curls: 'EZ-Bar Curl',
      triceps: 'Cable Triceps Pushdown',
      core: 'Cable Crunch',
      lunge: 'Walking Lunges'
    };
  }

  const has = (item: string) => equipment.includes(item);

  const horizontalPush = has('dumbbells')
    ? 'Dumbbell Bench Press / Floor Press'
    : 'Push-Ups';
  const verticalPush = has('dumbbells')
    ? 'Dumbbell Shoulder Press'
    : 'Pike Push-Up';
  const horizontalPull = has('dumbbells')
    ? 'Single-Arm Dumbbell Row'
    : has('bands')
      ? 'Band Row'
      : 'Inverted Row (if possible)';
  const verticalPull = has('pullup_bar')
    ? 'Pull-Ups / Chin-Ups'
    : has('bands')
      ? 'Band Lat Pulldown'
      : horizontalPull;
  const squat = has('dumbbells')
    ? 'Goblet Squat / Split Squat'
    : 'Bodyweight Squat';
  const hinge = has('dumbbells')
    ? 'Dumbbell Romanian Deadlift'
    : 'Hip Hinge Good Morning';

  return {
    horizontalPush,
    verticalPush,
    horizontalPull,
    verticalPull,
    squat,
    hinge,
    lateralRaise: has('dumbbells') ? 'Dumbbell Lateral Raise' : has('bands') ? 'Band Lateral Raise' : 'Lateral Raise (Bodyweight Lean)',
    curls: has('dumbbells') ? 'Dumbbell Curl' : has('bands') ? 'Band Curl' : 'Towel Curl Isometric',
    triceps: has('dumbbells') ? 'Overhead Dumbbell Triceps Extension' : has('bands') ? 'Band Triceps Extension' : 'Diamond Push-Ups',
    core: 'Plank / Hollow Hold',
    lunge: 'Reverse Lunges'
  };
};

const getRepScheme = (goal: Goal) => {
  if (goal === 'strength') {
    return {
      compoundSets: '4',
      compoundReps: '3-5',
      secondarySets: '3',
      secondaryReps: '5-8',
      accessorySets: '3',
      accessoryReps: '10-12',
      note: 'Repos 2-3 min sur les mouvements principaux.'
    };
  }

  if (goal === 'fat_loss' || goal === 'general') {
    return {
      compoundSets: '3',
      compoundReps: '8-12',
      secondarySets: '3',
      secondaryReps: '10-12',
      accessorySets: '3',
      accessoryReps: '12-15',
      note: 'Repos courts (60-90 sec), focus technique et dépense énergétique.'
    };
  }

  return {
    compoundSets: '3',
    compoundReps: '5-8',
    secondarySets: '3',
    secondaryReps: '8-10',
    accessorySets: '3',
    accessoryReps: '12-15',
    note: 'Progresse de 1-2 reps avant d’augmenter la charge.'
  };
};

const fullBodyDay = (day: string, focus: string, ex: ExerciseLibrary, goal: Goal): PlanDay => {
  const reps = getRepScheme(goal);

  return {
    day,
    focus,
    exercises: [
      { name: ex.squat, sets: reps.compoundSets, reps: reps.compoundReps, notes: 'RPE 7-8' },
      { name: ex.horizontalPush, sets: reps.secondarySets, reps: reps.secondaryReps },
      { name: ex.horizontalPull, sets: reps.secondarySets, reps: reps.secondaryReps },
      { name: ex.hinge, sets: reps.secondarySets, reps: reps.secondaryReps },
      { name: ex.verticalPull, sets: reps.secondarySets, reps: reps.secondaryReps },
      { name: ex.lateralRaise, sets: reps.accessorySets, reps: reps.accessoryReps },
      { name: ex.core, sets: '3', reps: '30-45 sec', notes: reps.note }
    ]
  };
};

const upperDay = (day: string, focus: string, ex: ExerciseLibrary, goal: Goal): PlanDay => {
  const reps = getRepScheme(goal);

  return {
    day,
    focus,
    exercises: [
      { name: ex.horizontalPush, sets: reps.compoundSets, reps: reps.compoundReps, notes: 'RPE 7-8' },
      { name: ex.verticalPull, sets: reps.secondarySets, reps: reps.secondaryReps },
      { name: ex.verticalPush, sets: reps.secondarySets, reps: reps.secondaryReps },
      { name: ex.horizontalPull, sets: reps.secondarySets, reps: reps.secondaryReps },
      { name: ex.lateralRaise, sets: reps.accessorySets, reps: reps.accessoryReps },
      { name: ex.curls, sets: reps.accessorySets, reps: reps.accessoryReps },
      { name: ex.triceps, sets: reps.accessorySets, reps: reps.accessoryReps }
    ]
  };
};

const lowerDay = (day: string, focus: string, ex: ExerciseLibrary, goal: Goal): PlanDay => {
  const reps = getRepScheme(goal);

  return {
    day,
    focus,
    exercises: [
      { name: ex.squat, sets: reps.compoundSets, reps: reps.compoundReps, notes: 'RPE 7-8' },
      { name: ex.hinge, sets: reps.secondarySets, reps: reps.secondaryReps },
      { name: ex.lunge, sets: reps.secondarySets, reps: reps.secondaryReps },
      { name: 'Leg Press / Step-Up', sets: reps.secondarySets, reps: reps.secondaryReps },
      { name: ex.core, sets: '3', reps: '30-45 sec', notes: reps.note }
    ]
  };
};

const getSplit = (daysPerWeek: number) => {
  if (daysPerWeek <= 3) {
    return 'Full Body';
  }

  if (daysPerWeek === 4) {
    return 'Upper / Lower';
  }

  if (daysPerWeek === 5) {
    return 'Push / Pull / Legs + Upper + Accessory';
  }

  return 'Push / Pull / Legs x2';
};

const makeDays = (prefs: UserPrefs, ex: ExerciseLibrary, goal: Goal): PlanDay[] => {
  const days = Math.min(6, Math.max(3, prefs.days_per_week));

  if (days <= 3) {
    return [
      fullBodyDay(weekdayLabels[0], 'Full Body A', ex, goal),
      fullBodyDay(weekdayLabels[1], 'Full Body B', ex, goal),
      fullBodyDay(weekdayLabels[2], 'Full Body A', ex, goal)
    ];
  }

  if (days === 4) {
    return [
      upperDay(weekdayLabels[0], 'Upper A', ex, goal),
      lowerDay(weekdayLabels[1], 'Lower A', ex, goal),
      upperDay(weekdayLabels[2], 'Upper B', ex, goal),
      lowerDay(weekdayLabels[3], 'Lower B', ex, goal)
    ];
  }

  if (days === 5) {
    return [
      upperDay(weekdayLabels[0], 'Push', ex, goal),
      upperDay(weekdayLabels[1], 'Pull', ex, goal),
      lowerDay(weekdayLabels[2], 'Legs', ex, goal),
      upperDay(weekdayLabels[3], 'Upper Hypertrophy', ex, goal),
      lowerDay(weekdayLabels[4], 'Accessory + Core', ex, goal)
    ];
  }

  return [
    upperDay(weekdayLabels[0], 'Push A', ex, goal),
    upperDay(weekdayLabels[1], 'Pull A', ex, goal),
    lowerDay(weekdayLabels[2], 'Legs A', ex, goal),
    upperDay(weekdayLabels[3], 'Push B', ex, goal),
    upperDay(weekdayLabels[4], 'Pull B', ex, goal),
    lowerDay(weekdayLabels[5], 'Legs B', ex, goal)
  ];
};

export const generatePlan = (prefs: UserPrefs): GeneratedPlan => {
  const normalizedGoal = normalizeGoal(prefs);
  const normalizedPrefs: UserPrefs = {
    ...prefs,
    goal: normalizedGoal
  };

  const exerciseLibrary = getExerciseLibrary(normalizedPrefs.location, normalizedPrefs.equipment);
  const split = getSplit(normalizedPrefs.days_per_week);
  const days = makeDays(normalizedPrefs, exerciseLibrary, normalizedGoal);

  return {
    title: `Plan ${split} - ${normalizedPrefs.training_level}`,
    meta: normalizedPrefs,
    split,
    days
  };
};
