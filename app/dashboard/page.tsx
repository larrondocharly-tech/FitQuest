'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  email: string | null;
  hero_name: string | null;
  hero_class: string | null;
  level: number | null;
};

type PlanSummary = {
  title: string;
  plan: {
    split?: string;
    meta?: {
      days_per_week?: number;
      location?: string;
    };
  };
};

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setError(profileError.message);
        return;
      }

      const { data: planData, error: planError } = await supabase
        .from('workout_plans')
        .select('title, plan')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle<PlanSummary>();

      if (planError) {
        setError(planError.message);
        return;
      }

      setPlanSummary(planData ?? null);
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

      <div className="max-w-md rounded-xl border border-emerald-500/30 bg-slate-900/80 p-5">
        <h3 className="mb-3 text-xl font-semibold text-emerald-200">Plan recommandé</h3>
        {planSummary ? (
          <>
            <p className="text-slate-300">Titre: {planSummary.title}</p>
            <p className="text-slate-300">Split: {planSummary.plan?.split ?? 'N/A'}</p>
            <p className="text-slate-300">Jours/semaine: {planSummary.plan?.meta?.days_per_week ?? 'N/A'}</p>
            <p className="text-slate-300">Lieu: {planSummary.plan?.meta?.location ?? 'N/A'}</p>
          </>
        ) : (
          <p className="text-slate-300">Aucun plan actif pour le moment.</p>
        )}
        <Link className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500" href="/plan">
          Voir mon plan
        </Link>
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
