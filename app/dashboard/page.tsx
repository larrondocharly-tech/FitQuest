'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import BottomNav from '@/components/ui/BottomNav';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';

type Profile = {
  email: string | null;
  hero_name: string | null;
};

type UserStats = {
  xp: number;
  streak_current: number;
};

type MainPlanState = {
  active_plan_id: string | null;
};

type MainPlan = {
  id: string;
  title: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [mainPlan, setMainPlan] = useState<MainPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/auth');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('hero_name, email')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        return;
      }

      const { data: statsData } = await supabase
        .from('user_stats')
        .select('xp, streak_current')
        .eq('user_id', user.id)
        .maybeSingle<UserStats>();

      const { data: stateData } = await supabase
        .from('user_program_state')
        .select('active_plan_id')
        .eq('user_id', user.id)
        .maybeSingle<MainPlanState>();

      let activePlan: MainPlan | null = null;
      if (stateData?.active_plan_id) {
        const { data: planData } = await supabase
          .from('training_plans')
          .select('id, title')
          .eq('id', stateData.active_plan_id)
          .eq('user_id', user.id)
          .maybeSingle<MainPlan>();
        activePlan = planData ?? null;
      }

      setMainPlan(activePlan);
      setProfile({ email: profileData?.email ?? user.email ?? null, hero_name: profileData?.hero_name ?? null });
      setStats(statsData ?? { xp: 0, streak_current: 0 });
    };

    loadDashboard();
  }, [router]);

  return (
    <section className="space-y-4">
      <Card title={`Salut ${profile?.hero_name ?? 'toi'} 👋`} subtitle="Scanner en 3 étapes: montant, donation, validation.">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-800/70 p-3">
            <p className="text-slate-400">Cashback total</p>
            <p className="text-lg font-semibold text-violet-200">{stats?.xp ?? 0} €</p>
          </div>
          <div className="rounded-xl bg-slate-800/70 p-3">
            <p className="text-slate-400">Série active</p>
            <p className="text-lg font-semibold text-violet-200">{stats?.streak_current ?? 0}</p>
          </div>
        </div>
        <Link href="/scan" className="mt-4 block">
          <Button fullWidth type="button">
            Scanner maintenant
          </Button>
        </Link>
      </Card>

      {mainPlan ? (
        <Card title="Programme actif" subtitle={mainPlan.title}>
          <Link className="text-sm font-semibold text-violet-300 hover:text-violet-200" href={`/program/${mainPlan.id}`}>
            Ouvrir le programme
          </Link>
        </Card>
      ) : (
        <EmptyState
          title="Aucun programme actif"
          description="Crée un programme si tu veux suivre un plan sport en parallèle de PawPass."
          ctaHref="/program/new"
          ctaLabel="Créer un programme"
        />
      )}

      {error ? <p className="rounded-xl border border-red-700 bg-red-900/20 p-3 text-sm text-red-200">{error}</p> : null}
      <BottomNav />
    </section>
  );
}
