'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getCycleWeek, isDeloadWeek, weekStart } from '@/lib/cycle/cycle';
import { t } from '@/lib/i18n';

type Profile = {
  email: string | null;
  hero_name: string | null;
  hero_class: string | null;
  level: number | null;
};

type UserStats = {
  xp: number;
  level: number;
  streak_current: number;
  streak_best: number;
};

type WeeklyQuestRow = {
  completed_sessions: number;
  target_sessions: number;
  completed: boolean;
};

type WorkoutSessionSummary = {
  started_at: string;
  ended_at: string | null;
};

type NextWorkoutRow = {
  workout_date: string;
};

type ProgramSession = {
  dayIndex: number;
};

type ProgramWeek = {
  week: number;
  sessions: ProgramSession[];
};

type ProgramJson = {
  sessionsPerWeek?: number;
  weekPlans?: ProgramWeek[];
};

type MainPlan = {
  id: string;
  title: string;
  goal: string;
  level: string;
  weeks: number;
  plan_json: ProgramJson;
};

type MainPlanState = {
  active_plan_id: string | null;
};

const dbErrorMessage = (message: string) => {
  if (message.includes('does not exist')) {
    return 'La base de données n’est pas à jour. Applique le schema SQL puis réessaie.';
  }

  return message;
};

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mainPlan, setMainPlan] = useState<MainPlan | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [lastSession, setLastSession] = useState<WorkoutSessionSummary | null>(null);
  const [weeklyQuest, setWeeklyQuest] = useState<WeeklyQuestRow | null>(null);
  const [cycleWeek, setCycleWeek] = useState(1);
  const [nextWorkoutDate, setNextWorkoutDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startingSession, setStartingSession] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/auth');
        return;
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('hero_name, hero_class, level, email')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        setError(dbErrorMessage(profileError.message));
        return;
      }

      const { data: stateData, error: stateError } = await supabase
        .from('user_program_state')
        .select('active_plan_id')
        .eq('user_id', user.id)
        .maybeSingle<MainPlanState>();

      if (stateError) {
        setError(dbErrorMessage(stateError.message));
        return;
      }

      let mainPlanData: MainPlan | null = null;
      if (stateData?.active_plan_id) {
        const { data: trainingPlan, error: trainingPlanError } = await supabase
          .from('training_plans')
          .select('id, title, goal, level, weeks, plan_json')
          .eq('id', stateData.active_plan_id)
          .eq('user_id', user.id)
          .maybeSingle<MainPlan>();

        if (trainingPlanError) {
          setError(dbErrorMessage(trainingPlanError.message));
          return;
        }

        mainPlanData = trainingPlan ?? null;
      }

      const { data: statsData, error: statsError } = await supabase
        .from('user_stats')
        .select('xp, level, streak_current, streak_best')
        .eq('user_id', user.id)
        .maybeSingle<UserStats>();

      if (statsError) {
        setError(dbErrorMessage(statsError.message));
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase
        .from('workout_sessions')
        .select('started_at, ended_at')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle<WorkoutSessionSummary>();

      if (sessionError) {
        setError(dbErrorMessage(sessionError.message));
        return;
      }

      const currentWeekStart = weekStart(new Date()).toISOString().slice(0, 10);
      const { data: questData, error: questError } = await supabase
        .from('weekly_quests')
        .select('completed_sessions, target_sessions, completed')
        .eq('user_id', user.id)
        .eq('week_start', currentWeekStart)
        .maybeSingle<WeeklyQuestRow>();

      if (questError) {
        setError(dbErrorMessage(questError.message));
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const { data: nextWorkout, error: nextWorkoutError } = await supabase
        .from('scheduled_workouts')
        .select('workout_date')
        .eq('user_id', user.id)
        .eq('status', 'planned')
        .gte('workout_date', today)
        .order('workout_date', { ascending: true })
        .limit(1)
        .maybeSingle<NextWorkoutRow>();

      if (nextWorkoutError) {
        setError(dbErrorMessage(nextWorkoutError.message));
        return;
      }

      setMainPlan(mainPlanData);
      setStats(statsData ?? { xp: 0, level: 1, streak_current: 0, streak_best: 0 });
      setLastSession(sessionData ?? null);
      setWeeklyQuest(questData ?? { completed_sessions: 0, target_sessions: 3, completed: false });
      setCycleWeek(getCycleWeek(new Date(), new Date()));
      setNextWorkoutDate(nextWorkout?.workout_date ?? null);
      setProfile({
        email: data?.email ?? user.email ?? null,
        hero_name: data?.hero_name ?? null,
        hero_class: data?.hero_class ?? null,
        level: data?.level ?? 1
      });
    };

    loadProfile();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  const handleStartMainPlanSession = async () => {
    if (!mainPlan || startingSession) return;
    setStartingSession(true);
    setError(null);

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setStartingSession(false);
      router.push('/auth');
      return;
    }

    const firstWeek = mainPlan.plan_json.weekPlans?.[0];
    const firstDay = firstWeek?.sessions?.[0]?.dayIndex ?? 1;

    try {
      const response = await fetch('/api/workout/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          planId: mainPlan.id,
          week: firstWeek?.week ?? 1,
          dayIndex: firstDay
        })
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string; sessionId?: string };
      if (!response.ok || !payload.ok || !payload.sessionId) {
        throw new Error(payload.error ?? 'Impossible de démarrer la séance.');
      }

      router.push(`/workout/session/${payload.sessionId}`);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Impossible de démarrer la séance.');
    } finally {
      setStartingSession(false);
    }
  };

  const daysPerWeek = mainPlan?.plan_json.sessionsPerWeek ?? mainPlan?.plan_json.weekPlans?.[0]?.sessions.length ?? null;
  const fr = t('fr');

  return (
    <section className="space-y-5">
      <h2 className="text-3xl font-semibold">Bienvenue</h2>

      {error ? <p className="rounded-md border border-red-500/30 bg-red-900/20 p-2 text-sm text-red-200">{error}</p> : null}

      <p className="text-slate-300">Email: {profile?.email ?? 'inconnu'}</p>

      <div className="max-w-md rounded-xl border border-violet-500/30 bg-slate-900/80 p-5">
        <h3 className="mb-3 text-xl font-semibold text-violet-200">Carte du héros</h3>
        <p className="text-slate-300">Nom: {profile?.hero_name ?? 'Non défini'}</p>
        <p className="text-slate-300">Classe: {profile?.hero_class ?? 'Non définie'}</p>
        <p className="text-slate-300">Niveau: {profile?.level ?? 1}</p>
      </div>

      <div className="max-w-md rounded-xl border border-amber-500/30 bg-slate-900/80 p-5">
        <h3 className="mb-3 text-xl font-semibold text-amber-200">Progression RPG</h3>
        <p className="text-slate-300">XP: {stats?.xp ?? 0}</p>
        <p className="text-slate-300">Niveau: {stats?.level ?? 1}</p>
        <p className="text-slate-300">Streak actuel: {stats?.streak_current ?? 0}</p>
        <p className="text-slate-300">Meilleure streak: {stats?.streak_best ?? 0}</p>
        <p className="mt-2 text-xs text-slate-400">Gagne +10 XP par série sauvegardée depuis l’écran plan.</p>
      </div>

      <div className="max-w-md rounded-xl border border-teal-500/30 bg-slate-900/80 p-5">
        <h3 className="mb-3 text-xl font-semibold text-teal-200">Prochaine séance</h3>
        <p className="text-slate-300">{nextWorkoutDate ? new Date(`${nextWorkoutDate}T00:00:00`).toLocaleDateString() : 'Aucune séance planifiée.'}</p>
      </div>

      <div className="max-w-md rounded-xl border border-cyan-500/30 bg-slate-900/80 p-5">
        <h3 className="mb-3 text-xl font-semibold text-cyan-200">Dernière session</h3>
        {lastSession ? (
          <>
            <p className="text-slate-300">Début: {new Date(lastSession.started_at).toLocaleString()}</p>
            <p className="text-slate-300">Fin: {lastSession.ended_at ? new Date(lastSession.ended_at).toLocaleString() : 'En cours'}</p>
          </>
        ) : (
          <p className="text-slate-300">Aucune session enregistrée.</p>
        )}
      </div>

      <div className="max-w-md rounded-xl border border-indigo-500/30 bg-slate-900/80 p-5">
        <h3 className="mb-3 text-xl font-semibold text-indigo-200">Mésocycle</h3>
        <p className="text-slate-300">Semaine en cours: S{cycleWeek}</p>
        <p className="text-slate-300">Statut: {isDeloadWeek(cycleWeek) ? 'Allégement' : 'Progression'}</p>
      </div>

      <div className="max-w-md rounded-xl border border-fuchsia-500/30 bg-slate-900/80 p-5">
        <h3 className="mb-3 text-xl font-semibold text-fuchsia-200">Quête hebdomadaire</h3>
        <p className="text-slate-300">Progression: {weeklyQuest?.completed_sessions ?? 0}/{weeklyQuest?.target_sessions ?? 3} séances</p>
        <p className="text-slate-300">{weeklyQuest?.completed ? '✅ Quête terminée (+200 XP)' : 'En cours'}</p>
      </div>

      <div className="max-w-md rounded-xl border border-emerald-500/30 bg-slate-900/80 p-5">
        <h3 className="mb-3 text-xl font-semibold text-emerald-200">Plan principal</h3>
        {mainPlan ? (
          <>
            <p className="text-slate-300">Titre: {mainPlan.title}</p>
            <p className="text-slate-300">Objectif: {fr.goalLabels[mainPlan.goal] ?? mainPlan.goal}</p>
            <p className="text-slate-300">Niveau: {fr.levelLabels[mainPlan.level] ?? mainPlan.level}</p>
            <p className="text-slate-300">Jours/semaine: {daysPerWeek ?? 'N/D'}</p>
          </>
        ) : (
          <p className="text-slate-300">Aucun plan principal.</p>
        )}

        {mainPlan ? (
          <>
            <Link className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500" href={`/program/${mainPlan.id}`}>
              Voir mon plan
            </Link>
            <button
              className="mt-2 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
              disabled={startingSession}
              onClick={handleStartMainPlanSession}
              type="button"
            >
              {startingSession ? 'Démarrage...' : 'Démarrer une séance'}
            </button>
          </>
        ) : (
          <Link className="mt-4 inline-flex rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-600" href="/program/new">
            Créer mon programme
          </Link>
        )}
      </div>

      {!profile?.hero_name ? (
        <Link
          className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
          href="/onboarding"
        >
          Créer mon héros
        </Link>
      ) : null}

      <button
        className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm transition hover:bg-slate-800"
        onClick={handleLogout}
        type="button"
      >
        Se déconnecter
      </button>
    </section>
  );
}
