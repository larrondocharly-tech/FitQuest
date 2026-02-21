import { weekStart } from '@/lib/cycle/cycle';
import type { GeneratedPlan } from '@/lib/plan/generatePlan';
import { supabase } from '@/lib/supabaseClient';

export type ScheduledWorkoutRow = {
  id: string;
  workout_date: string;
  day_index: number;
  status: 'planned' | 'done' | 'skipped';
  session_id: string | null;
};

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const fallbackOffsets = (daysPerWeek: number): number[] => {
  if (daysPerWeek <= 1) return [0];
  const slots = 6;
  return Array.from({ length: daysPerWeek }, (_, index) => Math.round((index * slots) / (daysPerWeek - 1)));
};

const scheduleOffsetsMap: Record<number, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5]
};

const getOffsetsForWeek = (daysPerWeek: number): number[] => scheduleOffsetsMap[daysPerWeek] ?? fallbackOffsets(daysPerWeek);

export const ensureWeekSchedule = async (userId: string, plan: GeneratedPlan, planId: string | null): Promise<ScheduledWorkoutRow[]> => {
  const start = weekStart(new Date());
  const end = addDays(start, 6);
  const startDate = formatDate(start);
  const endDate = formatDate(end);

  const { data: existing, error: selectError } = await supabase
    .from('scheduled_workouts')
    .select('id, workout_date, day_index, status, session_id')
    .eq('user_id', userId)
    .gte('workout_date', startDate)
    .lte('workout_date', endDate)
    .order('workout_date', { ascending: true })
    .returns<ScheduledWorkoutRow[]>();

  if (selectError) throw new Error(selectError.message);

  const targetDays = Math.max(3, Math.min(6, plan.meta.days_per_week ?? plan.days.length));
  const existingRows = existing ?? [];

  if (existingRows.length < targetDays) {
    const existingDates = new Set(existingRows.map((row) => row.workout_date));
    const offsets = getOffsetsForWeek(targetDays);
    const rows = offsets
      .map((offset, index) => ({
        user_id: userId,
        plan_id: planId,
        workout_date: formatDate(addDays(start, offset)),
        day_index: index
      }))
      .filter((row) => !existingDates.has(row.workout_date));

    if (rows.length) {
      const { error: upsertError } = await supabase.from('scheduled_workouts').upsert(rows, { onConflict: 'user_id,workout_date' });
      if (upsertError) throw new Error(upsertError.message);
    }
  }

  const { data: updated, error: updatedError } = await supabase
    .from('scheduled_workouts')
    .select('id, workout_date, day_index, status, session_id')
    .eq('user_id', userId)
    .gte('workout_date', startDate)
    .lte('workout_date', endDate)
    .order('workout_date', { ascending: true })
    .returns<ScheduledWorkoutRow[]>();

  if (updatedError) throw new Error(updatedError.message);

  return updated ?? [];
};
