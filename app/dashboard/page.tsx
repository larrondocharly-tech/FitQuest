'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/auth');
        return;
      }

      setEmail(user.email ?? 'inconnu');
    };

    loadUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  return (
    <section className="space-y-5">
      <h2 className="text-3xl font-semibold">Bienvenue</h2>
      <p className="text-slate-300">Connecté en tant que: {email}</p>
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
