'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type SessionExercise = {
  name: string;
  sets: number;
  reps: string;
  intensity: string;
  restSec: number;
  notes?: string;
};

type SessionPayload = {
  name: string;
  warmup: string[];
  exercises: SessionExercise[];
  finisher?: string[];
  cooldown?: string[];
};

type WorkoutSessionRow = {
  id: string;
  status: 'in_progress' | 'done' | 'cancelled';
  session_json: SessionPayload;
};

export default function WorkoutSessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<WorkoutSessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/auth');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('workout_sessions')
        .select('id, status, session_json')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .maybeSingle<WorkoutSessionRow>();

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setError('Séance introuvable.');
        setLoading(false);
        return;
      }

      setSession(data);
      setLoading(false);
    };

    if (params.id) {
      loadSession();
    }
  }, [params.id, router]);

  const handleFinish = async () => {
    if (!session || finishing) return;

    setFinishing(true);
    setError(null);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/auth');
      return;
    }

    const { error: finishError } = await supabase
      .from('workout_sessions')
      .update({ status: 'done', completed_at: new Date().toISOString(), ended_at: new Date().toISOString() })
      .eq('id', session.id)
      .eq('user_id', user.id);

    if (finishError) {
      setError(finishError.message);
      setFinishing(false);
      return;
    }

    router.push('/dashboard');
  };

  if (loading) {
    return <p>Chargement de la séance...</p>;
  }

  if (error || !session) {
    return (
      <section className="space-y-4">
        <p className="rounded-md border border-red-500/30 bg-red-900/20 p-3 text-red-200">{error ?? 'Séance introuvable.'}</p>
        <button className="rounded-lg bg-slate-800 px-4 py-2" onClick={() => router.push('/dashboard')} type="button">
          Retour au tableau de bord
        </button>
      </section>
    );
  }

  const payload = session.session_json;

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-3xl font-semibold">{payload.name}</h2>
        <p className="text-slate-300">Statut: {session.status === 'done' ? 'Terminée' : 'En cours'}</p>
      </div>

      <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="text-lg font-semibold">Échauffement</h3>
        <p className="mt-2 text-sm text-slate-300">{payload.warmup?.join(' • ') || 'Aucun échauffement indiqué.'}</p>
      </article>

      <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="text-lg font-semibold">Exercices</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {payload.exercises?.map((exercise, index) => (
            <li className="rounded-md border border-slate-800 p-2" key={`${exercise.name}-${index}`}>
              <p className="font-medium">{exercise.name}</p>
              <p className="text-slate-300">
                {exercise.sets} séries × {exercise.reps} — {exercise.intensity} — repos {exercise.restSec}s
              </p>
              {exercise.notes ? <p className="text-xs text-slate-400">{exercise.notes}</p> : null}
            </li>
          ))}
        </ul>
      </article>

      {payload.finisher?.length ? (
        <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="text-lg font-semibold">Finisher</h3>
          <p className="mt-2 text-sm text-slate-300">{payload.finisher.join(' • ')}</p>
        </article>
      ) : null}

      {payload.cooldown?.length ? (
        <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="text-lg font-semibold">Retour au calme</h3>
          <p className="mt-2 text-sm text-slate-300">{payload.cooldown.join(' • ')}</p>
        </article>
      ) : null}

      <button
        className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
        disabled={session.status === 'done' || finishing}
        onClick={handleFinish}
        type="button"
      >
        {finishing ? 'Finalisation...' : 'Terminer la séance'}
      </button>
    </section>
  );
}
