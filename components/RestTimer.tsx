'use client';

import { useEffect, useMemo, useState } from 'react';

type RestTimerProps = {
  onUseRest: (seconds: number) => void;
};

const formatSeconds = (value: number): string => {
  const mins = Math.floor(value / 60)
    .toString()
    .padStart(2, '0');
  const secs = (value % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

export default function RestTimer({ onUseRest }: RestTimerProps) {
  const [selectedPreset, setSelectedPreset] = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          setIsRunning(false);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRunning]);

  const timerLabel = useMemo(() => formatSeconds(remaining), [remaining]);

  const applyPreset = (value: number) => {
    setSelectedPreset(value);
    setRemaining(value);
    setIsRunning(false);
  };

  return (
    <div className="mt-3 rounded-md border border-slate-700 bg-slate-950/70 p-3">
      <p className="text-xs text-slate-400">Rest timer</p>
      <p className="text-lg font-semibold text-violet-200">{timerLabel}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {[60, 90, 120].map((preset) => (
          <button
            className={`rounded-md px-2 py-1 text-xs ${selectedPreset === preset ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-200'}`}
            key={preset}
            onClick={() => applyPreset(preset)}
            type="button"
          >
            {preset}s
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <button className="rounded-md bg-emerald-600 px-3 py-1 text-white" onClick={() => setIsRunning(true)} type="button">
          Start
        </button>
        <button className="rounded-md bg-amber-600 px-3 py-1 text-white" onClick={() => setIsRunning(false)} type="button">
          Pause
        </button>
        <button className="rounded-md bg-slate-700 px-3 py-1 text-white" onClick={() => applyPreset(selectedPreset)} type="button">
          Reset
        </button>
        <button className="rounded-md bg-violet-700 px-3 py-1 text-white" onClick={() => onUseRest(remaining)} type="button">
          Use this rest
        </button>
      </div>
    </div>
  );
}
