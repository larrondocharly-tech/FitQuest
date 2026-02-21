import type { Baseline } from '@/lib/plan/generatePlan';

export const baselineToZones = (baseline: Baseline) => {
  const fiveK = typeof baseline.fivek_time_sec === 'number' ? baseline.fivek_time_sec : null;
  const fiveKPace = fiveK ? fiveK / 5 : null;
  const easy = typeof baseline.easy_pace_sec_per_km === 'number' ? baseline.easy_pace_sec_per_km : fiveKPace ? Math.round(fiveKPace * 1.2) : null;
  const tempo = fiveKPace ? Math.round(fiveKPace * 1.06) : easy ? Math.round(easy * 0.9) : null;
  const interval = fiveKPace ? Math.round(fiveKPace * 0.95) : tempo ? Math.round(tempo * 0.95) : null;
  return { easy, tempo, interval };
};

export const recommendPaceForWorkout = (
  type: string,
  zones: ReturnType<typeof baselineToZones>,
  progressionWeek: number
): number | null => {
  const weekBoost = Math.max(0, progressionWeek - 1) * 0.01;
  if (type.includes('interval')) return zones.interval ? Math.round(zones.interval * (1 - weekBoost)) : null;
  if (type.includes('tempo')) return zones.tempo ? Math.round(zones.tempo * (1 - weekBoost)) : null;
  return zones.easy;
};
