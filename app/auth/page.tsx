'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Tab = 'login' | 'signup';

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const action =
      tab === 'login'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { error: authError } = await action;

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <section className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-violet-500/30 bg-quest-card/90 p-6 shadow-2xl shadow-violet-900/20">
        <h2 className="mb-4 text-center text-2xl font-semibold text-violet-200">Bienvenue, aventurier</h2>

        <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-900 p-1">
          <button
            className={`rounded-md py-2 text-sm font-medium transition ${tab === 'login' ? 'bg-violet-600 text-white' : 'text-slate-300'}`}
            onClick={() => setTab('login')}
            type="button"
          >
            Connexion
          </button>
          <button
            className={`rounded-md py-2 text-sm font-medium transition ${tab === 'signup' ? 'bg-violet-600 text-white' : 'text-slate-300'}`}
            onClick={() => setTab('signup')}
            type="button"
          >
            Inscription
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm text-slate-300" htmlFor="email">Email</label>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none ring-violet-500 focus:ring"
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              value={email}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300" htmlFor="password">Mot de passe</label>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none ring-violet-500 focus:ring"
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </div>

          {error ? <p className="rounded-md border border-red-500/30 bg-red-900/20 p-2 text-sm text-red-200">{error}</p> : null}

          <button
            className="w-full rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Chargement...' : tab === 'login' ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>
      </div>
    </section>
  );
}
