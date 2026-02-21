'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import RestTimer from '@/components/RestTimer';
import { generatePlan, type GeneratedPlan, type Goal, type Location, type TrainingLevel, type UserPrefs } from '@/lib/plan/generatePlan';
import { getLastPerformance, recommendWeight, xpToLevel } from '@/lib/progression/recommendWeight';

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
};

type ExerciseLogRow = {
  session_id: string;
  weight_kg: number | null;
  reps: number;
  rpe: number | null;
  created_at: string;
};

type ExerciseFormState = {
  weightKg: string;
  reps: string;
  rpe: string;
  restSeconds: number | null;
  setIndex: number;
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

const inferEquipment = (exerciseName: string): 'barbell' | 'dumbbell' | 'unknown' => {
  const lower = exerciseName.toLowerCase();
  if (lower.includes('dumbbell')) {
    return 'dumbbell';
  }

  if (lower.includes('barbell') || lower.includes('ez-bar')) {
    return 'barbell';
  }

  return 'unknown';
};

const makeExerciseKey = (dayIndex: number, exerciseIndex: number): string => `${dayIndex}-${exerciseIndex}`;

export default function PlanPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<ProfilePrefs | null>(null);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [savingSetKey, setSavingSetKey] = useState<string | null>(null);
  const [exerciseForms, setExerciseForms] = useState<Record<string, ExerciseFormState>>({});
  const [recommendedWeights, setRecommendedWeights] = useState<Record<string, number | null>>({});

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
        plan: nextPlan
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
        .select('id, title, meta, plan')
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
        await savePlan(user.id, generated);
      }

      const recommendationMap: Record<string, number | null> = {};

      for (const [dayIndex, dayPlan] of nextPlan.days.entries()) {
        for (const [exerciseIndex, exercise] of dayPlan.exercises.entries()) {
          const key = makeExerciseKey(dayIndex, exerciseIndex);
          const targetRange = parseRepRange(exercise.reps);

          if (!targetRange) {
            recommendationMap[key] = null;
            continue;
          }

          const { data: logs, error: logsError } = await supabase
            .from('exercise_logs')
            .select('session_id, weight_kg, reps, rpe, created_at')
            .eq('user_id', user.id)
            .eq('exercise_name', exercise.name)
            .order('created_at', { ascending: false })
            .limit(30)
            .returns<ExerciseLogRow[]>();

          if (logsError) {
            setError(dbErrorMessage(logsError.message));
            continue;
          }

          const lastPerformance = getLastPerformance(logs ?? [], targetRange.min, targetRange.max);
          recommendationMap[key] = recommendWeight({
            goal: nextPrefs.goal,
            targetRepsRange: targetRange,
            lastWeight: lastPerformance.lastWeight,
            lastReps: lastPerformance.lastReps,
            lastRpe: lastPerformance.lastRpe,
            equipment: inferEquipment(exercise.name),
            failedBelowTargetMinTwice: lastPerformance.failedBelowTargetMinTwice,
            targetMaxHitTwiceRecently: lastPerformance.targetMaxHitTwiceRecently
          });
        }
      }

      setRecommendedWeights(recommendationMap);
      setLoading(false);
    };

    loadPlan();
  }, [router]);

  const handleRegenerate = async () => {
    if (!prefs) {
      return;
    }

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
    await savePlan(user.id, nextPlan);
  };

  const handleStartSession = async () => {
    if (!activePlanId || !prefs) {
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

    const { data, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        plan_id: activePlanId,
        started_at: new Date().toISOString(),
        location: prefs.location
      })
      .select('id')
      .single();

    setStartingSession(false);

    if (sessionError) {
      setError(dbErrorMessage(sessionError.message));
      return;
    }

    setSessionId(data.id);
  };

  const setExerciseForm = (key: string, updater: (prev: ExerciseFormState) => ExerciseFormState) => {
    setExerciseForms((current) => {
      const prev =
        current[key] ?? {
          weightKg: '',
          reps: '',
          rpe: '',
          restSeconds: null,
          setIndex: 1
        };

      return {
        ...current,
        [key]: updater(prev)
      };
    });
  };

  const handleSaveSet = async (dayIndex: number, exerciseIndex: number, exerciseName: string, repsScheme: string) => {
    if (!sessionId || !plan || !prefs || !activePlanId) {
      setError('Démarre une session avant de sauvegarder des séries.');
      return;
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace('/auth');
      return;
    }

    const key = makeExerciseKey(dayIndex, exerciseIndex);
    const form =
      exerciseForms[key] ?? {
        weightKg: '',
        reps: '',
        rpe: '',
        restSeconds: null,
        setIndex: 1
      };

    const repsValue = Number(form.reps);
    if (!Number.isFinite(repsValue) || repsValue <= 0) {
      setError('Entre un nombre de reps valide avant de sauvegarder.');
      return;
    }

    const range = parseRepRange(repsScheme);

    setSavingSetKey(key);
    setError(null);

    const { error: insertError } = await supabase.from('exercise_logs').insert({
      user_id: user.id,
      session_id: sessionId,
      plan_id: activePlanId,
      day_index: dayIndex,
      exercise_index: exerciseIndex,
      exercise_name: exerciseName,
      set_index: form.setIndex,
      target_reps_min: range?.min ?? null,
      target_reps_max: range?.max ?? null,
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

    const { data: userStats, error: statFetchError } = await supabase
      .from('user_stats')
      .select('xp')
      .eq('user_id', user.id)
      .maybeSingle<{ xp: number }>();

    if (statFetchError) {
      setSavingSetKey(null);
      setError(dbErrorMessage(statFetchError.message));
      return;
    }

    const nextXp = (userStats?.xp ?? 0) + 10;
    const nextLevel = xpToLevel(nextXp);

    const { error: upsertError } = await supabase.from('user_stats').upsert(
      {
        user_id: user.id,
        xp: nextXp,
        level: nextLevel
      },
      { onConflict: 'user_id' }
    );

    if (upsertError) {
      setSavingSetKey(null);
      setError(dbErrorMessage(upsertError.message));
      return;
    }

    setExerciseForm(key, (prev) => ({ ...prev, reps: '', rpe: '', setIndex: prev.setIndex + 1 }));
    setSavingSetKey(null);
  };

  const planDescription = useMemo(() => {
    if (!sessionId) {
      return 'Démarre une session pour enregistrer les séries.';
    }

    return `Session en cours (${sessionId.slice(0, 8)}...)`;
  }, [sessionId]);

  if (loading) {
    return <p className="text-slate-300">Chargement du plan...</p>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold">Programme recommandé</h2>
          <p className="text-slate-300">Ton plan hebdomadaire personnalisé selon tes préférences.</p>
          <p className="text-xs text-slate-400">{planDescription}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            disabled={startingSession || !activePlanId || Boolean(sessionId)}
            onClick={handleStartSession}
            type="button"
          >
            {sessionId ? 'Session started' : startingSession ? 'Starting...' : 'Start session'}
          </button>
          <button
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
            disabled={saving}
            onClick={handleRegenerate}
            type="button"
          >
            {saving ? 'Génération...' : 'Regenerate plan'}
          </button>
          <Link className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm transition hover:bg-slate-800" href="/dashboard">
            Back to dashboard
          </Link>
        </div>
      </div>

      {error ? <p className="rounded-md border border-red-500/30 bg-red-900/20 p-2 text-sm text-red-200">{error}</p> : null}

      {plan ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-violet-500/30 bg-slate-900/80 p-5">
            <h3 className="text-xl font-semibold text-violet-200">{plan.title}</h3>
            <p className="mt-2 text-slate-300">Split: {plan.split}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-700 px-3 py-1">Niveau: {plan.meta.training_level}</span>
              <span className="rounded-full border border-slate-700 px-3 py-1">Objectif: {plan.meta.goal}</span>
              <span className="rounded-full border border-slate-700 px-3 py-1">Lieu: {plan.meta.location}</span>
              <span className="rounded-full border border-slate-700 px-3 py-1">Jours: {plan.meta.days_per_week}/semaine</span>
            </div>
          </div>

          {plan.days.map((dayPlan, dayIndex) => (
            <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-5" key={dayPlan.day + dayPlan.focus}>
              <h4 className="text-lg font-semibold">
                {dayPlan.day} - {dayPlan.focus}
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                {dayPlan.exercises.map((exercise, exerciseIndex) => {
                  const key = makeExerciseKey(dayIndex, exerciseIndex);
                  const form =
                    exerciseForms[key] ?? {
                      weightKg: '',
                      reps: '',
                      rpe: '',
                      restSeconds: null,
                      setIndex: 1
                    };

                  return (
                    <li className="rounded-md border border-slate-800 bg-slate-950/50 p-3" key={`${dayPlan.day}-${exercise.name}-${exerciseIndex}`}>
                      <p className="font-medium">{exercise.name}</p>
                      <p className="text-slate-400">
                        {exercise.sets} x {exercise.reps}
                      </p>
                      <p className="text-xs text-emerald-300">
                        Recommended weight:{' '}
                        {recommendedWeights[key] === null ? 'N/A (pas assez de données)' : `${recommendedWeights[key]} kg`}
                      </p>
                      {exercise.notes ? <p className="text-xs text-slate-400">{exercise.notes}</p> : null}

                      <div className="mt-3 grid gap-2 md:grid-cols-4">
                        <input
                          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                          onChange={(event) => setExerciseForm(key, (prev) => ({ ...prev, weightKg: event.target.value }))}
                          placeholder="Poids (kg)"
                          type="number"
                          value={form.weightKg}
                        />
                        <input
                          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                          onChange={(event) => setExerciseForm(key, (prev) => ({ ...prev, reps: event.target.value }))}
                          placeholder="Reps"
                          type="number"
                          value={form.reps}
                        />
                        <input
                          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                          onChange={(event) => setExerciseForm(key, (prev) => ({ ...prev, rpe: event.target.value }))}
                          placeholder="RPE (optionnel)"
                          step="0.5"
                          type="number"
                          value={form.rpe}
                        />
                        <input
                          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                          placeholder="Rest (sec)"
                          readOnly
                          value={form.restSeconds ?? ''}
                        />
                      </div>

                      <p className="mt-2 text-xs text-slate-400">Set #{form.setIndex}</p>

                      <RestTimer onUseRest={(seconds) => setExerciseForm(key, (prev) => ({ ...prev, restSeconds: seconds }))} />

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="rounded-md bg-slate-700 px-3 py-1 text-xs text-white"
                          onClick={() => setExerciseForm(key, (prev) => ({ ...prev, setIndex: prev.setIndex + 1 }))}
                          type="button"
                        >
                          Add set
                        </button>
                        <button
                          className="rounded-md bg-violet-700 px-3 py-1 text-xs text-white disabled:opacity-60"
                          disabled={!sessionId || savingSetKey === key}
                          onClick={() => handleSaveSet(dayIndex, exerciseIndex, exercise.name, exercise.reps)}
                          type="button"
                        >
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
