import test from 'node:test';
import assert from 'node:assert/strict';

const { detectPlateau } = await import('../lib/coach/plateau.ts');
const { pickSubstitute } = await import('../lib/coach/substitute.ts');

test('detectPlateau flags 3 stagnant sessions', () => {
  const logs = [
    { session_id: '1', weight_kg: 60, reps: 8, rpe: 8, created_at: '2024-01-03' },
    { session_id: '2', weight_kg: 60, reps: 8, rpe: 8, created_at: '2024-01-02' },
    { session_id: '3', weight_kg: 60, reps: 8, rpe: 8, created_at: '2024-01-01' }
  ];
  assert.equal(detectPlateau('barbell_bench_press', logs, { min: 6, max: 10 }).isPlateau, true);
});

test('pickSubstitute swaps banned base exercise', () => {
  const base = {
    exercise_key: 'barbell_bench_press',
    exercise_name: 'Barbell Bench Press',
    equipment_type: 'barbell',
    sets: '4',
    reps: '6-10',
    target_reps_min: 6,
    target_reps_max: 10
  };
  const variants = [{
    base_key: 'barbell_bench_press',
    variant_key: 'machine_chest_press',
    name: 'Machine Chest Press',
    equipment_type: 'machine',
    tags: ['shoulder_friendly'],
    priority: 90
  }];

  const substituted = pickSubstitute(base, { injuries: [], banned: ['barbell_bench_press'], equipment: ['machine'], location: 'gym' }, variants);
  assert.equal(substituted.exercise_key, 'machine_chest_press');
});
