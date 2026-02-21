'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import RestTimer from '@/components/RestTimer';
import { generatePlan, type EquipmentType, type GeneratedPlan, type Goal, type Location, type TrainingLevel, type UserPrefs } from '@/lib/plan/generatePlan';
import { getLastPerformance, recommendWeight, type ExerciseLogForProgression, type Recommendation, xpToLevel } from '@/lib/progression/recommendWeight';
import { getCycleWeek, isDeloadWeek, weekStart } from '@/lib/cycle/cycle';
import { buildNextSessionBlueprint, type SessionBlueprint } from '@/lib/session/nextSession';
import { ensureWeekSchedule, type ScheduledWorkoutRow } from '@/lib/schedule/scheduler';

type ProfilePrefs = {
  hero_class: string | null;
  training_level: TrainingLevel;
  goal: Goal;
  location: Location;
  days_per_week: number;
  equipment: string[];
};

type WorkoutPlanRow = {
  id: string;
  title: string;
  meta: UserPrefs;
  plan: GeneratedPlan;
  cycle_week: number;
  cycle_start_date: string;
  cycle_rules: Record<string, unknown>;
};

type ExerciseLogRow = {
  session_id: string;
  weight_kg: number | null;
  reps: number;
  rpe: number | null;
  created_at: string;
  exercise_key: string | null;
};

type WorkoutSessionRow = {
  id: string;
  blueprint: SessionBlueprint | null;
};

type SessionSummary = {
  durationMinutes: number;
  setsCount: number;
  totalVolume: number;
  xpBonus: number;
};

type WeeklyQuestRow = {
  completed_sessions: number;
  target_sessions: number;
  completed: boolean;
};

type UserStatsRow = {
  xp: number;
  level: number;
  streak_current: number;
  streak_best: number;
  last_workout_date: string | null;
  streak_milestones: number[] | null;
};

type ExerciseItem = {
  exercise_key: string;
  exercise_name: string;
  displayName: string;
  equipment_type: EquipmentType;
  sets_target: number;
  target_reps_min: number;
  target_reps_max: number;
  rpe_target: string | null;
  recommended_weight: number | null;
  note: string | null;
  originalIndex: number;
};

type RunnerMode = 'input' | 'rest';

type SetInputState = {
  weightKg: string;
  reps: string;
  rpe: string;
};

type FinishCelebrationState = {
  open: boolean;
  xpGained: number;
  oldXp: number;
  newXp: number;
  message: string;
};

const defaultPrefs: ProfilePrefs = {
  hero_class: 'Warrior',
  training_level: 'beginner',
  goal: 'muscle',
  location: 'gym',
  days_per_week: 3,
  equipment: []
};

const encouragementPool = [
  'Excellent boulot. La régularité fait les héros.',
  'Tu viens de gagner de l’XP IRL et IG.',
  'Propre. On progresse séance après séance.',
  'GG. La prochaine séance sera encore mieux.'
];

const weightedEquipment = new Set<EquipmentType>(['barbell', 'dumbbell', 'machine']);
const polyKeywords = ['squat', 'deadlift', 'bench', 'press', 'row', 'pull-up', 'dip', 'lunge', 'hip thrust'];
const isoKeywords = ['curl', 'lateral raise', 'extension', 'fly', 'raise', 'pushdown', 'leg curl', 'calf'];

const dbErrorMessage = (message: string) => (message.includes('does not exist') ? 'La base de données n’est pas à jour. Applique le schema SQL puis réessaie.' : message);

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const parseRepRangeFromScheme = (scheme: string | null | undefined): { min: number; max: number } => {
  const safe = scheme ?? '';
  const match = safe.match(/(\d+)\s*-\s*(\d+)/);
  if (match) return { min: Number(match[1]), max: Number(match[2]) };
  return { min: 8, max: 12 };
};

const parseSetsTarget = (sets: string | null | undefined): number => {
  const value = Number((sets ?? '').match(/\d+/)?.[0]);
  return Number.isFinite(value) && value > 0 ? value : 3;
};

const getExerciseClass = (name?: string | null): 'poly' | 'iso' | 'other' => {
  const normalized = (name ?? '').toLowerCase().trim();
  if (!normalized) return 'other';
  if (polyKeywords.some((keyword) => normalized.includes(keyword))) return 'poly';
  if (isoKeywords.some((keyword) => normalized.includes(keyword))) return 'iso';
  return 'other';
};

export default function PlanPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<ProfilePrefs | null>(null);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [finishingSession, setFinishingSession] = useState(false);
  const [savingSet, setSavingSet] = useState(false);
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation>>({});
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [activeCycleWeek, setActiveCycleWeek] = useState(1);
  const [cycleStartDate, setCycleStartDate] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [activeBlueprint, setActiveBlueprint] = useState<SessionBlueprint | null>(null);
  const [weeklyQuestProgress, setWeeklyQuestProgress] = useState<WeeklyQuestRow | null>(null);
  const [scheduledWorkouts, setScheduledWorkouts] = useState<ScheduledWorkoutRow[]>([]);
  const [activeScheduledWorkoutId, setActiveScheduledWorkoutId] = useState<string | null>(null);

  const [focusedExerciseIndex, setFocusedExerciseIndex] = useState(0);
  const [currentSetNumber, setCurrentSetNumber] = useState(1);
  const [runnerMode, setRunnerMode] = useState<RunnerMode>('input');
  const [restSecondsDefault, setRestSecondsDefault] = useState(90);
  const [setInputs, setSetInputs] = useState<Record<string, SetInputState>>({});
  const [sessionLogsCount, setSessionLogsCount] = useState<Record<string, number>>({});
  const [finishCelebration, setFinishCelebration] = useState<FinishCelebrationState>({ open: false, xpGained: 0, oldXp: 0, newXp: 0, message: encouragementPool[0] });
  const [animatedXp, setAnimatedXp] = useState(0);

  const savePlan = async (userId: string, nextPlan: GeneratedPlan): Promise<string | null> => {
    setSaving(true);
    setError(null);

    const { error: deactivateError } = await supabase.from('workout_plans').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);
    if (deactivateError) {
      setSaving(false);
      setError(dbErrorMessage(deactivateError.message));
      return null;
    }

    const { data, error: insertError } = await supabase
      .from('workout_plans')
      .insert({
        user_id: userId,
        is_active: true,
        title: nextPlan.title,
        meta: nextPlan.meta,
        plan: nextPlan,
        cycle_week: 1,
        cycle_start_date: new Date().toISOString().slice(0, 10),
        cycle_rules: { deload_week: 4, progression: 'auto' }
      })
      .select('id')
      .single();

    setSaving(false);
    if (insertError) {
      setError(dbErrorMessage(insertError.message));
      return null;
    }

    setActivePlanId(data.id);
    return data.id;
  };

  const fetchSessionLogCounts = async (userId: string, targetSessionId: string) => {
    const { data, error: logError } = await supabase
      .from('exercise_logs')
      .select('exercise_key')
      .eq('user_id', userId)
      .eq('session_id', targetSessionId)
      .returns<Array<{ exercise_key: string | null }>>();

    if (logError) {
      setError(dbErrorMessage(logError.message));
      return;
    }

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const key = row.exercise_key ?? '';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    setSessionLogsCount(counts);
  };

  useEffect(() => {
    const loadPlan = async () => {
      setLoading(true);
      setError(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        router.replace('/auth');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('hero_class, training_level, goal, location, days_per_week, equipment')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        setLoading(false);
        setError(dbErrorMessage(profileError.message));
        return;
      }

      const nextPrefs: ProfilePrefs = {
        hero_class: profile?.hero_class ?? defaultPrefs.hero_class,
        training_level: profile?.training_level ?? defaultPrefs.training_level,
        goal: profile?.goal ?? (profile?.hero_class === 'Warrior' ? 'muscle' : defaultPrefs.goal),
        location: profile?.location ?? defaultPrefs.location,
        days_per_week: profile?.days_per_week ?? defaultPrefs.days_per_week,
        equipment: profile?.equipment ?? []
      };
      setPrefs(nextPrefs);

      const { data: activePlan, error: activePlanError } = await supabase
        .from('workout_plans')
        .select('id, title, meta, plan, cycle_week, cycle_start_date, cycle_rules')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle<WorkoutPlanRow>();

      if (activePlanError) {
        setLoading(false);
        setError(dbErrorMessage(activePlanError.message));
        return;
      }

      let nextPlan: GeneratedPlan;
      let currentPlanId: string | null = activePlan?.id ?? null;

      if (activePlan?.plan) {
        nextPlan = activePlan.plan;
        setPlan(activePlan.plan);
        setActivePlanId(activePlan.id);
        setCycleStartDate(activePlan.cycle_start_date);
        setActiveCycleWeek(getCycleWeek(activePlan.cycle_start_date, new Date()));
      } else {
        const generated = generatePlan({
          hero_class: nextPrefs.hero_class ?? 'Warrior',
          training_level: nextPrefs.training_level,
          goal: nextPrefs.goal,
          location: nextPrefs.location,
          days_per_week: nextPrefs.days_per_week,
          equipment: nextPrefs.equipment
        });
        nextPlan = generated;
        setPlan(generated);
        setCycleStartDate(new Date().toISOString().slice(0, 10));
        setActiveCycleWeek(1);
        const createdPlanId = await savePlan(user.id, generated);
        if (createdPlanId) {
          setActivePlanId(createdPlanId);
          currentPlanId = createdPlanId;
        }
      }

      const recommendationMap: Record<string, Recommendation> = {};
      for (const [dayIndex, dayPlan] of nextPlan.days.entries()) {
        for (const [exerciseIndex, exercise] of dayPlan.exercises.entries()) {
          const uiKey = `${dayIndex}-${exerciseIndex}`;
          const { data: keyLogs } = await supabase
            .from('exercise_logs')
            .select('session_id, weight_kg, reps, rpe, created_at, exercise_key')
            .eq('user_id', user.id)
            .eq('exercise_key', exercise.exercise_key)
            .order('created_at', { ascending: false })
            .limit(30)
            .returns<ExerciseLogRow[]>();

          const logs = keyLogs ?? [];
          const parsed = parseRepRangeFromScheme(exercise.reps);
          const minReps = exercise.target_reps_min ?? parsed.min;
          const maxReps = exercise.target_reps_max ?? parsed.max;
          const lastPerformance = getLastPerformance(logs, minReps, maxReps);
          recommendationMap[uiKey] = recommendWeight({
            goal: nextPrefs.goal,
            targetRepsRange: { min: minReps, max: maxReps },
            lastWeight: lastPerformance.lastWeight,
            lastReps: lastPerformance.lastReps,
            lastRpe: lastPerformance.lastRpe,
            equipment: exercise.equipment_type,
            failedBelowTargetMinTwice: lastPerformance.failedBelowTargetMinTwice,
            targetMaxHitTwiceRecently: lastPerformance.targetMaxHitTwiceRecently
          });
        }
      }
      setRecommendations(recommendationMap);

      const currentWeekStart = weekStart(new Date()).toISOString().slice(0, 10);
      const { data: weeklyQuest } = await supabase
        .from('weekly_quests')
        .select('completed_sessions, target_sessions, completed')
        .eq('user_id', user.id)
        .eq('week_start', currentWeekStart)
        .maybeSingle<WeeklyQuestRow>();
      setWeeklyQuestProgress(weeklyQuest ?? { completed_sessions: 0, target_sessions: 3, completed: false });

      if (currentPlanId) {
        try {
          const schedule = await ensureWeekSchedule(user.id, nextPlan, currentPlanId);
          setScheduledWorkouts(schedule);
        } catch (scheduleError) {
          const message = scheduleError instanceof Error ? scheduleError.message : 'Impossible de créer le planning hebdomadaire.';
          setError(dbErrorMessage(message));
        }
      }

      const { data: existingSession } = await supabase
        .from('workout_sessions')
        .select('id, blueprint')
        .eq('user_id', user.id)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle<WorkoutSessionRow>();

      if (existingSession?.id) {
        setSessionId(existingSession.id);
        setActiveBlueprint(existingSession.blueprint ?? null);
        await fetchSessionLogCounts(user.id, existingSession.id);
      }

      setLoading(false);
    };

    loadPlan();
  }, [router]);

  const workoutItems = useMemo<ExerciseItem[]>(() => {
    if (!plan) return [];
    const dayExercises = plan.days[selectedDayIndex]?.exercises ?? [];
    const sourceExercises = activeBlueprint?.exercises ?? dayExercises;

    return sourceExercises.map((exercise, index) => {
      const fallback = dayExercises[index];
      const parsed = parseRepRangeFromScheme(exercise.reps ?? fallback?.reps);
      const targetMin = exercise.target_reps_min ?? fallback?.target_reps_min ?? parsed.min;
      const targetMax = exercise.target_reps_max ?? fallback?.target_reps_max ?? parsed.max;
      const recWeight =
        typeof (exercise as { recommended_weight?: unknown }).recommended_weight === 'number'
          ? ((exercise as { recommended_weight?: number }).recommended_weight ?? null)
          : recommendations[`${selectedDayIndex}-${index}`]?.recommendedWeight ?? null;
      const progressionNote = (exercise as { progression_note?: string }).progression_note;
      const note = progressionNote ?? exercise.notes ?? fallback?.notes ?? null;
      const rpeTarget = note?.match(/rpe\s*([\d-]+)/i)?.[1] ?? null;

      const displayName = (
        exercise.exercise_name
        ?? (exercise as { exerciseName?: string | null }).exerciseName
        ?? (exercise as { name?: string | null }).name
        ?? (exercise as { exercise_key?: string | null }).exercise_key
        ?? (exercise as { exerciseKey?: string | null }).exerciseKey
        ?? 'Exercice'
      ).toString().trim() || 'Exercice';

      return {
        exercise_key: exercise.exercise_key,
        exercise_name: exercise.exercise_name,
        displayName,
        equipment_type: exercise.equipment_type,
        sets_target: parseSetsTarget(exercise.sets ?? fallback?.sets),
        target_reps_min: targetMin,
        target_reps_max: targetMax,
        rpe_target: rpeTarget,
        recommended_weight: recWeight,
        note,
        originalIndex: index
      };
    });
  }, [activeBlueprint, plan, recommendations, selectedDayIndex]);

  const sortedSummaryItems = useMemo(() => {
    return [...workoutItems].sort((a, b) => {
      const rank = { poly: 0, iso: 1, other: 2 } as const;
      const aRank = rank[getExerciseClass(a.displayName)];
      const bRank = rank[getExerciseClass(b.displayName)];
      if (aRank === bRank) return a.originalIndex - b.originalIndex;
      return aRank - bRank;
    });
  }, [workoutItems]);

  const focusedExercise = workoutItems[focusedExerciseIndex] ?? null;

  useEffect(() => {
    if (!focusedExercise) {
      setCurrentSetNumber(1);
      return;
    }
    const completed = sessionLogsCount[focusedExercise.exercise_key] ?? 0;
    setCurrentSetNumber(Math.min(completed + 1, focusedExercise.sets_target));
  }, [focusedExercise, sessionLogsCount]);

  const allExercisesCompleted = useMemo(() => {
    if (!workoutItems.length) return false;
    return workoutItems.every((item) => (sessionLogsCount[item.exercise_key] ?? 0) >= item.sets_target);
  }, [sessionLogsCount, workoutItems]);

  const handleRegenerate = async () => {
    if (!prefs) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/auth');
      return;
    }

    const nextPlan = generatePlan({
      hero_class: prefs.hero_class ?? 'Warrior',
      training_level: prefs.training_level,
      goal: prefs.goal,
      location: prefs.location,
      days_per_week: prefs.days_per_week,
      equipment: prefs.equipment
    });

    setPlan(nextPlan);
    setSessionId(null);
    setSessionSummary(null);
    setActiveBlueprint(null);
    setSessionLogsCount({});
    setCycleStartDate(new Date().toISOString().slice(0, 10));
    setActiveCycleWeek(1);
    const createdPlanId = await savePlan(user.id, nextPlan);
    const schedulePlanId = createdPlanId ?? activePlanId;

    if (schedulePlanId) {
      try {
        const schedule = await ensureWeekSchedule(user.id, nextPlan, schedulePlanId);
        setScheduledWorkouts(schedule);
      } catch (scheduleError) {
        const message = scheduleError instanceof Error ? scheduleError.message : 'Impossible de mettre à jour le planning.';
        setError(dbErrorMessage(message));
      }
    }
  };

  const handleAdvanceWeek = async () => {
    if (!activePlanId || !cycleStartDate) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const start = new Date(`${cycleStartDate}T00:00:00`);
    start.setDate(start.getDate() - 7);
    const nextStart = start.toISOString().slice(0, 10);
    const nextWeek = getCycleWeek(nextStart, new Date());

    const { error: updateError } = await supabase.from('workout_plans').update({ cycle_start_date: nextStart, cycle_week: nextWeek }).eq('id', activePlanId).eq('user_id', user.id);
    if (updateError) {
      setError(dbErrorMessage(updateError.message));
      return;
    }

    setCycleStartDate(nextStart);
    setActiveCycleWeek(nextWeek);
  };

  const handleStartSession = async () => {
    if (!activePlanId || !prefs || !plan) {
      setError('Impossible de démarrer la session: plan actif introuvable.');
      return;
    }

    setStartingSession(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/auth');
      return;
    }

    const currentCycleWeek = getCycleWeek(cycleStartDate ?? new Date(), new Date());
    setActiveCycleWeek(currentCycleWeek);

    const today = formatDate(new Date());
    const scheduleForToday = scheduledWorkouts.find((item) => item.workout_date === today && item.status !== 'skipped') ?? null;
    const fallbackPlanned = [...scheduledWorkouts].filter((item) => item.status === 'planned').sort((a, b) => a.workout_date.localeCompare(b.workout_date))[0] ?? null;
    const targetSchedule = scheduleForToday ?? fallbackPlanned;
    const nextDayIndex = targetSchedule?.day_index ?? selectedDayIndex;
    setSelectedDayIndex(nextDayIndex);

    const dayPlan = plan.days[nextDayIndex];
    if (!dayPlan) {
      setStartingSession(false);
      setError('Jour de plan introuvable.');
      return;
    }

    const logsByExercise: Record<string, ExerciseLogForProgression[]> = {};
    for (const exercise of dayPlan.exercises) {
      const { data: logs } = await supabase
        .from('exercise_logs')
        .select('session_id, weight_kg, reps, rpe, created_at')
        .eq('user_id', user.id)
        .eq('exercise_key', exercise.exercise_key)
        .order('created_at', { ascending: false })
        .limit(30)
        .returns<ExerciseLogForProgression[]>();
      logsByExercise[exercise.exercise_key] = logs ?? [];
    }

    const blueprint = buildNextSessionBlueprint({ day: dayPlan, goal: prefs.goal, cycleWeek: currentCycleWeek, logsByExercise });

    const { data, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert({ user_id: user.id, plan_id: activePlanId, started_at: new Date().toISOString(), location: prefs.location, blueprint })
      .select('id')
      .single();

    setStartingSession(false);
    if (sessionError) {
      setError(dbErrorMessage(sessionError.message));
      return;
    }

    setSessionSummary(null);
    setActiveBlueprint(blueprint);
    setSessionId(data.id);
    setActiveScheduledWorkoutId(targetSchedule?.id ?? null);
    setSessionLogsCount({});
    setFocusedExerciseIndex(0);
    setRunnerMode('input');
  };

  const handleValidateSet = async () => {
    if (!sessionId || !activePlanId || !focusedExercise || savingSet) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/auth');
      return;
    }

    const inputKey = focusedExercise.exercise_key;
    const input = setInputs[inputKey] ?? { weightKg: '', reps: '', rpe: '' };
    const repsValue = Number(input.reps);
    if (!Number.isFinite(repsValue) || repsValue <= 0) {
      setError('Entre un nombre de reps valide avant de valider la série.');
      return;
    }

    if (weightedEquipment.has(focusedExercise.equipment_type) && !input.weightKg) {
      setError('Le poids est obligatoire pour cet exercice.');
      return;
    }

    if (repsValue < focusedExercise.target_reps_min || repsValue > focusedExercise.target_reps_max) {
      setWarning(`⚠️ ${focusedExercise.displayName}: ${repsValue} reps hors plage cible (${focusedExercise.target_reps_min}-${focusedExercise.target_reps_max}).`);
    } else {
      setWarning(null);
    }

    const setIndex = (sessionLogsCount[focusedExercise.exercise_key] ?? 0) + 1;
    const exerciseClass = getExerciseClass(focusedExercise.displayName);
    const restDefault = exerciseClass === 'poly' ? 120 : exerciseClass === 'iso' ? 60 : 90;

    setSavingSet(true);
    setError(null);

    const { error: insertError } = await supabase.from('exercise_logs').insert({
      user_id: user.id,
      session_id: sessionId,
      plan_id: activePlanId,
      day_index: selectedDayIndex,
      exercise_index: focusedExercise.originalIndex,
      exercise_key: focusedExercise.exercise_key,
      exercise_name: focusedExercise.exercise_name,
      equipment_type: focusedExercise.equipment_type,
      set_index: setIndex,
      target_reps_min: focusedExercise.target_reps_min,
      target_reps_max: focusedExercise.target_reps_max,
      weight_kg: input.weightKg ? Number(input.weightKg) : null,
      reps: repsValue,
      rpe: input.rpe ? Number(input.rpe) : null,
      rest_seconds: restDefault
    });

    if (insertError) {
      setSavingSet(false);
      setError(dbErrorMessage(insertError.message));
      return;
    }

    const { data: userStats, error: statFetchError } = await supabase.from('user_stats').select('xp').eq('user_id', user.id).maybeSingle<{ xp: number }>();
    if (statFetchError) {
      setSavingSet(false);
      setError(dbErrorMessage(statFetchError.message));
      return;
    }

    const nextXp = (userStats?.xp ?? 0) + 10;
    const nextLevel = xpToLevel(nextXp);
    const { error: upsertError } = await supabase.from('user_stats').upsert({ user_id: user.id, xp: nextXp, level: nextLevel }, { onConflict: 'user_id' });

    if (upsertError) {
      setSavingSet(false);
      setError(dbErrorMessage(upsertError.message));
      return;
    }

    setSessionLogsCount((prev) => ({ ...prev, [focusedExercise.exercise_key]: (prev[focusedExercise.exercise_key] ?? 0) + 1 }));
    setSetInputs((prev) => ({ ...prev, [inputKey]: { ...input, reps: '', rpe: '' } }));
    setRestSecondsDefault(restDefault);
    setRunnerMode('rest');
    setSavingSet(false);
  };

  const handleRestComplete = () => {
    if (!focusedExercise) {
      setRunnerMode('input');
      return;
    }

    const completed = sessionLogsCount[focusedExercise.exercise_key] ?? 0;
    if (completed >= focusedExercise.sets_target) {
      const nextIndex = workoutItems.findIndex((item) => (sessionLogsCount[item.exercise_key] ?? 0) < item.sets_target);
      if (nextIndex >= 0) setFocusedExerciseIndex(nextIndex);
    }
    setRunnerMode('input');
  };

  const handleFinishWorkout = async () => {
    if (!sessionId) return;

    setFinishingSession(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/auth');
      return;
    }

    const nowIso = new Date().toISOString();
    const { data: updatedSession, error: endError } = await supabase
      .from('workout_sessions')
      .update({ ended_at: nowIso })
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .is('ended_at', null)
      .select('started_at, ended_at')
      .single<{ started_at: string; ended_at: string | null }>();

    if (endError) {
      setFinishingSession(false);
      setError(dbErrorMessage(endError.message));
      return;
    }

    const { data: logs, error: logsError } = await supabase.from('exercise_logs').select('weight_kg, reps').eq('user_id', user.id).eq('session_id', sessionId).returns<Array<{ weight_kg: number | null; reps: number }>>();
    if (logsError) {
      setFinishingSession(false);
      setError(dbErrorMessage(logsError.message));
      return;
    }

    const setsCount = logs?.length ?? 0;
    const totalVolume = (logs ?? []).reduce((sum, set) => sum + (set.weight_kg ? set.weight_kg * set.reps : 0), 0);
    const durationMinutes = Math.max(1, Math.round((new Date(updatedSession.ended_at ?? nowIso).getTime() - new Date(updatedSession.started_at).getTime()) / (1000 * 60)));

    let xpBonus = setsCount >= 6 ? 50 : 0;

    const currentWeekStart = weekStart(new Date()).toISOString().slice(0, 10);
    const { data: existingQuest } = await supabase
      .from('weekly_quests')
      .select('completed_sessions, target_sessions, completed')
      .eq('user_id', user.id)
      .eq('week_start', currentWeekStart)
      .maybeSingle<WeeklyQuestRow>();

    const previousSessions = existingQuest?.completed_sessions ?? 0;
    const targetSessions = existingQuest?.target_sessions ?? 3;
    const updatedCompletedSessions = previousSessions + 1;
    const questNowCompleted = updatedCompletedSessions >= targetSessions;
    if (questNowCompleted && !(existingQuest?.completed ?? false)) xpBonus += 200;

    const { data: userStats, error: statsFetchError } = await supabase
      .from('user_stats')
      .select('xp, level, streak_current, streak_best, last_workout_date, streak_milestones')
      .eq('user_id', user.id)
      .maybeSingle<UserStatsRow>();

    if (statsFetchError) {
      setFinishingSession(false);
      setError(dbErrorMessage(statsFetchError.message));
      return;
    }

    const today = formatDate(new Date());
    const yesterday = formatDate(addDays(new Date(), -1));
    const prevStreak = userStats?.streak_current ?? 0;
    const previousWorkoutDate = userStats?.last_workout_date;
    const nextStreak = previousWorkoutDate === yesterday ? prevStreak + 1 : 1;
    const nextBest = Math.max(userStats?.streak_best ?? 0, nextStreak);
    const reachedMilestones = new Set<number>((userStats?.streak_milestones ?? []).map(Number));
    if ([3, 7, 14].includes(nextStreak) && !reachedMilestones.has(nextStreak)) {
      reachedMilestones.add(nextStreak);
      xpBonus += 100;
    }

    const oldXp = userStats?.xp ?? 0;
    const nextXp = oldXp + xpBonus;
    const nextLevel = xpToLevel(nextXp);

    const { error: statsUpsertError } = await supabase.from('user_stats').upsert(
      { user_id: user.id, xp: nextXp, level: nextLevel, streak_current: nextStreak, streak_best: nextBest, last_workout_date: today, streak_milestones: Array.from(reachedMilestones.values()) },
      { onConflict: 'user_id' }
    );

    if (statsUpsertError) {
      setFinishingSession(false);
      setError(dbErrorMessage(statsUpsertError.message));
      return;
    }

    await supabase.from('weekly_quests').upsert(
      { user_id: user.id, week_start: currentWeekStart, target_sessions: targetSessions, completed_sessions: updatedCompletedSessions, completed: questNowCompleted },
      { onConflict: 'user_id,week_start' }
    );

    if (activeScheduledWorkoutId) {
      await supabase.from('scheduled_workouts').update({ status: 'done', session_id: sessionId }).eq('id', activeScheduledWorkoutId).eq('user_id', user.id);
    }

    try {
      const refreshedSchedule = plan && activePlanId ? await ensureWeekSchedule(user.id, plan, activePlanId) : [];
      setScheduledWorkouts(refreshedSchedule);
    } catch {
      // best effort
    }

    setWeeklyQuestProgress({ completed_sessions: updatedCompletedSessions, target_sessions: targetSessions, completed: questNowCompleted });
    setSessionSummary({ durationMinutes, setsCount, totalVolume, xpBonus });
    setActiveBlueprint(null);
    setSessionId(null);
    setActiveScheduledWorkoutId(null);
    setSessionLogsCount({});
    setRunnerMode('input');
    setFinishCelebration({
      open: true,
      xpGained: xpBonus,
      oldXp,
      newXp: nextXp,
      message: encouragementPool[Math.floor(Math.random() * encouragementPool.length)]
    });
    setAnimatedXp(oldXp);
    setFinishingSession(false);
  };

  useEffect(() => {
    if (!finishCelebration.open) return;
    let raf = window.setInterval(() => {
      setAnimatedXp((prev) => {
        if (prev >= finishCelebration.newXp) {
          window.clearInterval(raf);
          return finishCelebration.newXp;
        }
        return Math.min(finishCelebration.newXp, prev + Math.max(1, Math.ceil((finishCelebration.newXp - finishCelebration.oldXp) / 20)));
      });
    }, 35);
    return () => window.clearInterval(raf);
  }, [finishCelebration]);

  const planDescription = useMemo(() => (!sessionId ? 'Démarre une session pour lancer le runner.' : `Session en cours (${sessionId.slice(0, 8)}...)`), [sessionId]);

  if (loading) return <p className="text-slate-300">Chargement du plan...</p>;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold">Programme recommandé</h2>
          <p className="text-slate-300">Ton plan hebdomadaire personnalisé selon tes préférences.</p>
          <p className="text-xs text-slate-400">{planDescription}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-violet-400/30 bg-violet-900/30 px-2 py-1 text-violet-100">Cycle S{activeCycleWeek}</span>
            {isDeloadWeek(activeCycleWeek) ? <span className="rounded-full border border-amber-400/30 bg-amber-900/30 px-2 py-1 text-amber-100">Deload</span> : null}
            {weeklyQuestProgress ? <span className="rounded-full border border-cyan-400/30 bg-cyan-900/30 px-2 py-1 text-cyan-100">Quête: {weeklyQuestProgress.completed_sessions}/{weeklyQuestProgress.target_sessions}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={startingSession || !activePlanId || Boolean(sessionId)} onClick={handleStartSession} type="button">
            {sessionId ? 'Session active' : startingSession ? 'Starting...' : 'Start session'}
          </button>
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} onClick={handleRegenerate} type="button">
            {saving ? 'Génération...' : 'Regenerate plan'}
          </button>
          {process.env.NODE_ENV !== 'production' ? (
            <button className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white" onClick={handleAdvanceWeek} type="button">Advance week</button>
          ) : null}
          <Link className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white" href="/dashboard">Back dashboard</Link>
        </div>
      </div>

      {error ? <p className="rounded-md border border-rose-500/30 bg-rose-900/20 p-3 text-sm text-rose-200">{error}</p> : null}
      {warning ? <p className="rounded-md border border-amber-500/30 bg-amber-900/20 p-3 text-sm text-amber-200">{warning}</p> : null}

      {sessionSummary ? (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-900/10 p-4 text-sm">
          <h3 className="text-lg font-semibold text-cyan-200">Résumé de session</h3>
          <p>Durée: {sessionSummary.durationMinutes} min</p>
          <p>Séries: {sessionSummary.setsCount}</p>
          <p>Volume total: {sessionSummary.totalVolume.toFixed(1)} kg</p>
          <p>Bonus XP: +{sessionSummary.xpBonus}</p>
        </div>
      ) : null}

      {plan ? (
        <>
          <div className="rounded-xl border border-violet-500/30 bg-slate-900/80 p-5">
            <h3 className="text-xl font-semibold text-violet-200">{plan.title}</h3>
            <p className="mt-2 text-slate-300">Split: {plan.split}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <label className="text-sm text-slate-300" htmlFor="day-selector">Jour de session</label>
            <select className="ml-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm" id="day-selector" onChange={(event) => setSelectedDayIndex(Number(event.target.value))} value={selectedDayIndex}>
              {plan.days.map((dayPlan, dayIndex) => (
                <option key={dayPlan.day} value={dayIndex}>{dayPlan.day} - {dayPlan.focus}</option>
              ))}
            </select>
          </div>

          {sessionId ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <h4 className="text-lg font-semibold text-violet-200">Résumé de la séance</h4>
                <p className="mb-3 text-sm text-slate-400">{plan.title}</p>
                <div className="space-y-2 text-sm">
                  {sortedSummaryItems.map((item) => {
                    const completed = (sessionLogsCount[item.exercise_key] ?? 0) >= item.sets_target;
                    const focused = focusedExercise?.exercise_key === item.exercise_key;
                    return (
                      <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2" key={item.exercise_key}>
                        <p>{item.displayName} — {item.sets_target} séries • {item.target_reps_min}-{item.target_reps_max} reps</p>
                        <span>{completed ? '✅' : focused ? '▶️' : '⏳'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                <aside className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <h5 className="font-semibold">Exercices</h5>
                  <div className="mt-3 space-y-2">
                    {workoutItems.map((item, idx) => (
                      <button
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm ${idx === focusedExerciseIndex ? 'border-violet-400 bg-violet-900/30' : 'border-slate-700 bg-slate-950/50'}`}
                        key={item.exercise_key}
                        onClick={() => {
                          setFocusedExerciseIndex(idx);
                          setRunnerMode('input');
                        }}
                        type="button"
                      >
                        <p className="font-medium">{item.displayName}</p>
                        <p className="text-xs text-slate-400">{sessionLogsCount[item.exercise_key] ?? 0}/{item.sets_target} séries</p>
                      </button>
                    ))}
                  </div>
                </aside>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  {focusedExercise ? (
                    runnerMode === 'rest' ? (
                      <RestTimer defaultSeconds={restSecondsDefault} onStop={handleRestComplete} />
                    ) : (
                      <>
                        <h5 className="text-xl font-semibold">{focusedExercise.displayName}</h5>
                        <p className="mt-1 text-sm text-slate-300">
                          Poids recommandé: {focusedExercise.recommended_weight === null ? 'N/A' : `${focusedExercise.recommended_weight} kg`} ·
                          Cible: {focusedExercise.target_reps_min}-{focusedExercise.target_reps_max} reps ·
                          Série {currentSetNumber}/{focusedExercise.sets_target}
                        </p>
                        {focusedExercise.note ? <p className="mt-1 text-xs text-cyan-200">{focusedExercise.note}</p> : null}

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          {focusedExercise.equipment_type !== 'bodyweight' ? (
                            <input
                              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                              onChange={(event) => setSetInputs((prev) => ({ ...prev, [focusedExercise.exercise_key]: { ...(prev[focusedExercise.exercise_key] ?? { reps: '', rpe: '', weightKg: '' }), weightKg: event.target.value } }))}
                              placeholder="Poids (kg)"
                              type="number"
                              value={setInputs[focusedExercise.exercise_key]?.weightKg ?? ''}
                            />
                          ) : <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">Poids non requis (bodyweight)</div>}
                          <input className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" onChange={(event) => setSetInputs((prev) => ({ ...prev, [focusedExercise.exercise_key]: { ...(prev[focusedExercise.exercise_key] ?? { reps: '', rpe: '', weightKg: '' }), reps: event.target.value } }))} placeholder="Reps" type="number" value={setInputs[focusedExercise.exercise_key]?.reps ?? ''} />
                          <input className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" onChange={(event) => setSetInputs((prev) => ({ ...prev, [focusedExercise.exercise_key]: { ...(prev[focusedExercise.exercise_key] ?? { reps: '', rpe: '', weightKg: '' }), rpe: event.target.value } }))} placeholder="RPE (optionnel)" step="0.5" type="number" value={setInputs[focusedExercise.exercise_key]?.rpe ?? ''} />
                        </div>

                        <button className="mt-4 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={savingSet} onClick={handleValidateSet} type="button">
                          {savingSet ? 'Validation...' : `Valider série ${currentSetNumber}`}
                        </button>
                      </>
                    )
                  ) : <p className="text-sm text-slate-300">Aucun exercice.</p>}
                </div>
              </div>

              {allExercisesCompleted ? (
                <button className="w-full rounded-xl bg-emerald-600 px-6 py-4 text-lg font-bold text-white disabled:opacity-60" disabled={finishingSession} onClick={handleFinishWorkout} type="button">
                  {finishingSession ? 'Finalisation...' : 'Séance terminée'}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">Démarre une session pour lancer le workout runner guidé.</p>
          )}
        </>
      ) : null}

      {finishCelebration.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-emerald-500/30 bg-slate-900 p-6">
            <h3 className="text-2xl font-bold text-emerald-300">Bravo 💪</h3>
            <p className="mt-2 text-slate-200">Tu as gagné +{finishCelebration.xpGained} XP</p>
            <p className="mt-1 text-sm text-slate-400">{finishCelebration.message}</p>
            <div className="mt-4">
              <div className="h-3 w-full rounded-full bg-slate-800">
                <div className="h-3 rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${Math.min(100, ((animatedXp % 1000) / 1000) * 100)}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-300">XP: {animatedXp} / {finishCelebration.newXp}</p>
            </div>
            <button className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white" onClick={() => setFinishCelebration((prev) => ({ ...prev, open: false }))} type="button">Continuer</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
