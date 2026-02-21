'use client';

import { useEffect, useMemo, useState } from 'react';

type RestTimerProps = {
  recommendedSeconds: number;
  onStop: () => void;
};

const formatSeconds = (value: number): string => {
  const mins = Math.floor(value / 60)
    .toString()
    .padStart(2, '0');
  const secs = (value % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

export default function RestTimer({ recommendedSeconds, onStop }: RestTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    setElapsed(0);
    setIsRunning(true);
  }, [recommendedSeconds]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => {
      setElapsed((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  const timerLabel = useMemo(() => formatSeconds(elapsed), [elapsed]);

  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-900/10 p-4">
      <p className="text-xs uppercase tracking-wide text-violet-300">Récupération</p>
      <p className="text-4xl font-bold text-violet-100">{timerLabel}</p>
      <p className="mt-1 text-xs text-violet-200">Récup conseillé: {recommendedSeconds}s</p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <button className="rounded-md bg-amber-600 px-3 py-2 font-medium text-white" onClick={() => setIsRunning((prev) => !prev)} type="button">
          {isRunning ? 'Pause' : 'Reprendre'}
        </button>
        <button className="rounded-md bg-slate-700 px-3 py-2 font-medium text-white" onClick={() => setElapsed(0)} type="button">
          Réinitialiser
        </button>
        <button className="rounded-md bg-violet-700 px-3 py-2 font-medium text-white" onClick={onStop} type="button">
          Passer à la suite
        </button>
      </div>
    </div>
  );
}
