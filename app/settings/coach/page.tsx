'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type UserConstraintsRow = {
  time_cap_minutes: number | null;
  injuries: string[] | null;
  banned_exercises: string[] | null;
  preferred_exercises: string[] | null;
};

const injuryOptions = ['shoulder', 'knee', 'back', 'wrist', 'ankle'] as const;

const toTextarea = (values: string[] | null | undefined) => (values ?? []).join('\n');

const fromTextarea = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

const dbErrorMessage = (message: string) => {
  if (message.includes('does not exist')) {
    return 'La base de données n’est pas à jour. Applique le schema SQL puis réessaie.';
  }

  return message;
};

export default function CoachSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timeCapMinutes, setTimeCapMinutes] = useState('');
  const [selectedInjuries, setSelectedInjuries] = useState<string[]>([]);
  const [bannedExercises, setBannedExercises] = useState('');
  const [preferredExercises, setPreferredExercises] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/auth');
        return;
      }

      const { data, error: constraintsError } = await supabase
        .from('user_constraints')
        .select('time_cap_minutes, injuries, banned_exercises, preferred_exercises')
        .eq('user_id', user.id)
        .maybeSingle<UserConstraintsRow>();

      if (constraintsError) {
        setError(dbErrorMessage(constraintsError.message));
        setLoading(false);
        return;
      }

      setTimeCapMinutes(data?.time_cap_minutes ? String(data.time_cap_minutes) : '');
      setSelectedInjuries((data?.injuries ?? []).filter((injury): injury is string => typeof injury === 'string'));
      setBannedExercises(toTextarea(data?.banned_exercises));
      setPreferredExercises(toTextarea(data?.preferred_exercises));
      setLoading(false);
    };

    loadData();
  }, [router]);

  const toggleInjury = (injury: string) => {
    setSelectedInjuries((current) =>
      current.includes(injury) ? current.filter((item) => item !== injury) : [...current, injury]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace('/auth');
      return;
    }

    const parsedTimeCap = timeCapMinutes.trim() ? Number(timeCapMinutes) : null;
    if (parsedTimeCap !== null && (!Number.isFinite(parsedTimeCap) || parsedTimeCap <= 0)) {
      setError('Le time cap doit être un nombre positif.');
      setSaving(false);
      return;
    }

    const payload = {
      user_id: user.id,
      time_cap_minutes: parsedTimeCap ? Math.round(parsedTimeCap) : null,
      injuries: selectedInjuries,
      banned_exercises: fromTextarea(bannedExercises),
      preferred_exercises: fromTextarea(preferredExercises)
    };

    const { error: upsertError } = await supabase.from('user_constraints').upsert(payload, { onConflict: 'user_id' });

    setSaving(false);

    if (upsertError) {
      setError(dbErrorMessage(upsertError.message));
      return;
    }

    setSuccess('Préférences coach enregistrées.');
  };

  if (loading) {
    return <section className="text-sm text-slate-300">Chargement...</section>;
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold">Réglages du coach</h2>
        <Link className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900" href="/dashboard">
          Retour au tableau de bord
        </Link>
      </div>

      {error ? <p className="rounded-md border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-200">{error}</p> : null}
      {success ? <p className="rounded-md border border-emerald-500/30 bg-emerald-900/20 p-3 text-sm text-emerald-200">{success}</p> : null}

      <div className="space-y-4 rounded-xl border border-violet-500/30 bg-slate-900/80 p-4">
        <div>
          <label className="mb-1 block text-sm text-slate-300" htmlFor="timeCapMinutes">
            Durée max (minutes)
          </label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-violet-500 focus:ring"
            id="timeCapMinutes"
            min={1}
            onChange={(event) => setTimeCapMinutes(event.target.value)}
            placeholder="ex: 60"
            type="number"
            value={timeCapMinutes}
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm text-slate-300">Blessures</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {injuryOptions.map((injury) => (
              <label className="flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm" key={injury}>
                <input
                  checked={selectedInjuries.includes(injury)}
                  onChange={() => toggleInjury(injury)}
                  type="checkbox"
                />
                <span>{injury}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="mb-1 block text-sm text-slate-300" htmlFor="bannedExercises">
            Exercices à éviter
          </label>
          <textarea
            className="min-h-28 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-violet-500 focus:ring"
            id="bannedExercises"
            onChange={(event) => setBannedExercises(event.target.value)}
            placeholder={'une exercise_key par ligne\nex: barbell_back_squat'}
            value={bannedExercises}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-300" htmlFor="preferredExercises">
            Exercices préférés
          </label>
          <textarea
            className="min-h-28 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-violet-500 focus:ring"
            id="preferredExercises"
            onChange={(event) => setPreferredExercises(event.target.value)}
            placeholder={'une exercise_key par ligne\nex: chest_supported_row'}
            value={preferredExercises}
          />
        </div>

        <button
          className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={saving}
          onClick={handleSave}
          type="button"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </section>
  );
}
