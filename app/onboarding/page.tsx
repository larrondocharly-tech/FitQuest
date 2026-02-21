'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type TrainingLevel = 'beginner' | 'intermediate' | 'advanced';
type Goal = 'muscle' | 'strength' | 'fat_loss' | 'general';
type Location = 'gym' | 'home';

const equipmentOptions = [
  { label: 'Dumbbells', value: 'dumbbells' },
  { label: 'Barbell', value: 'barbell' },
  { label: 'Pull-up bar', value: 'pullup_bar' },
  { label: 'Bands', value: 'bands' },
  { label: 'None', value: 'none' }
];

export default function OnboardingPage() {
  const router = useRouter();
  const [heroName, setHeroName] = useState('');
  const [heroClass, setHeroClass] = useState('Warrior');
  const [trainingLevel, setTrainingLevel] = useState<TrainingLevel>('beginner');
  const [goal, setGoal] = useState<Goal>('muscle');
  const [location, setLocation] = useState<Location>('gym');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const effectiveGoal = useMemo(() => {
    if (goal) {
      return goal;
    }

    return heroClass === 'Warrior' ? 'muscle' : 'general';
  }, [goal, heroClass]);

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
            onChange={(e) => {
              const nextClass = e.target.value;
              setHeroClass(nextClass);
              if (nextClass === 'Warrior' && goal === 'general') {
                setGoal('muscle');
              }
            }}
            value={heroClass}
          >
            <option value="Warrior">Warrior</option>
            <option value="Mage">Mage</option>
            <option value="Rogue">Rogue</option>
          </select>
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
