import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type Goal = 'fat_loss' | 'muscle_gain' | 'strength' | 'recomp' | 'endurance' | 'general_fitness';
type Level = 'beginner' | 'intermediate' | 'advanced';

type ProgramInput = {
  weeks: number;
  profile: {
    goal: Goal;
    level: Level;
    weightKg?: number;
    heightCm?: number;
    age?: number;
    sex?: 'female' | 'male' | 'other';
    sessionsPerWeek: number;
    sessionDurationMin?: number;
    equipment: string[];
    constraints?: {
      injuries?: string;
      dislikes?: string[];
      focusWeakPoints?: string[];
      preferExercises?: string[];
    };
  };
};

type Plan = {
  title: string;
  overview: string;
  weeks: number;
  sessionsPerWeek: number;
  progression: {
    method: 'double_progression' | 'rpe_based' | 'linear' | 'undulating';
    deloadWeek?: number;
  };
  weekPlans: Array<{
    week: number;
    focus: string;
    sessions: Array<{
      dayIndex: number;
      name: string;
      warmup: string[];
      exercises: Array<{
        name: string;
        sets: number;
        reps: string;
        intensity: string;
        restSec: number;
        notes?: string;
      }>;
      finisher?: string[];
      cooldown?: string[];
    }>;
  }>;
  safetyNotes: string[];
};

const GOALS = new Set<Goal>(['fat_loss', 'muscle_gain', 'strength', 'recomp', 'endurance', 'general_fitness']);
const LEVELS = new Set<Level>(['beginner', 'intermediate', 'advanced']);

const isStringArray = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);

const validateInput = (payload: unknown): ProgramInput => {
  if (!payload || typeof payload !== 'object') throw new Error('Body JSON invalide.');
  const input = payload as Partial<ProgramInput>;
  if (typeof input.weeks !== 'number' || input.weeks < 4 || input.weeks > 12) throw new Error('weeks doit être entre 4 et 12.');
  if (!input.profile || typeof input.profile !== 'object') throw new Error('profile manquant.');

  const profile = input.profile as ProgramInput['profile'];
  if (!GOALS.has(profile.goal)) throw new Error('goal invalide.');
  if (!LEVELS.has(profile.level)) throw new Error('level invalide.');
  if (typeof profile.sessionsPerWeek !== 'number' || profile.sessionsPerWeek < 2 || profile.sessionsPerWeek > 6) throw new Error('sessionsPerWeek doit être entre 2 et 6.');
  if (!isStringArray(profile.equipment) || profile.equipment.length === 0) throw new Error('equipment doit contenir au moins un élément.');
  if (profile.sessionDurationMin !== undefined && (profile.sessionDurationMin < 20 || profile.sessionDurationMin > 120)) throw new Error('sessionDurationMin doit être entre 20 et 120.');

  return {
    weeks: input.weeks,
    profile: {
      ...profile,
      constraints: profile.constraints
        ? {
            injuries: profile.constraints.injuries,
            dislikes: profile.constraints.dislikes?.filter(Boolean),
            focusWeakPoints: profile.constraints.focusWeakPoints?.filter(Boolean),
            preferExercises: profile.constraints.preferExercises?.filter(Boolean)
          }
        : undefined
    }
  };
};

const validatePlan = (plan: unknown): Plan => {
  if (!plan || typeof plan !== 'object') throw new Error('Plan JSON invalide.');
  const parsed = plan as Plan;
  if (typeof parsed.title !== 'string' || typeof parsed.overview !== 'string') throw new Error('title/overview invalides.');
  if (typeof parsed.weeks !== 'number' || parsed.weeks < 4 || parsed.weeks > 12) throw new Error('weeks du plan invalide.');
  if (typeof parsed.sessionsPerWeek !== 'number' || parsed.sessionsPerWeek < 2 || parsed.sessionsPerWeek > 6) throw new Error('sessionsPerWeek du plan invalide.');
  if (!Array.isArray(parsed.weekPlans) || parsed.weekPlans.length !== parsed.weeks) throw new Error('weekPlans doit avoir la même longueur que weeks.');
  if (!Array.isArray(parsed.safetyNotes) || parsed.safetyNotes.some((item) => typeof item !== 'string' || !item)) throw new Error('safetyNotes invalide.');

  parsed.weekPlans.forEach((week) => {
    if (!Array.isArray(week.sessions) || week.sessions.length !== parsed.sessionsPerWeek) throw new Error('Nombre de sessions hebdo invalide.');
    week.sessions.forEach((session) => {
      if (!Array.isArray(session.exercises) || session.exercises.length < 4 || session.exercises.length > 8) throw new Error('Chaque session doit avoir 4 à 8 exercices.');
      session.exercises.forEach((exercise) => {
        if (exercise.restSec < 30 || exercise.restSec > 240) throw new Error('restSec doit être entre 30 et 240.');
      });
    });
  });

  return parsed;
};

const extractJsonObject = (value: string) => {
  const trimmed = value.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('JSON introuvable dans la sortie du modèle.');
  return trimmed.slice(start, end + 1);
};

const getModelText = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return '';
  const response = payload as { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
  if (response.output_text) return response.output_text;

  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && content.text) chunks.push(content.text);
    }
  }

  return chunks.join('\n');
};

export async function POST(request: Request) {
  const openAiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!openAiKey) return NextResponse.json({ error: 'OPENAI_API_KEY manquant' }, { status: 500 });
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 500 });

  try {
    const payload = await request.json();
    const input = validateInput(payload);

    const aiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'developer',
            content: [
              {
                type: 'input_text',
                text:
                  'Tu es un coach sportif expert. Réponds en JSON STRICT uniquement (aucun markdown, aucun texte hors JSON). Programme réaliste, periodisé et adapté au profil. Respecte impérativement: weekPlans.length==weeks, chaque semaine contient exactement sessionsPerWeek sessions, 4..8 exercices par session, restSec 30..240. En cas de blessure/douleur, éviter les mouvements à risque et proposer alternatives. Ajoute des safetyNotes sans avis médical.'
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `Profil utilisateur:\n${JSON.stringify(input, null, 2)}`
              }
            ]
          }
        ]
      })
    });

    if (!aiResponse.ok) {
      const text = await aiResponse.text();
      throw new Error(`Erreur OpenAI: ${text}`);
    }

    const aiPayload = (await aiResponse.json()) as unknown;
    const text = getModelText(aiPayload);
    const plan = validatePlan(JSON.parse(extractJsonObject(text)));

    const bearer = request.headers.get('authorization')?.replace('Bearer ', '').trim();
    const supabaseForAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined }
    });

    let userId: string | null = null;
    if (bearer) {
      const {
        data: { user }
      } = await supabaseForAuth.auth.getUser(bearer);
      userId = user?.id ?? null;
    }

    const writeClient = userId ? supabaseForAuth : serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : supabaseForAuth;

    const { data, error } = await writeClient
      .from('training_plans')
      .insert({
        user_id: userId,
        title: plan.title,
        goal: input.profile.goal,
        level: input.profile.level,
        weeks: input.weeks,
        plan_json: plan
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, planId: data.id, plan });
  } catch (error) {
    return NextResponse.json(
      { error: 'Échec de génération du programme', details: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
