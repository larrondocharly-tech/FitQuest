'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Exercise = {
  name: string;
  sets: number;
  reps: string;
  intensity: string;
  restSec: number;
  notes?: string;
};

type Session = {
  dayIndex: number;
  name: string;
  warmup: string[];
  exercises: Exercise[];
  finisher?: string[];
  cooldown?: string[];
};

type WeekPlan = {
  week: number;
  focus: string;
  sessions: Session[];
};

type Program = {
  title: string;
  overview: string;
  weeks: number;
  sessionsPerWeek: number;
  weekPlans: WeekPlan[];
  safetyNotes: string[];
};

export default function ProgramDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);

  useEffect(() => {
    const loadProgram = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user }
      } = await supabase.auth.getUser();

      let query = supabase.from('training_plans').select('plan_json').eq('id', params.id);
      if (user) {
        query = query.eq('user_id', user.id);
      }
      const { data, error: fetchError } = await query.limit(1).single();

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setProgram(data.plan_json as Program);
      setSelectedWeek(1);
      setLoading(false);
    };

    if (params.id) {
      loadProgram();
    }
  }, [params.id]);

  const currentWeek = useMemo(
    () => program?.weekPlans.find((week) => week.week === selectedWeek) ?? null,
    [program?.weekPlans, selectedWeek]
  );

  if (loading) {
    return <p>Chargement du programme...</p>;
  }

  if (error || !program) {
    return (
      <section className="space-y-4">
        <p className="rounded-md border border-red-500/30 bg-red-900/20 p-3 text-red-200">{error ?? 'Programme introuvable.'}</p>
        <button className="rounded-lg bg-slate-800 px-4 py-2" onClick={() => router.push('/program/new')} type="button">
          Retour
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-3xl font-semibold">{program.title}</h2>
        <p className="mt-2 text-slate-300">{program.overview}</p>
      </div>

      <label className="block max-w-xs space-y-1 text-sm">
        <span>Semaine</span>
        <select
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
          onChange={(event) => setSelectedWeek(Number(event.target.value))}
          value={selectedWeek}
        >
          {program.weekPlans.map((week) => (
            <option key={week.week} value={week.week}>
              Semaine {week.week}
            </option>
          ))}
        </select>
      </label>

      {currentWeek ? (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-violet-300">Focus: {currentWeek.focus}</h3>
          {currentWeek.sessions.map((session) => (
            <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4" key={`${currentWeek.week}-${session.dayIndex}`}>
              <h4 className="text-lg font-semibold">Jour {session.dayIndex} — {session.name}</h4>
              <p className="mt-2 text-sm text-slate-300">Échauffement: {session.warmup.join(' • ')}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {session.exercises.map((exercise, index) => (
                  <li className="rounded-md border border-slate-800 p-2" key={`${session.name}-${index}`}>
                    <p className="font-medium">{exercise.name}</p>
                    <p className="text-slate-300">
                      {exercise.sets} séries × {exercise.reps} — {exercise.intensity} — repos {exercise.restSec}s
                    </p>
                    {exercise.notes ? <p className="text-xs text-slate-400">{exercise.notes}</p> : null}
                  </li>
                ))}
              </ul>
              {session.finisher?.length ? <p className="mt-3 text-sm text-slate-300">Finisher: {session.finisher.join(' • ')}</p> : null}
              {session.cooldown?.length ? <p className="mt-2 text-sm text-slate-300">Retour au calme: {session.cooldown.join(' • ')}</p> : null}
            </article>
          ))}
        </div>
      ) : null}

      <div className="rounded-md border border-amber-500/20 bg-amber-900/20 p-3 text-sm text-amber-100">
        Conseils généraux, pas un avis médical.
      </div>

      <div>
        <h4 className="mb-2 font-semibold">Notes de sécurité</h4>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
          {program.safetyNotes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
