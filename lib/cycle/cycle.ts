import type { Recommendation } from '@/lib/progression/recommendWeight';

type DeloadExerciseInput = {
  sets: string;
};

type DeloadExerciseOutput = {
  sets: string;
  note?: string;
  recommendedWeight: number | null;
  progressionNote?: string;
};

export const weekStart = (date: Date | string): Date => {
  const base = typeof date === 'string' ? new Date(`${date}T00:00:00`) : new Date(date);
  const normalized = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diff);
  return normalized;
};

export const getCycleWeek = (cycleStartDate: Date | string, today: Date | string = new Date()): number => {
  const start = weekStart(cycleStartDate);
  const current = weekStart(today);
  const diffWeeks = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
  const normalized = ((diffWeeks % 4) + 4) % 4;
  return normalized + 1;
};

export const isDeloadWeek = (week: number): boolean => week === 4;

const normalizeSets = (sets: string): number => {
  const first = Number((sets.match(/\d+/) ?? ['3'])[0]);
  return Number.isFinite(first) && first > 0 ? first : 3;
};

export const applyDeload = ({
  exercise,
  recommendation
}: {
  exercise: DeloadExerciseInput;
  recommendation: Recommendation;
}): DeloadExerciseOutput => {
  const reducedSets = Math.max(2, normalizeSets(exercise.sets) - 1);

  if (recommendation.recommendedWeight !== null && recommendation.recommendedWeight !== undefined) {
    return {
      sets: String(reducedSets),
      note: 'Deload: volume et charge réduites cette semaine.',
      recommendedWeight: Math.max(0, Math.round(recommendation.recommendedWeight * 0.9 * 2) / 2),
      progressionNote: recommendation.progressionNote
    };
  }

  return {
    sets: String(reducedSets),
    note: 'Deload: volume réduit, garde la charge et vise RPE 6-7.',
    recommendedWeight: recommendation.recommendedWeight,
    progressionNote: recommendation.progressionNote
      ? `${recommendation.progressionNote} (Deload: vise RPE 6-7)`
      : 'Deload: vise RPE 6-7 à charge constante.'
  };
};
