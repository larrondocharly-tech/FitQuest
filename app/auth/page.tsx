'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Tab = 'login' | 'signup';

type SessionTokens = {
  access_token: string;
  refresh_token: string;
};

function extractError(json: unknown): string {
  if (!json || typeof json !== 'object') {
    return 'Une erreur est survenue. Réessaie.';
  }

  const payload = json as {
    error?: { message?: string } | string;
    msg?: string;
    message?: string;
  };

  if (typeof payload.error === 'string' && payload.error) {
    return payload.error;
  }

  if (payload.error && typeof payload.error === 'object' && typeof payload.error.message === 'string') {
    return payload.error.message;
  }

  if (typeof payload.msg === 'string' && payload.msg) {
    return payload.msg;
  }

  if (typeof payload.message === 'string' && payload.message) {
    return payload.message;
  }

  return 'Une erreur est survenue. Réessaie.';
}

function extractSession(json: unknown): SessionTokens | null {
  if (!json || typeof json !== 'object') {
    return null;
  }

  const payload = json as {
    access_token?: unknown;
    refresh_token?: unknown;
    session?: {
      access_token?: unknown;
      refresh_token?: unknown;
    };
  };

  if (payload.session) {
    if (
      typeof payload.session.access_token === 'string' &&
      typeof payload.session.refresh_token === 'string' &&
      payload.session.access_token &&
      payload.session.refresh_token
    ) {
      return {
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token
      };
    }

    return null;
  }

  if (
    typeof payload.access_token === 'string' &&
    typeof payload.refresh_token === 'string' &&
    payload.access_token &&
    payload.refresh_token
  ) {
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token
    };
  }

  return null;
}

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectFromProfileState = async (userId: string) => {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('hero_name')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      setError(profileError.message);
      return;
    }

    router.push(profile?.hero_name ? '/dashboard' : '/onboarding');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const response =
        tab === 'signup'
          ? await fetch('/api/auth/signup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            })
          : await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            });

      const json = (await response.json()) as unknown;

      if (!response.ok) {
        setError(extractError(json));
        return;
      }

      const session = extractSession(json);

      if (!session) {
        if (tab === 'signup') {
          setInfo('Vérifie tes emails');
          return;
        }

        setError('Connexion impossible. Réessaie.');
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Connexion impossible. Réessaie.');
        return;
      }

      await redirectFromProfileState(user.id);
    } catch {
      setError('Impossible de contacter le serveur. Réessaie.');
    } finally {
      setLoading(false);
    }
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
          {info ? <p className="rounded-md border border-emerald-500/30 bg-emerald-900/20 p-2 text-sm text-emerald-200">{info}</p> : null}

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
