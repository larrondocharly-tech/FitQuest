'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { Archetype, GeneratedPlan } from '@/lib/plan/generatePlan';

type ProfileFilters = {
  archetype: Archetype;
  days_per_week: number;
  location: string;
  equipment: string[];
};

type TemplateRow = {
  id: string;
  archetype: Archetype;
  title: string;
  description: string | null;
  days_per_week: number;
  location: string;
  equipment: string[];
  template: GeneratedPlan;
};

export default function LibraryPage() {
  const router = useRouter();
  const [profileFilters, setProfileFilters] = useState<ProfileFilters | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/auth');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('archetype, days_per_week, location, equipment')
        .eq('id', user.id)
        .maybeSingle<ProfileFilters>();

      const filters = profile ?? { archetype: 'hypertrophy', days_per_week: 3, location: 'gym', equipment: [] };
      setProfileFilters(filters);

      const { data: libraryData, error: templateError } = await supabase
        .from('plan_templates')
        .select('id, archetype, title, description, days_per_week, location, equipment, template')
        .eq('archetype', filters.archetype)
        .returns<TemplateRow[]>();

      if (templateError) {
        setError(templateError.message);
        return;
      }

      setTemplates(libraryData ?? []);
    };

    load();
  }, [router]);

  const filtered = useMemo(() => {
    if (!profileFilters) return templates;
    return templates.filter((item) => {
      const locationMatch = item.location === profileFilters.location || item.location === 'outdoor';
      const equipmentMatch = item.equipment.every((eq) => profileFilters.equipment.length === 0 || profileFilters.equipment.includes(eq) || eq === 'running');
      const dayMatch = item.days_per_week <= Math.max(profileFilters.days_per_week, 2);
      return locationMatch && equipmentMatch && dayMatch;
    });
  }, [profileFilters, templates]);

  const activatePlan = async (item: TemplateRow) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('workout_plans').update({ is_active: false }).eq('user_id', user.id).eq('is_active', true);

    const { error: insertError } = await supabase.from('workout_plans').insert({
      user_id: user.id,
      title: item.title,
      is_active: true,
      meta: item.template.meta ?? { source: 'template_library' },
      plan: item.template
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push('/plan');
  };

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">Bibliothèque</h1>
      <p className="text-slate-300">Choisis un template adapté à ton archétype.</p>
      {error ? <p className="rounded-md border border-red-500/30 bg-red-900/20 p-2 text-sm text-red-200">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h2 className="text-lg font-semibold text-violet-200">{item.title}</h2>
            <p className="text-sm text-slate-400">{item.archetype} · {item.days_per_week}j/sem · {item.location}</p>
            <p className="mt-2 text-sm text-slate-300">{item.description ?? 'Template du coach.'}</p>
            <button className="mt-3 text-sm text-cyan-300" onClick={() => setExpandedId((prev) => prev === item.id ? null : item.id)} type="button">
              {expandedId === item.id ? 'Masquer l’aperçu' : 'Aperçu'}
            </button>

            {expandedId === item.id ? (
              <ul className="mt-2 space-y-1 text-sm text-slate-300">
                {item.template.days.map((day) => (
                  <li key={`${item.id}-${day.day}`}>{day.day}: {day.focus} ({day.exercises.length} exos)</li>
                ))}
              </ul>
            ) : null}

            <button className="mt-4 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => activatePlan(item)} type="button">
              Use this plan
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
