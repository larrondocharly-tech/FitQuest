'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import RestTimer from '@/components/RestTimer';
import { generatePlan, type EquipmentType, type GeneratedPlan, type Goal, type Location, type TrainingLevel, type UserPrefs } from '@/lib/plan/generatePlan';
import { getLastPerformance, recommendWeight, type ExerciseLogForProgression, type Recommendation, xpToLevel } from '@/lib/progression/recommendWeight';
import { getCycleWeek, weekStart } from '@/lib/cycle/cycle';
import { buildNextSessionBlueprint, type SessionBlueprint } from '@/lib/session/nextSession';
import { ensureWeekSchedule, type ScheduledWorkoutRow } from '@/lib/schedule/scheduler';

type ProfilePrefs = {
  hero_name: string | null;
  hero_class: string | null;
  training_level: TrainingLevel;
  goal: Goal;
  location: Location;
  days_per_week: number;
  equipment: string[];
};

type WorkoutPlanRow = {
  id: string;
  plan: GeneratedPlan;
  cycle_start_date: string;
};

type WorkoutSessionRow = {
  id: string;
  blueprint: SessionBlueprint | null;
};

type ExerciseLogRow = {
  session_id: string;
  weight_kg: number | null;
  reps: number;
  rpe: number | null;
  created_at: string;
  exercise_key: string | null;
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

type RunnerMode = 'input' | 'rest' | 'done';

type SetInputState = { weightKg: string; reps: string; rpe: string };

type ExerciseItem = {
  exercise_key: string;
  displayName: string;
  exercise_name: string;
  equipment_type: EquipmentType;
  sets_target: number;
  target_reps_min: number;
  target_reps_max: number;
  recommended_weight: number | null;
  note: string | null;
  originalIndex: number;
  classType: 'poly' | 'iso' | 'other';
};

type RestModalProps = {
  open: boolean;
  exerciseName: string;
  validatedSetLabel: string;
  recommendedSeconds: number;
  onNext: () => void;
  onClose?: () => void;
};

const defaultPrefs: ProfilePrefs = {
  hero_name: null,
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

const dbErrorMessage = (message: string) => {
  if (message.includes("Could not find the 'set_number' column") || message.includes('exercise_logs.set_number')) {
    return 'Ta base Supabase n’est pas à jour. Applique le schema SQL (exercise_logs.set_number) puis recharge.';
  }
  if (message.includes('does not exist')) {
    return 'La base de données n’est pas à jour. Applique le schema SQL puis réessaie.';
  }
  return message;
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

const RestModal = ({ open, exerciseName, validatedSetLabel, recommendedSeconds, onNext, onClose }: RestModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Repos</p>
            <h3 className="text-lg font-semibold text-slate-100">{exerciseName}</h3>
            <p className="mt-1 text-sm text-emerald-300">{validatedSetLabel} ✅</p>
          </div>
          {onClose ? <button aria-label="Fermer" className="rounded-md px-2 py-1 text-slate-300" onClick={onClose} type="button">✕</button> : null}
        </div>

        <p className="mt-2 text-sm text-slate-300">Repos conseillé: {recommendedSeconds}s</p>
        <div className="mt-4">
          <RestTimer defaultSeconds={recommendedSeconds} onStop={onNext} />
        </div>

        <button className="mt-4 w-full rounded-lg bg-violet-700 px-4 py-3 text-base font-semibold" onClick={onNext} type="button">
          Passer à la série suivante
        </button>
      </div>
    </div>
  );
};

export default function PlanPage() {
  const router = useRouter();

  const [prefs, setPrefs] = useState<ProfilePrefs | null>(null);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [cycleStartDate, setCycleStartDate] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [activeBlueprint, setActiveBlueprint] = useState<SessionBlueprint | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scheduledWorkouts, setScheduledWorkouts] = useState<ScheduledWorkoutRow[]>([]);
  const [activeScheduledWorkoutId, setActiveScheduledWorkoutId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [finishingSession, setFinishingSession] = useState(false);
  const [savingSet, setSavingSet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [focusedExerciseIndex, setFocusedExerciseIndex] = useState(0);
  const [runnerMode, setRunnerMode] = useState<RunnerMode>('input');
  const [restModalOpen, setRestModalOpen] = useState(false);
  const [restModalMeta, setRestModalMeta] = useState<{ exerciseName: string; recommendedSeconds: number; setNumber: number; setsTarget: number }>({ exerciseName: 'Exercice', recommendedSeconds: 90, setNumber: 1, setsTarget: 1 });
  const [setInputs, setSetInputs] = useState<Record<string, SetInputState>>({});
  const [sessionLogsCount, setSessionLogsCount] = useState<Record<string, number>>({});

  const [recommendations, setRecommendations] = useState<Record<string, Recommendation>>({});
  const [weeklyQuestProgress, setWeeklyQuestProgress] = useState<WeeklyQuestRow | null>(null);
  const [finishCelebration, setFinishCelebration] = useState<{ open: boolean; xpGained: number; message: string }>({ open: false, xpGained: 0, message: encouragementPool[0] });

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
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/auth');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('hero_name, hero_class, training_level, goal, location, days_per_week, equipment')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        setLoading(false);
        setError(dbErrorMessage(profileError.message));
        return;
      }

      const nextPrefs: ProfilePrefs = {
        hero_name: profile?.hero_name ?? null,
        hero_class: profile?.hero_class ?? defaultPrefs.hero_class,
        training_level: profile?.training_level ?? defaultPrefs.training_level,
        goal: profile?.goal ?? defaultPrefs.goal,
        location: profile?.location ?? defaultPrefs.location,
        days_per_week: profile?.days_per_week ?? defaultPrefs.days_per_week,
        equipment: profile?.equipment ?? []
      };
      setPrefs(nextPrefs);

      const { data: activePlan, error: planError } = await supabase
        .from('workout_plans')
        .select('id, plan, cycle_start_date')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle<WorkoutPlanRow>();

      if (planError) {
        setLoading(false);
        setError(dbErrorMessage(planError.message));
        return;
      }

      let effectivePlan = activePlan?.plan ?? null;
      let planId = activePlan?.id ?? null;

      if (!effectivePlan) {
        effectivePlan = generatePlan({
          hero_class: nextPrefs.hero_class ?? 'Warrior',
          training_level: nextPrefs.training_level,
          goal: nextPrefs.goal,
          location: nextPrefs.location,
          days_per_week: nextPrefs.days_per_week,
          equipment: nextPrefs.equipment
        });
        planId = await savePlan(user.id, effectivePlan);
      }

      setPlan(effectivePlan);
      setActivePlanId(planId);
      setCycleStartDate(activePlan?.cycle_start_date ?? new Date().toISOString().slice(0, 10));

      if (effectivePlan && planId) {
        try {
          const schedule = await ensureWeekSchedule(user.id, effectivePlan, planId);
          setScheduledWorkouts(schedule);
        } catch (scheduleError) {
          const msg = scheduleError instanceof Error ? scheduleError.message : 'Impossible de créer le planning.';
          setError(dbErrorMessage(msg));
        }
      }

      if (effectivePlan) {
        const recommendationMap: Record<string, Recommendation> = {};
        for (const [dayIndex, dayPlan] of effectivePlan.days.entries()) {
          for (const [exerciseIndex, exercise] of dayPlan.exercises.entries()) {
            const key = `${dayIndex}-${exerciseIndex}`;
            const { data: logs } = await supabase
              .from('exercise_logs')
              .select('session_id, weight_kg, reps, rpe, created_at, exercise_key')
              .eq('user_id', user.id)
              .eq('exercise_key', exercise.exercise_key)
              .order('created_at', { ascending: false })
              .limit(30)
              .returns<ExerciseLogRow[]>();
            const parsed = parseRepRangeFromScheme(exercise.reps);
            const min = exercise.target_reps_min ?? parsed.min;
            const max = exercise.target_reps_max ?? parsed.max;
            const last = getLastPerformance(logs ?? [], min, max);
            recommendationMap[key] = recommendWeight({
              goal: nextPrefs.goal,
              targetRepsRange: { min, max },
              lastWeight: last.lastWeight,
              lastReps: last.lastReps,
              lastRpe: last.lastRpe,
              equipment: exercise.equipment_type,
              failedBelowTargetMinTwice: last.failedBelowTargetMinTwice,
              targetMaxHitTwiceRecently: last.targetMaxHitTwiceRecently
            });
          }
        }
        setRecommendations(recommendationMap);
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

      const currentWeekStart = weekStart(new Date()).toISOString().slice(0, 10);
      const { data: weeklyQuest } = await supabase
        .from('weekly_quests')
        .select('completed_sessions, target_sessions, completed')
        .eq('user_id', user.id)
        .eq('week_start', currentWeekStart)
        .maybeSingle<WeeklyQuestRow>();
      setWeeklyQuestProgress(weeklyQuest ?? { completed_sessions: 0, target_sessions: 3, completed: false });

      setLoading(false);
    };

    load();
  }, [router]);

  const workoutItems = useMemo<ExerciseItem[]>(() => {
    if (!plan) return [];
    const dayExercises = plan.days[selectedDayIndex]?.exercises ?? [];
    const source = activeBlueprint?.exercises ?? dayExercises;

    const normalized = source.map((exercise, index) => {
      const fallback = dayExercises[index];
      const parsed = parseRepRangeFromScheme(exercise.reps ?? fallback?.reps);
      const targetMin = exercise.target_reps_min ?? fallback?.target_reps_min ?? parsed.min;
      const targetMax = exercise.target_reps_max ?? fallback?.target_reps_max ?? parsed.max;
      const setsTarget = parseSetsTarget(exercise.sets ?? fallback?.sets);
      const candidateDisplayName = (exercise as { displayName?: string }).displayName
        ?? exercise.exercise_name
        ?? (fallback as { displayName?: string } | undefined)?.displayName
        ?? fallback?.exercise_name
        ?? 'Exercice';
      const displayName = candidateDisplayName.trim() || 'Exercice';
      const recWeight = typeof (exercise as { recommended_weight?: unknown }).recommended_weight === 'number'
        ? (exercise as { recommended_weight?: number }).recommended_weight ?? null
        : recommendations[`${selectedDayIndex}-${index}`]?.recommendedWeight ?? null;

      return {
        exercise_key: exercise.exercise_key ?? fallback?.exercise_key ?? `exercise-${index}`,
        displayName,
        exercise_name: exercise.exercise_name ?? fallback?.exercise_name ?? displayName,
        equipment_type: (exercise.equipment_type ?? fallback?.equipment_type ?? 'bodyweight') as EquipmentType,
        sets_target: setsTarget,
        target_reps_min: targetMin,
        target_reps_max: targetMax,
        recommended_weight: recWeight,
        note: (exercise as { note?: string; notes?: string }).note ?? (exercise as { note?: string; notes?: string }).notes ?? null,
        originalIndex: index,
        classType: getExerciseClass(displayName)
      };
    });

    const order = (type: ExerciseItem['classType']) => (type === 'poly' ? 0 : type === 'iso' ? 1 : 2);
    return [...normalized].sort((a, b) => {
      const rank = order(a.classType) - order(b.classType);
      return rank === 0 ? a.originalIndex - b.originalIndex : rank;
    });
  }, [activeBlueprint, plan, recommendations, selectedDayIndex]);

  const focusedExercise = workoutItems[focusedExerciseIndex] ?? null;
  const allExercisesCompleted = workoutItems.length > 0 && workoutItems.every((item) => (sessionLogsCount[item.exercise_key] ?? 0) >= item.sets_target);
  const currentSetNumber = focusedExercise ? (sessionLogsCount[focusedExercise.exercise_key] ?? 0) + 1 : 1;

  useEffect(() => {
    if (!focusedExercise) {
      setRunnerMode('done');
      return;
    }
    if (allExercisesCompleted) setRunnerMode('done');
  }, [allExercisesCompleted, focusedExercise]);

  const moveToNextStep = () => {
    setRestModalOpen(false);
    if (!focusedExercise) {
      setRunnerMode('done');
      return;
    }
    const completed = sessionLogsCount[focusedExercise.exercise_key] ?? 0;
    if (completed >= focusedExercise.sets_target) {
      const nextIdx = workoutItems.findIndex((item) => (sessionLogsCount[item.exercise_key] ?? 0) < item.sets_target);
      if (nextIdx >= 0) {
        setFocusedExerciseIndex(nextIdx);
        setRunnerMode('input');
      } else {
        setRunnerMode('done');
      }
      return;
    }

    setSetInputs((prev) => ({
      ...prev,
      [focusedExercise.exercise_key]: {
        ...prev[focusedExercise.exercise_key],
        reps: '',
        rpe: '',
        weightKg: focusedExercise.equipment_type === 'bodyweight' ? '' : prev[focusedExercise.exercise_key]?.weightKg ?? ''
      }
    }));
    setRunnerMode('input');
  };

  const handleStartSession = async () => {
    if (!plan || !activePlanId || !prefs) return;
    setStartingSession(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/auth');
      return;
    }

    const today = formatDate(new Date());
    const scheduleForToday = scheduledWorkouts.find((item) => item.workout_date === today && item.status !== 'skipped') ?? null;
    const fallbackPlanned = [...scheduledWorkouts].filter((item) => item.status === 'planned').sort((a, b) => a.workout_date.localeCompare(b.workout_date))[0] ?? null;
    const targetSchedule = scheduleForToday ?? fallbackPlanned;
    const dayIndex = targetSchedule?.day_index ?? selectedDayIndex;
    setSelectedDayIndex(dayIndex);

    const dayPlan = plan.days[dayIndex];
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

    const blueprint = buildNextSessionBlueprint({
      day: dayPlan,
      goal: prefs.goal,
      cycleWeek: getCycleWeek(cycleStartDate ?? new Date(), new Date()),
      logsByExercise
    });

    const { data, error: insertError } = await supabase
      .from('workout_sessions')
      .insert({ user_id: user.id, plan_id: activePlanId, started_at: new Date().toISOString(), location: prefs.location, blueprint })
      .select('id')
      .single();

    setStartingSession(false);
    if (insertError) {
      setError(dbErrorMessage(insertError.message));
      return;
    }

    setSessionId(data.id);
    setActiveBlueprint(blueprint);
    setActiveScheduledWorkoutId(targetSchedule?.id ?? null);
    setSessionLogsCount({});
    setFocusedExerciseIndex(0);
    setRestModalOpen(false);
    setRunnerMode('input');
  };

  const handleValidateSet = async () => {
    if (!sessionId || !activePlanId || !focusedExercise || savingSet || runnerMode !== 'input') return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/auth');
      return;
    }

    const key = focusedExercise.exercise_key;
    const input = setInputs[key] ?? { weightKg: '', reps: '', rpe: '' };
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

    const setNumber = (sessionLogsCount[key] ?? 0) + 1;
    const selectedDayIndexValue = Number(selectedDayIndex);
    const safeDayIndex = Number.isFinite(selectedDayIndexValue) ? selectedDayIndexValue : 1;
    const recommendedRest = focusedExercise.classType === 'poly' ? 120 : focusedExercise.classType === 'iso' ? 90 : 90;
    const safeExerciseName = focusedExercise.displayName?.trim() || focusedExercise.exercise_name?.trim() || focusedExercise.exercise_key?.trim() || 'Exercice';

    setSavingSet(true);
    setError(null);

    const { error: insertError } = await supabase.from('exercise_logs').insert({
      user_id: user.id,
      session_id: sessionId,
      plan_id: activePlanId,
      day_index: safeDayIndex,
      exercise_index: focusedExercise.originalIndex + 1,
      exercise_key: focusedExercise.exercise_key,
      exercise_name: safeExerciseName,
      equipment_type: focusedExercise.equipment_type,
      weight_kg: focusedExercise.equipment_type === 'bodyweight' || !input.weightKg ? null : Number(input.weightKg),
      reps: repsValue,
      rpe: input.rpe ? Number(input.rpe) : null,
      rest_seconds: recommendedRest,
      set_number: setNumber
    });

    if (insertError) {
      setSavingSet(false);
      setError(dbErrorMessage(insertError.message));
      return;
    }

    const { data: stats, error: statsError } = await supabase.from('user_stats').select('xp').eq('user_id', user.id).maybeSingle<{ xp: number }>();
    if (statsError) {
      setSavingSet(false);
      setError(dbErrorMessage(statsError.message));
      return;
    }

    const nextXp = (stats?.xp ?? 0) + 10;
    const nextLevel = xpToLevel(nextXp);
    const { error: upsertError } = await supabase.from('user_stats').upsert({ user_id: user.id, xp: nextXp, level: nextLevel }, { onConflict: 'user_id' });
    if (upsertError) {
      setSavingSet(false);
      setError(dbErrorMessage(upsertError.message));
      return;
    }

    setSessionLogsCount((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
    setRestModalMeta({
      exerciseName: safeExerciseName,
      recommendedSeconds: recommendedRest,
      setNumber,
      setsTarget: focusedExercise.sets_target
    });
    setRestModalOpen(true);
    setRunnerMode('rest');
    setSavingSet(false);
  };

  const handleFinishWorkout = async () => {
    if (!sessionId || !allExercisesCompleted) return;
    setFinishingSession(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/auth');
      return;
    }

    const nowIso = new Date().toISOString();
    const { data: sessionRow, error: endError } = await supabase
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
    const durationMinutes = Math.max(1, Math.round((new Date(sessionRow.ended_at ?? nowIso).getTime() - new Date(sessionRow.started_at).getTime()) / (1000 * 60)));

    let xpBonus = setsCount >= 6 ? 50 : 0;
    const currentWeekStart = weekStart(new Date()).toISOString().slice(0, 10);
    const { data: existingQuest } = await supabase.from('weekly_quests').select('completed_sessions, target_sessions, completed').eq('user_id', user.id).eq('week_start', currentWeekStart).maybeSingle<WeeklyQuestRow>();

    const previousSessions = existingQuest?.completed_sessions ?? 0;
    const targetSessions = existingQuest?.target_sessions ?? 3;
    const updatedCompletedSessions = previousSessions + 1;
    const questNowCompleted = updatedCompletedSessions >= targetSessions;
    if (questNowCompleted && !(existingQuest?.completed ?? false)) xpBonus += 200;

    const { data: userStats, error: statsError } = await supabase
      .from('user_stats')
      .select('xp, level, streak_current, streak_best, last_workout_date, streak_milestones')
      .eq('user_id', user.id)
      .maybeSingle<UserStatsRow>();

    if (statsError) {
      setFinishingSession(false);
      setError(dbErrorMessage(statsError.message));
      return;
    }

    const today = formatDate(new Date());
    const yesterday = formatDate(addDays(new Date(), -1));
    const prevStreak = userStats?.streak_current ?? 0;
    const nextStreak = userStats?.last_workout_date === yesterday ? prevStreak + 1 : 1;
    const nextBest = Math.max(userStats?.streak_best ?? 0, nextStreak);
    const reachedMilestones = new Set<number>((userStats?.streak_milestones ?? []).map(Number));
    if ([3, 7, 14].includes(nextStreak) && !reachedMilestones.has(nextStreak)) {
      reachedMilestones.add(nextStreak);
      xpBonus += 100;
    }

    const oldXp = userStats?.xp ?? 0;
    const newXp = oldXp + xpBonus;
    const nextLevel = xpToLevel(newXp);

    const { error: statsUpsertError } = await supabase.from('user_stats').upsert(
      { user_id: user.id, xp: newXp, level: nextLevel, streak_current: nextStreak, streak_best: nextBest, last_workout_date: today, streak_milestones: Array.from(reachedMilestones.values()) },
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
      await supabase.from('scheduled_workouts').update({ status: 'completed', completed_at: nowIso }).eq('id', activeScheduledWorkoutId).eq('user_id', user.id);
    }

    await supabase.from('workout_sessions').update({ duration_minutes: durationMinutes, total_volume: totalVolume, total_sets: setsCount }).eq('id', sessionId).eq('user_id', user.id);

    setWeeklyQuestProgress({ completed_sessions: updatedCompletedSessions, target_sessions: targetSessions, completed: questNowCompleted });
    setFinishingSession(false);
    setSessionId(null);
    setActiveBlueprint(null);
    setRunnerMode('done');
    setFinishCelebration({
      open: true,
      xpGained: xpBonus,
      message: encouragementPool[Math.floor(Math.random() * encouragementPool.length)]
    });
  };

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

    const createdPlanId = await savePlan(user.id, nextPlan);
    setPlan(nextPlan);
    setActivePlanId(createdPlanId);
    setSessionId(null);
    setActiveBlueprint(null);
    setRunnerMode('input');
    setRestModalOpen(false);
    setSessionLogsCount({});

    if (createdPlanId) {
      try {
        const schedule = await ensureWeekSchedule(user.id, nextPlan, createdPlanId);
        setScheduledWorkouts(schedule);
      } catch (scheduleError) {
        const msg = scheduleError instanceof Error ? scheduleError.message : 'Impossible de mettre à jour le planning.';
        setError(dbErrorMessage(msg));
      }
    }
  };

  if (loading) {
    return <section className="mx-auto max-w-3xl p-4 text-slate-200">Chargement du plan…</section>;
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 text-slate-100">
      <header className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Plan de séance</h1>
            <p className="text-sm text-slate-300">Objectif: {plan?.title ?? 'Plan actif'}</p>
          </div>
          <Link className="rounded-lg border border-slate-700 px-3 py-1 text-xs" href="/">Accueil</Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-800 px-2 py-1">Exos: {workoutItems.length}</span>
          <span className="rounded-full bg-slate-800 px-2 py-1">Quête: {weeklyQuestProgress?.completed_sessions ?? 0}/{weeklyQuestProgress?.target_sessions ?? 3}</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button className="rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold disabled:opacity-60" disabled={!activePlanId || !!sessionId || startingSession} onClick={handleStartSession} type="button">
            {startingSession ? 'Démarrage...' : 'Démarrer'}
          </button>
          <button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold disabled:opacity-60" disabled={!sessionId || !allExercisesCompleted || finishingSession} onClick={handleFinishWorkout} type="button">
            {finishingSession ? 'Finalisation...' : 'Terminer'}
          </button>
          <button className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold disabled:opacity-60" disabled={saving || startingSession} onClick={handleRegenerate} type="button">
            {saving ? '...' : 'Regénérer'}
          </button>
        </div>
      </header>

      {error ? <p className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p> : null}
      {warning ? <p className="rounded-lg border border-amber-500/40 bg-amber-950/40 p-3 text-sm text-amber-200">{warning}</p> : null}

      {!plan ? (
        <p className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 text-sm">Aucun plan trouvé. Vérifie les tables workout_plans/workout_sessions puis réessaie.</p>
      ) : (
        <>
          <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-lg font-semibold">Résumé de la séance</h2>
            <div className="mt-3 space-y-2">
              {workoutItems.map((item, index) => {
                const completed = (sessionLogsCount[item.exercise_key] ?? 0) >= item.sets_target;
                const focused = index === focusedExerciseIndex;
                return (
                  <button
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${focused ? 'border-violet-400 bg-violet-900/20' : 'border-slate-700 bg-slate-950/60'}`}
                    key={`${item.exercise_key}-${index}`}
                    onClick={() => {
                      setFocusedExerciseIndex(index);
                      setRunnerMode(completed ? 'done' : 'input');
                    }}
                    type="button"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.displayName} — {item.sets_target} x {item.target_reps_min}-{item.target_reps_max}</p>
                      <div className="mt-1 flex gap-2 text-[11px]">
                        {item.classType === 'poly' ? <span className="rounded-full bg-blue-900/40 px-2 py-0.5 text-blue-200">poly</span> : null}
                        {item.classType === 'iso' ? <span className="rounded-full bg-pink-900/40 px-2 py-0.5 text-pink-200">iso</span> : null}
                      </div>
                    </div>
                    <span>{completed ? '✅' : focused ? '▶️' : '⏳'}</span>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-lg font-semibold">Exercice en focus</h2>
            {!sessionId ? (
              <p className="mt-2 text-sm text-slate-300">Démarre la séance pour saisir les séries.</p>
            ) : focusedExercise ? (
              runnerMode === 'done' && allExercisesCompleted ? (
                <p className="mt-3 rounded-lg bg-emerald-900/30 p-3 text-sm text-emerald-200">Toutes les séries sont validées. Clique sur “Terminer” pour clore la séance.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  <h3 className="text-xl font-semibold">{focusedExercise.displayName}</h3>
                  <p className="text-sm text-slate-300">Série: {Math.min(currentSetNumber, focusedExercise.sets_target)}/{focusedExercise.sets_target} · Reps cible: {focusedExercise.target_reps_min}-{focusedExercise.target_reps_max}</p>
                  {focusedExercise.note ? <p className="text-xs text-cyan-200">{focusedExercise.note}</p> : null}
                  {focusedExercise.recommended_weight !== null ? <p className="text-xs text-slate-400">Recommandation: {focusedExercise.recommended_weight} kg</p> : null}
                  <div className="grid gap-2">
                    {focusedExercise.equipment_type !== 'bodyweight' ? (
                      <input
                        className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                        placeholder="Poids (kg)"
                        type="number"
                        value={setInputs[focusedExercise.exercise_key]?.weightKg ?? ''}
                        onChange={(event) => setSetInputs((prev) => ({ ...prev, [focusedExercise.exercise_key]: { ...(prev[focusedExercise.exercise_key] ?? { weightKg: '', reps: '', rpe: '' }), weightKg: event.target.value } }))}
                      />
                    ) : null}
                    <input
                      className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                      placeholder="Reps"
                      type="number"
                      value={setInputs[focusedExercise.exercise_key]?.reps ?? ''}
                      onChange={(event) => setSetInputs((prev) => ({ ...prev, [focusedExercise.exercise_key]: { ...(prev[focusedExercise.exercise_key] ?? { weightKg: '', reps: '', rpe: '' }), reps: event.target.value } }))}
                    />
                    <input
                      className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                      placeholder="RPE (optionnel)"
                      type="number"
                      step="0.5"
                      value={setInputs[focusedExercise.exercise_key]?.rpe ?? ''}
                      onChange={(event) => setSetInputs((prev) => ({ ...prev, [focusedExercise.exercise_key]: { ...(prev[focusedExercise.exercise_key] ?? { weightKg: '', reps: '', rpe: '' }), rpe: event.target.value } }))}
                    />
                  </div>
                  <button className="w-full rounded-lg bg-violet-700 px-4 py-3 text-sm font-semibold disabled:opacity-60" disabled={savingSet || runnerMode !== 'input' || (sessionLogsCount[focusedExercise.exercise_key] ?? 0) >= focusedExercise.sets_target} onClick={handleValidateSet} type="button">
                    {savingSet ? 'Validation...' : `Valider série ${Math.min(currentSetNumber, focusedExercise.sets_target)}`}
                  </button>
                </div>
              )
            ) : (
              <p className="mt-2 text-sm text-slate-300">Aucun exercice disponible.</p>
            )}
          </article>
        </>
      )}


      <RestModal
        open={restModalOpen}
        exerciseName={restModalMeta.exerciseName}
        validatedSetLabel={`Série ${restModalMeta.setNumber}/${restModalMeta.setsTarget} validée`}
        recommendedSeconds={restModalMeta.recommendedSeconds}
        onNext={moveToNextStep}
        onClose={moveToNextStep}
      />

      {finishCelebration.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-emerald-500/30 bg-slate-900 p-6">
            <h3 className="text-2xl font-bold text-emerald-300">GG {prefs?.hero_name ?? 'Héros'} !</h3>
            <p className="mt-2 text-slate-100">+{finishCelebration.xpGained} XP</p>
            <p className="mt-1 text-sm text-slate-300">{finishCelebration.message}</p>
            <button className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white" onClick={() => setFinishCelebration((prev) => ({ ...prev, open: false }))} type="button">Super</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
