'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/browser';

const supabase = createBrowserSupabase();

export default function OnboardingPage() {
  const router = useRouter();
  const [heroName, setHeroName] = useState('');
  const [heroClass, setHeroClass] = useState('Warrior');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      setError(userError?.message ?? 'Session invalide. Reconnecte-toi.');
      return;
    }

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      hero_name: heroName,
      hero_class: heroClass
    });

    setLoading(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <section className="mx-auto max-w-xl rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="mb-2 text-2xl font-semibold">Création du héros</h2>
      <p className="mb-6 text-slate-300">Forge ton identité FitQuest pour démarrer l'aventure.</p>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-sm text-slate-300" htmlFor="hero_name">Nom du héros</label>
          <input
            id="hero_name"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none ring-violet-500 focus:ring"
            onChange={(e) => setHeroName(e.target.value)}
            required
            type="text"
            value={heroName}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-300" htmlFor="hero_class">Classe</label>
          <select
            id="hero_class"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none ring-violet-500 focus:ring"
            onChange={(e) => setHeroClass(e.target.value)}
            value={heroClass}
          >
            <option value="Warrior">Warrior</option>
            <option value="Mage">Mage</option>
            <option value="Rogue">Rogue</option>
          </select>
        </div>

        {error ? <p className="rounded-md border border-red-500/30 bg-red-900/20 p-2 text-sm text-red-200">{error}</p> : null}

        <button
          className="w-full rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? 'Enregistrement...' : 'Créer mon héros'}
        </button>
      </form>
    </section>
  );
}
