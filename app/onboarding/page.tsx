'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { mapHeroClassToArchetype, type Archetype } from '@/lib/plan/generatePlan';

type TrainingLevel = 'beginner' | 'intermediate' | 'advanced';
type Goal = 'muscle' | 'strength' | 'fat_loss' | 'general';
type Location = 'gym' | 'home';

type BaselineValues = {
  bench_press_5rm_kg: string;
  squat_5rm_kg: string;
  row_8rm_kg: string;
  pullups_max: string;
  dips_max: string;
  pushups_max: string;
  front_squat_3rm_kg: string;
  power_clean_3rm_kg: string;
  strict_press_5rm_kg: string;
  cooper_m: string;
  fivek_time_sec: string;
  easy_pace_sec_per_km: string;
};

const equipmentOptions = [
  { label: 'Dumbbells', value: 'dumbbells' },
  { label: 'Barbell', value: 'barbell' },
  { label: 'Pull-up bar', value: 'pullup_bar' },
  { label: 'Bands', value: 'bands' },
  { label: 'None', value: 'none' }
];

const emptyBaseline: BaselineValues = {
  bench_press_5rm_kg: '',
  squat_5rm_kg: '',
  row_8rm_kg: '',
  pullups_max: '',
  dips_max: '',
  pushups_max: '',
  front_squat_3rm_kg: '',
  power_clean_3rm_kg: '',
  strict_press_5rm_kg: '',
  cooper_m: '',
  fivek_time_sec: '',
  easy_pace_sec_per_km: ''
};

const numberOrNull = (value: string): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [heroName, setHeroName] = useState('');
  const [heroClass, setHeroClass] = useState('Warrior');
  const [trainingLevel, setTrainingLevel] = useState<TrainingLevel>('beginner');
  const [goal, setGoal] = useState<Goal>('muscle');
  const [location, setLocation] = useState<Location>('gym');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [baseline, setBaseline] = useState<BaselineValues>(emptyBaseline);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const archetype: Archetype = useMemo(() => mapHeroClassToArchetype(heroClass), [heroClass]);

  const effectiveGoal = useMemo(() => {
    if (goal) {
      return goal;
    }

    return heroClass === 'Warrior' ? 'muscle' : 'general';
  }, [goal, heroClass]);

  const baselinePayload = useMemo(() => {
    if (archetype === 'calisthenics') {
      return {
        pullups_max: numberOrNull(baseline.pullups_max),
        dips_max: numberOrNull(baseline.dips_max),
        pushups_max: numberOrNull(baseline.pushups_max)
      };
    }

    if (archetype === 'weightlifting') {
      return {
        front_squat_3rm_kg: numberOrNull(baseline.front_squat_3rm_kg),
        power_clean_3rm_kg: numberOrNull(baseline.power_clean_3rm_kg),
        strict_press_5rm_kg: numberOrNull(baseline.strict_press_5rm_kg)
      };
    }

    if (archetype === 'running') {
      return {
        cooper_m: numberOrNull(baseline.cooper_m),
        fivek_time_sec: numberOrNull(baseline.fivek_time_sec),
        easy_pace_sec_per_km: numberOrNull(baseline.easy_pace_sec_per_km)
      };
    }

    return {
      bench_press_5rm_kg: numberOrNull(baseline.bench_press_5rm_kg),
      squat_5rm_kg: numberOrNull(baseline.squat_5rm_kg),
      row_8rm_kg: numberOrNull(baseline.row_8rm_kg)
    };
  }, [archetype, baseline]);

  const handleEquipmentChange = (item: string, checked: boolean) => {
    if (item === 'none' && checked) {
      setEquipment(['none']);
      return;
    }

    if (item !== 'none' && checked) {
      setEquipment((prev) => prev.filter((entry) => entry !== 'none').concat(item));
      return;
    }

    if (!checked) {
      setEquipment((prev) => prev.filter((entry) => entry !== item));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      setError(userError?.message ?? 'Session invalide. Reconnecte-toi.');
      return;
    }

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      hero_name: heroName,
      hero_class: heroClass,
      archetype,
      baseline: baselinePayload,
      training_level: trainingLevel,
      goal: effectiveGoal,
      location,
      days_per_week: daysPerWeek,
      equipment: location === 'home' ? equipment.filter((item) => item !== 'none') : []
    });

    setLoading(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    router.push('/plan');
  };

  return (
    <section className="mx-auto max-w-xl rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="mb-2 text-2xl font-semibold">Création du héros</h2>
      <p className="mb-6 text-slate-300">Forge ton identité FitQuest et ton plan d&apos;entraînement.</p>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-sm text-slate-300" htmlFor="hero_name">Nom du héros</label>
          <input
            id="hero_name"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none ring-violet-500 focus:ring"
            onChange={(e) => setHeroName(e.target.value)}
            required
            type="text"
            value={heroName}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-300" htmlFor="hero_class">Classe</label>
          <select
            id="hero_class"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none ring-violet-500 focus:ring"
            onChange={(e) => setHeroClass(e.target.value)}
            value={heroClass}
          >
            <option value="Warrior">Warrior</option>
            <option value="Ninja">Ninja</option>
            <option value="Titan">Titan</option>
            <option value="Ranger">Ranger</option>
            <option value="Runner">Runner</option>
            <option value="Mage">Mage</option>
            <option value="Rogue">Rogue</option>
          </select>
          <p className="mt-1 text-xs text-slate-400">Archetype détecté: {archetype}</p>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-300" htmlFor="training_level">Niveau d&apos;entraînement</label>
          <select
            id="training_level"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none ring-violet-500 focus:ring"
            onChange={(e) => setTrainingLevel(e.target.value as TrainingLevel)}
            value={trainingLevel}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-300" htmlFor="goal">Objectif</label>
          <select
            id="goal"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none ring-violet-500 focus:ring"
            onChange={(e) => setGoal(e.target.value as Goal)}
            value={goal}
          >
            <option value="muscle">Muscle</option>
            <option value="strength">Strength</option>
            <option value="fat_loss">Fat loss</option>
            <option value="general">General fitness</option>
          </select>
        </div>

        <div>
          <p className="mb-2 block text-sm text-slate-300">Lieu d&apos;entraînement</p>
          <div className="flex gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
              <input checked={location === 'gym'} name="location" onChange={() => setLocation('gym')} type="radio" value="gym" />
              Gym
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
              <input checked={location === 'home'} name="location" onChange={() => setLocation('home')} type="radio" value="home" />
              Home
            </label>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-300" htmlFor="days_per_week">Jours / semaine</label>
          <select
            id="days_per_week"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none ring-violet-500 focus:ring"
            onChange={(e) => setDaysPerWeek(Number(e.target.value))}
            value={daysPerWeek}
          >
            {[2, 3, 4, 5, 6].map((day) => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>

        {location === 'home' ? (
          <div>
            <p className="mb-2 block text-sm text-slate-300">Équipement disponible</p>
            <div className="grid grid-cols-2 gap-2">
              {equipmentOptions.map((option) => (
                <label className="inline-flex items-center gap-2 text-sm text-slate-200" key={option.value}>
                  <input
                    checked={equipment.includes(option.value)}
                    onChange={(e) => handleEquipmentChange(option.value, e.target.checked)}
                    type="checkbox"
                    value={option.value}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
          <p className="mb-2 text-sm font-medium text-slate-200">Baseline ({archetype})</p>
          <div className="grid gap-2">
            {archetype === 'hypertrophy' ? (
              <>
                <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Bench press 5RM (kg)" type="number" value={baseline.bench_press_5rm_kg} onChange={(e) => setBaseline((prev) => ({ ...prev, bench_press_5rm_kg: e.target.value }))} />
                <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Squat 5RM (kg)" type="number" value={baseline.squat_5rm_kg} onChange={(e) => setBaseline((prev) => ({ ...prev, squat_5rm_kg: e.target.value }))} />
                <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Row 8RM (kg)" type="number" value={baseline.row_8rm_kg} onChange={(e) => setBaseline((prev) => ({ ...prev, row_8rm_kg: e.target.value }))} />
              </>
            ) : null}
            {archetype === 'calisthenics' ? (
              <>
                <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Pull-ups max" type="number" value={baseline.pullups_max} onChange={(e) => setBaseline((prev) => ({ ...prev, pullups_max: e.target.value }))} />
                <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Dips max" type="number" value={baseline.dips_max} onChange={(e) => setBaseline((prev) => ({ ...prev, dips_max: e.target.value }))} />
                <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Push-ups max" type="number" value={baseline.pushups_max} onChange={(e) => setBaseline((prev) => ({ ...prev, pushups_max: e.target.value }))} />
              </>
            ) : null}
            {archetype === 'weightlifting' ? (
              <>
                <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Front squat 3RM (kg)" type="number" value={baseline.front_squat_3rm_kg} onChange={(e) => setBaseline((prev) => ({ ...prev, front_squat_3rm_kg: e.target.value }))} />
                <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Power clean 3RM (kg)" type="number" value={baseline.power_clean_3rm_kg} onChange={(e) => setBaseline((prev) => ({ ...prev, power_clean_3rm_kg: e.target.value }))} />
                <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Strict press 5RM (kg)" type="number" value={baseline.strict_press_5rm_kg} onChange={(e) => setBaseline((prev) => ({ ...prev, strict_press_5rm_kg: e.target.value }))} />
              </>
            ) : null}
            {archetype === 'running' ? (
              <>
                <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Cooper 12-min distance (m)" type="number" value={baseline.cooper_m} onChange={(e) => setBaseline((prev) => ({ ...prev, cooper_m: e.target.value }))} />
                <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="5k time (sec)" type="number" value={baseline.fivek_time_sec} onChange={(e) => setBaseline((prev) => ({ ...prev, fivek_time_sec: e.target.value }))} />
                <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Allure facile (sec/km)" type="number" value={baseline.easy_pace_sec_per_km} onChange={(e) => setBaseline((prev) => ({ ...prev, easy_pace_sec_per_km: e.target.value }))} />
              </>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-slate-400">Tous les champs baseline sont optionnels.</p>
        </div>

        {error ? <p className="rounded-md border border-red-500/30 bg-red-900/20 p-2 text-sm text-red-200">{error}</p> : null}

        <button
          className="w-full rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? 'Enregistrement...' : 'Créer mon héros'}
        </button>
      </form>
    </section>
  );
}
