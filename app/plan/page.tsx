'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { generatePlan, type GeneratedPlan, type Goal, type Location, type TrainingLevel, type UserPrefs } from '@/lib/plan/generatePlan';

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

const defaultPrefs: ProfilePrefs = {
  hero_class: 'Warrior',
  training_level: 'beginner',
  goal: 'muscle',
  location: 'gym',
  days_per_week: 3,
  equipment: []
};

export default function PlanPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<ProfilePrefs | null>(null);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      setError(deactivateError.message);
      return;
    }

    const { error: insertError } = await supabase.from('workout_plans').insert({
      user_id: userId,
      is_active: true,
      title: nextPlan.title,
      meta: nextPlan.meta,
      plan: nextPlan
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
    }
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
        setError(profileError.message);
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
        setError(activePlanError.message);
        return;
      }

      if (activePlan?.plan) {
        setPlan(activePlan.plan);
      } else {
        const generated = generatePlan({
          hero_class: nextPrefs.hero_class ?? 'Warrior',
          training_level: nextPrefs.training_level,
          goal: nextPrefs.goal,
          location: nextPrefs.location,
          days_per_week: nextPrefs.days_per_week,
          equipment: nextPrefs.equipment
        });
        setPlan(generated);
        await savePlan(user.id, generated);
      }

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
    await savePlan(user.id, nextPlan);
  };

  if (loading) {
    return <p className="text-slate-300">Chargement du plan...</p>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold">Programme recommandé</h2>
          <p className="text-slate-300">Ton plan hebdomadaire personnalisé selon tes préférences.</p>
        </div>

        <div className="flex gap-2">
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

          {plan.days.map((dayPlan) => (
            <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-5" key={dayPlan.day + dayPlan.focus}>
              <h4 className="text-lg font-semibold">{dayPlan.day} - {dayPlan.focus}</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                {dayPlan.exercises.map((exercise) => (
                  <li className="rounded-md border border-slate-800 bg-slate-950/50 p-3" key={`${dayPlan.day}-${exercise.name}`}>
                    <p className="font-medium">{exercise.name}</p>
                    <p className="text-slate-400">{exercise.sets} x {exercise.reps}</p>
                    {exercise.notes ? <p className="text-xs text-slate-400">{exercise.notes}</p> : null}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
