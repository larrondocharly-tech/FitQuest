'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type FormState = {
  goal: 'fat_loss' | 'muscle_gain' | 'strength' | 'recomp' | 'endurance' | 'general_fitness';
  level: 'beginner' | 'intermediate' | 'advanced';
  weeks: number;
  sessionsPerWeek: number;
  equipment: string;
  injuries: string;
  dislikes: string;
  focusWeakPoints: string;
  preferExercises: string;
};

const parseCsv = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default function NewProgramPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    goal: 'muscle_gain',
    level: 'beginner',
    weeks: 8,
    sessionsPerWeek: 3,
    equipment: 'bodyweight,dumbbells',
    injuries: '',
    dislikes: '',
    focusWeakPoints: '',
    preferExercises: ''
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      const response = await fetch('/api/program/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          weeks: form.weeks,
          profile: {
            goal: form.goal,
            level: form.level,
            sessionsPerWeek: form.sessionsPerWeek,
            equipment: parseCsv(form.equipment),
            constraints: {
              injuries: form.injuries || undefined,
              dislikes: parseCsv(form.dislikes),
              focusWeakPoints: parseCsv(form.focusWeakPoints),
              preferExercises: parseCsv(form.preferExercises)
            }
          }
        })
      });

      const data = (await response.json()) as { ok?: boolean; planId?: string; error?: string; details?: string };

      if (!response.ok || !data.ok || !data.planId) {
        throw new Error(data.details || data.error || 'Impossible de générer le programme');
      }

      router.push(`/program/${data.planId}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-3xl font-semibold">Créer un programme IA</h2>
      <p className="text-sm text-slate-400">Conseils généraux, pas un avis médical.</p>

      <form className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>Objectif</span>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              onChange={(event) => setForm((previous) => ({ ...previous, goal: event.target.value as FormState['goal'] }))}
              value={form.goal}
            >
              <option value="fat_loss">Perte de gras</option>
              <option value="muscle_gain">Prise de muscle</option>
              <option value="strength">Force</option>
              <option value="recomp">Recomposition</option>
              <option value="endurance">Endurance</option>
              <option value="general_fitness">Forme générale</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span>Niveau</span>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              onChange={(event) => setForm((previous) => ({ ...previous, level: event.target.value as FormState['level'] }))}
              value={form.level}
            >
              <option value="beginner">Débutant</option>
              <option value="intermediate">Intermédiaire</option>
              <option value="advanced">Avancé</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span>Durée (semaines)</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              max={12}
              min={4}
              onChange={(event) => setForm((previous) => ({ ...previous, weeks: Number(event.target.value) }))}
              type="number"
              value={form.weeks}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span>Séances par semaine</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              max={6}
              min={2}
              onChange={(event) => setForm((previous) => ({ ...previous, sessionsPerWeek: Number(event.target.value) }))}
              type="number"
              value={form.sessionsPerWeek}
            />
          </label>
        </div>

        <label className="space-y-1 text-sm">
          <span>Équipement (séparé par des virgules)</span>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            onChange={(event) => setForm((previous) => ({ ...previous, equipment: event.target.value }))}
            value={form.equipment}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Blessures / douleurs</span>
          <textarea
            className="min-h-20 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            onChange={(event) => setForm((previous) => ({ ...previous, injuries: event.target.value }))}
            value={form.injuries}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Exercices à éviter (CSV)</span>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            onChange={(event) => setForm((previous) => ({ ...previous, dislikes: event.target.value }))}
            value={form.dislikes}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Points faibles à travailler (CSV)</span>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            onChange={(event) => setForm((previous) => ({ ...previous, focusWeakPoints: event.target.value }))}
            value={form.focusWeakPoints}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Exercices préférés (CSV)</span>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            onChange={(event) => setForm((previous) => ({ ...previous, preferExercises: event.target.value }))}
            value={form.preferExercises}
          />
        </label>

        {error ? <p className="rounded-md border border-red-500/30 bg-red-900/20 p-2 text-sm text-red-200">{error}</p> : null}

        <button className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white transition hover:bg-violet-500" disabled={loading} type="submit">
          {loading ? 'Génération en cours...' : 'Générer mon programme'}
        </button>
      </form>
    </section>
  );
}
