'use client';

import { useEffect, useMemo, useState } from 'react';

type RestTimerProps = {
  defaultSeconds: number;
  onStop: () => void;
};

const formatSeconds = (value: number): string => {
  const mins = Math.floor(value / 60)
    .toString()
    .padStart(2, '0');
  const secs = (value % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

export default function RestTimer({ defaultSeconds, onStop }: RestTimerProps) {
  const [selectedPreset, setSelectedPreset] = useState(defaultSeconds);
  const [remaining, setRemaining] = useState(defaultSeconds);
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    setSelectedPreset(defaultSeconds);
    setRemaining(defaultSeconds);
    setIsRunning(true);
  }, [defaultSeconds]);

  useEffect(() => {
    if (!isRunning) return;

    const interval = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          setIsRunning(false);
          onStop();
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRunning, onStop]);

  const timerLabel = useMemo(() => formatSeconds(remaining), [remaining]);

  const applyPreset = (value: number) => {
    setSelectedPreset(value);
    setRemaining(value);
    setIsRunning(true);
  };

  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-900/10 p-4">
      <p className="text-xs uppercase tracking-wide text-violet-300">Repos</p>
      <p className="text-4xl font-bold text-violet-100">{timerLabel}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {[60, 90, 120].map((preset) => (
          <button
            className={`rounded-md px-3 py-1 text-xs ${selectedPreset === preset ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-200'}`}
            key={preset}
            onClick={() => applyPreset(preset)}
            type="button"
          >
            {preset}s
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <button className="rounded-md bg-amber-600 px-3 py-1 text-white" onClick={() => setIsRunning(false)} type="button">
          Pause
        </button>
        <button className="rounded-md bg-emerald-600 px-3 py-1 text-white" onClick={() => setIsRunning(true)} type="button">
          Reprendre
        </button>
        <button className="rounded-md bg-rose-700 px-3 py-1 text-white" onClick={onStop} type="button">
          Stop repos
        </button>
        <button className="rounded-md bg-slate-700 px-3 py-1 text-white" onClick={() => applyPreset(selectedPreset)} type="button">
          Reset
        </button>
      </div>
    </div>
  );
}
