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

type ExerciseFormState = {
  weightKg: string;
  reps: string;
  rpe: string;
  restSeconds: number | null;
  setIndex: number;
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

const defaultPrefs: ProfilePrefs = {
  hero_class: 'Warrior',
  training_level: 'beginner',
  goal: 'muscle',
  location: 'gym',
  days_per_week: 3,
  equipment: []
};

const dbErrorMessage = (message: string) => {
  if (message.includes('does not exist')) {
    return 'La base de données n’est pas à jour. Applique le schema SQL puis réessaie.';
  }

  return message;
};

const parseRepRange = (reps: string): { min: number; max: number } | null => {
  const numbers = reps.match(/\d+/g);
  if (!numbers || numbers.length === 0) {
    return null;
  }

  if (numbers.length === 1) {
    const value = Number(numbers[0]);
    return { min: value, max: value };
  }

  return { min: Number(numbers[0]), max: Number(numbers[1]) };
};

const makeExerciseKey = (dayIndex: number, exerciseIndex: number): string => `${dayIndex}-${exerciseIndex}`;

const weightedEquipment = new Set<EquipmentType>(['barbell', 'dumbbell', 'machine']);

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
  const [savingSetKey, setSavingSetKey] = useState<string | null>(null);
  const [exerciseForms, setExerciseForms] = useState<Record<string, ExerciseFormState>>({});
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation>>({});
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [activeCycleWeek, setActiveCycleWeek] = useState(1);
  const [cycleStartDate, setCycleStartDate] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [activeBlueprint, setActiveBlueprint] = useState<SessionBlueprint | null>(null);
  const [weeklyQuestProgress, setWeeklyQuestProgress] = useState<WeeklyQuestRow | null>(null);

  const savePlan = async (userId: string, nextPlan: GeneratedPlan) => {
    setSaving(true);
    setError(null);

    const { error: deactivateError } = await supabase
      .from('workout_plans')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (deactivateError) {
      setSaving(false);
      setError(dbErrorMessage(deactivateError.message));
      return;
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
      return;
    }

    setActivePlanId(data.id);
  };

  useEffect(() => {
    const loadPlan = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

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
        await savePlan(user.id, generated);
      }

      const recommendationMap: Record<string, Recommendation> = {};

      for (const [dayIndex, dayPlan] of nextPlan.days.entries()) {
        for (const [exerciseIndex, exercise] of dayPlan.exercises.entries()) {
          const key = makeExerciseKey(dayIndex, exerciseIndex);

          const { data: keyLogs, error: keyLogsError } = await supabase
            .from('exercise_logs')
            .select('session_id, weight_kg, reps, rpe, created_at, exercise_key')
            .eq('user_id', user.id)
            .eq('exercise_key', exercise.exercise_key)
            .order('created_at', { ascending: false })
            .limit(30)
            .returns<ExerciseLogRow[]>();

          if (keyLogsError) {
            setError(dbErrorMessage(keyLogsError.message));
            continue;
          }

          let logs = keyLogs ?? [];
          if (!logs.length) {
            const { data: nameLogs, error: nameLogsError } = await supabase
              .from('exercise_logs')
              .select('session_id, weight_kg, reps, rpe, created_at, exercise_key')
              .eq('user_id', user.id)
              .eq('exercise_name', exercise.exercise_name)
              .order('created_at', { ascending: false })
              .limit(30)
              .returns<ExerciseLogRow[]>();

            if (nameLogsError) {
              setError(dbErrorMessage(nameLogsError.message));
              continue;
            }

            logs = nameLogs ?? [];
          }

          const lastPerformance = getLastPerformance(logs, exercise.target_reps_min, exercise.target_reps_max);
          recommendationMap[key] = recommendWeight({
            goal: nextPrefs.goal,
            targetRepsRange: { min: exercise.target_reps_min, max: exercise.target_reps_max },
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
      setLoading(false);
    };

    loadPlan();
  }, [router]);

  const handleRegenerate = async () => {
    if (!prefs) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();

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
    setCycleStartDate(new Date().toISOString().slice(0, 10));
    setActiveCycleWeek(1);
    await savePlan(user.id, nextPlan);
  };

  const handleAdvanceWeek = async () => {
    if (!activePlanId || !cycleStartDate) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) return;

    const start = new Date(`${cycleStartDate}T00:00:00`);
    start.setDate(start.getDate() - 7);
    const nextStart = start.toISOString().slice(0, 10);
    const nextWeek = getCycleWeek(nextStart, new Date());

    const { error: updateError } = await supabase
      .from('workout_plans')
      .update({ cycle_start_date: nextStart, cycle_week: nextWeek })
      .eq('id', activePlanId)
      .eq('user_id', user.id);

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

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace('/auth');
      return;
    }

    const currentCycleWeek = getCycleWeek(cycleStartDate ?? new Date(), new Date());
    setActiveCycleWeek(currentCycleWeek);

    const dayPlan = plan.days[selectedDayIndex];
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
      cycleWeek: currentCycleWeek,
      logsByExercise
    });

    const { data, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        plan_id: activePlanId,
        started_at: new Date().toISOString(),
        location: prefs.location,
        blueprint
      })
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
  };

  const handleFinishWorkout = async () => {
    if (!sessionId) return;

    setFinishingSession(true);
    setError(null);

    const {
      data: { user }
    } = await supabase.auth.getUser();

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

    const { data: logs, error: logsError } = await supabase
      .from('exercise_logs')
      .select('weight_kg, reps')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .returns<Array<{ weight_kg: number | null; reps: number }>>();

    if (logsError) {
      setFinishingSession(false);
      setError(dbErrorMessage(logsError.message));
      return;
    }

    const setsCount = logs?.length ?? 0;
    const totalVolume = (logs ?? []).reduce((sum, set) => sum + (set.weight_kg ? set.weight_kg * set.reps : 0), 0);
    const durationMinutes = Math.max(
      1,
      Math.round(
        (new Date(updatedSession.ended_at ?? nowIso).getTime() - new Date(updatedSession.started_at).getTime()) /
          (1000 * 60)
      )
    );

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
    const shouldGrantQuestXp = questNowCompleted && !(existingQuest?.completed ?? false);

    if (shouldGrantQuestXp) {
      xpBonus += 200;
    }

    const { data: userStats } = await supabase.from('user_stats').select('xp').eq('user_id', user.id).maybeSingle<{ xp: number }>();
    const nextXp = (userStats?.xp ?? 0) + xpBonus;
    const nextLevel = xpToLevel(nextXp);

    const { error: statsUpsertError } = await supabase
      .from('user_stats')
      .upsert({ user_id: user.id, xp: nextXp, level: nextLevel }, { onConflict: 'user_id' });

    if (statsUpsertError) {
      setFinishingSession(false);
      setError(dbErrorMessage(statsUpsertError.message));
      return;
    }

    const { error: questError } = await supabase.from('weekly_quests').upsert(
      {
        user_id: user.id,
        week_start: currentWeekStart,
        target_sessions: targetSessions,
        completed_sessions: updatedCompletedSessions,
        completed: questNowCompleted
      },
      { onConflict: 'user_id,week_start' }
    );

    if (questError) {
      setFinishingSession(false);
      setError(dbErrorMessage(questError.message));
      return;
    }

    setWeeklyQuestProgress({
      completed_sessions: updatedCompletedSessions,
      target_sessions: targetSessions,
      completed: questNowCompleted
    });
    setSessionSummary({ durationMinutes, setsCount, totalVolume, xpBonus });
    setActiveBlueprint(null);
    setSessionId(null);
    setFinishingSession(false);
  };

  const setExerciseForm = (key: string, updater: (prev: ExerciseFormState) => ExerciseFormState) => {
    setExerciseForms((current) => {
      const prev = current[key] ?? { weightKg: '', reps: '', rpe: '', restSeconds: null, setIndex: 1 };
      return { ...current, [key]: updater(prev) };
    });
  };

  const handleSaveSet = async (dayIndex: number, exerciseIndex: number) => {
    if (!sessionId || !plan || !prefs || !activePlanId) {
      setError('Démarre une session avant de sauvegarder des séries.');
      return;
    }

    const sourceExercises = activeBlueprint?.exercises ?? plan.days[dayIndex]?.exercises;
    const exercise = sourceExercises?.[exerciseIndex];
    if (!exercise) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace('/auth');
      return;
    }

    const key = makeExerciseKey(dayIndex, exerciseIndex);
    const form = exerciseForms[key] ?? { weightKg: '', reps: '', rpe: '', restSeconds: null, setIndex: 1 };

    const repsValue = Number(form.reps);
    if (!Number.isFinite(repsValue) || repsValue <= 0) {
      setError('Entre un nombre de reps valide avant de sauvegarder.');
      return;
    }

    if (weightedEquipment.has(exercise.equipment_type) && !form.weightKg) {
      const shouldContinue = window.confirm('Ce mouvement requiert une charge. Continuer sans renseigner le poids ?');
      if (!shouldContinue) return;
    }

    if (repsValue < exercise.target_reps_min || repsValue > exercise.target_reps_max) {
      setWarning(`⚠️ ${exercise.exercise_name}: ${repsValue} reps hors plage cible (${exercise.target_reps_min}-${exercise.target_reps_max}).`);
    } else {
      setWarning(null);
    }

    setSavingSetKey(key);
    setError(null);

    const { error: insertError } = await supabase.from('exercise_logs').insert({
      user_id: user.id,
      session_id: sessionId,
      plan_id: activePlanId,
      day_index: dayIndex,
      exercise_index: exerciseIndex,
      exercise_key: exercise.exercise_key,
      exercise_name: exercise.exercise_name,
      equipment_type: exercise.equipment_type,
      set_index: form.setIndex,
      target_reps_min: exercise.target_reps_min,
      target_reps_max: exercise.target_reps_max,
      weight_kg: form.weightKg ? Number(form.weightKg) : null,
      reps: repsValue,
      rpe: form.rpe ? Number(form.rpe) : null,
      rest_seconds: form.restSeconds
    });

    if (insertError) {
      setSavingSetKey(null);
      setError(dbErrorMessage(insertError.message));
      return;
    }

    const { data: userStats, error: statFetchError } = await supabase.from('user_stats').select('xp').eq('user_id', user.id).maybeSingle<{ xp: number }>();

    if (statFetchError) {
      setSavingSetKey(null);
      setError(dbErrorMessage(statFetchError.message));
      return;
    }

    const nextXp = (userStats?.xp ?? 0) + 10;
    const nextLevel = xpToLevel(nextXp);

    const { error: upsertError } = await supabase.from('user_stats').upsert({ user_id: user.id, xp: nextXp, level: nextLevel }, { onConflict: 'user_id' });

    if (upsertError) {
      setSavingSetKey(null);
      setError(dbErrorMessage(upsertError.message));
      return;
    }

    setExerciseForm(key, (prev) => ({ ...prev, reps: '', rpe: '', setIndex: prev.setIndex + 1 }));
    setSavingSetKey(null);
  };

  const planDescription = useMemo(() => {
    if (!sessionId) return 'Démarre une session pour enregistrer les séries.';
    return `Session en cours (${sessionId.slice(0, 8)}...)`;
  }, [sessionId]);

  const cycleLabel = `S${activeCycleWeek}`;

  if (loading) return <p className="text-slate-300">Chargement du plan...</p>;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold">Programme recommandé</h2>
          <p className="text-slate-300">Ton plan hebdomadaire personnalisé selon tes préférences.</p>
          <p className="text-xs text-slate-400">{planDescription}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-violet-400/30 bg-violet-900/30 px-2 py-1 text-violet-100">Cycle {cycleLabel}</span>
            {isDeloadWeek(activeCycleWeek) ? <span className="rounded-full border border-amber-400/30 bg-amber-900/30 px-2 py-1 text-amber-100">Deload</span> : null}
            {weeklyQuestProgress ? <span className="rounded-full border border-cyan-400/30 bg-cyan-900/30 px-2 py-1 text-cyan-100">Quête: {weeklyQuestProgress.completed_sessions}/{weeklyQuestProgress.target_sessions}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60" disabled={startingSession || !activePlanId || Boolean(sessionId)} onClick={handleStartSession} type="button">
            {sessionId ? 'Session started' : startingSession ? 'Starting...' : 'Start session'}
          </button>
          <button className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:opacity-60" disabled={!sessionId || finishingSession} onClick={handleFinishWorkout} type="button">
            {finishingSession ? 'Finishing...' : 'Finish workout'}
          </button>
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60" disabled={saving} onClick={handleRegenerate} type="button">
            {saving ? 'Génération...' : 'Regenerate plan'}
          </button>
          {process.env.NODE_ENV !== 'production' ? (
            <button className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600" onClick={handleAdvanceWeek} type="button">
              Advance week
            </button>
          ) : null}
          <Link className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm transition hover:bg-slate-800" href="/dashboard">
            Back to dashboard
          </Link>
        </div>
      </div>

      {error ? <p className="rounded-md border border-red-500/30 bg-red-900/20 p-2 text-sm text-red-200">{error}</p> : null}
      {warning ? <p className="rounded-md border border-amber-500/30 bg-amber-900/20 p-2 text-sm text-amber-200">{warning}</p> : null}
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
        <div className="space-y-4">
          <div className="rounded-xl border border-violet-500/30 bg-slate-900/80 p-5">
            <h3 className="text-xl font-semibold text-violet-200">{plan.title}</h3>
            <p className="mt-2 text-slate-300">Split: {plan.split}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <label className="text-sm text-slate-300" htmlFor="day-selector">Jour de session</label>
            <select className="ml-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm" id="day-selector" onChange={(event) => setSelectedDayIndex(Number(event.target.value))} value={selectedDayIndex}>
              {plan.days.map((dayPlan, dayIndex) => (
                <option key={dayPlan.day} value={dayIndex}>
                  {dayPlan.day} - {dayPlan.focus}
                </option>
              ))}
            </select>
          </div>

          {plan.days.map((dayPlan, dayIndex) => (
            <article className={`rounded-xl border border-slate-800 bg-slate-900/60 p-5 ${dayIndex === selectedDayIndex ? '' : 'opacity-60'}`} key={dayPlan.day + dayPlan.focus}>
              <h4 className="text-lg font-semibold">{dayPlan.day} - {dayPlan.focus}</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                {dayPlan.exercises.map((exercise, exerciseIndex) => {
                  const key = makeExerciseKey(dayIndex, exerciseIndex);
                  const form = exerciseForms[key] ?? { weightKg: '', reps: '', rpe: '', restSeconds: null, setIndex: 1 };
                  const blueprintExercise = dayIndex === selectedDayIndex ? activeBlueprint?.exercises[exerciseIndex] : undefined;
                  const recommendation = recommendations[key];

                  return (
                    <li className="rounded-md border border-slate-800 bg-slate-950/50 p-3" key={`${dayPlan.day}-${exercise.exercise_key}-${exerciseIndex}`}>
                      <p className="font-medium">{exercise.exercise_name}</p>
                      <p className="text-slate-400">{blueprintExercise?.sets ?? exercise.sets} x {exercise.reps}</p>
                      <p className="text-xs text-slate-500">equipment: {exercise.equipment_type} · key: {exercise.exercise_key}</p>
                      <p className="text-xs text-emerald-300">Recommended reps: {blueprintExercise?.recommended_reps ?? recommendation?.recommendedReps ?? `${exercise.target_reps_min}-${exercise.target_reps_max}`}</p>
                      <p className="text-xs text-emerald-300">Recommended weight: {(blueprintExercise?.recommended_weight ?? recommendation?.recommendedWeight) === null || (blueprintExercise?.recommended_weight ?? recommendation?.recommendedWeight) === undefined ? 'N/A' : `${blueprintExercise?.recommended_weight ?? recommendation?.recommendedWeight} kg`}</p>
                      {(blueprintExercise?.progression_note ?? recommendation?.progressionNote) ? <p className="text-xs text-cyan-200">{blueprintExercise?.progression_note ?? recommendation?.progressionNote}</p> : null}
                      {exercise.notes ? <p className="text-xs text-slate-400">{exercise.notes}</p> : null}

                      <div className="mt-3 grid gap-2 md:grid-cols-4">
                        <input className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm" onChange={(event) => setExerciseForm(key, (prev) => ({ ...prev, weightKg: event.target.value }))} placeholder="Poids (kg)" type="number" value={form.weightKg} />
                        <input className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm" onChange={(event) => setExerciseForm(key, (prev) => ({ ...prev, reps: event.target.value }))} placeholder="Reps" type="number" value={form.reps} />
                        <input className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm" onChange={(event) => setExerciseForm(key, (prev) => ({ ...prev, rpe: event.target.value }))} placeholder="RPE (optionnel)" step="0.5" type="number" value={form.rpe} />
                        <input className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm" placeholder="Rest (sec)" readOnly value={form.restSeconds ?? ''} />
                      </div>

                      <p className="mt-2 text-xs text-slate-400">Set #{form.setIndex}</p>
                      <RestTimer onUseRest={(seconds) => setExerciseForm(key, (prev) => ({ ...prev, restSeconds: seconds }))} />

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button className="rounded-md bg-slate-700 px-3 py-1 text-xs text-white" onClick={() => setExerciseForm(key, (prev) => ({ ...prev, setIndex: prev.setIndex + 1 }))} type="button">Add set</button>
                        <button className="rounded-md bg-violet-700 px-3 py-1 text-xs text-white disabled:opacity-60" disabled={!sessionId || savingSetKey === key} onClick={() => handleSaveSet(dayIndex, exerciseIndex)} type="button">
                          {savingSetKey === key ? 'Saving...' : 'Save set'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
