import type { ExerciseLogForProgression } from '@/lib/progression/recommendWeight';

export const detectPlateau = (
  exercise_key: string,
  logs: ExerciseLogForProgression[],
  targetRange: { min: number; max: number }
): { isPlateau: boolean; reason: string } => {
  const relevant = logs
    .filter((log) => !exercise_key || log.session_id)
    .slice(0, 12)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const sessions = relevant.slice(0, 3);
  if (sessions.length < 3) {
    return { isPlateau: false, reason: 'Not enough sessions.' };
  }

  const [latest, prev, older] = sessions;
  const weights = [latest.weight_kg ?? 0, prev.weight_kg ?? 0, older.weight_kg ?? 0];
  const reps = [latest.reps, prev.reps, older.reps];

  const inRange = reps.every((rep) => rep >= targetRange.min && rep <= targetRange.max);
  const noRepGainAtSameLoad =
    weights[0] === weights[1] && weights[1] === weights[2] && reps[0] <= reps[1] && reps[1] <= reps[2];
  const noLoadIncreaseWhileInRange = inRange && weights[0] <= weights[1] && weights[1] <= weights[2];

  if (noRepGainAtSameLoad || noLoadIncreaseWhileInRange) {
    return {
      isPlateau: true,
      reason: '3 sessions sans progression mesurable (charge/répétitions).'
    };
  }

  return { isPlateau: false, reason: 'Progression still detected.' };
};
