import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type PlanSession = {
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
};

type PlanJson = {
  weekPlans?: Array<{
    week: number;
    sessions: PlanSession[];
  }>;
};

type StartWorkoutPayload = {
  planId?: string;
  week?: number;
  dayIndex?: number;
};

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ ok: false, error: 'Configuration Supabase manquante' }, { status: 500 });
  }

  const bearer = request.headers.get('authorization')?.replace('Bearer ', '').trim();
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser(bearer);

  if (!user?.id) {
    return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });
  }

  const body = (await request.json()) as StartWorkoutPayload;
  const planId = typeof body.planId === 'string' ? body.planId : '';
  const week = typeof body.week === 'number' ? body.week : NaN;
  const dayIndex = typeof body.dayIndex === 'number' ? body.dayIndex : NaN;

  if (!planId || Number.isNaN(week) || Number.isNaN(dayIndex)) {
    return NextResponse.json({ ok: false, error: 'Paramètres invalides' }, { status: 400 });
  }

  const { data: planRow, error: planError } = await supabase
    .from('training_plans')
    .select('plan_json')
    .eq('id', planId)
    .eq('user_id', user.id)
    .maybeSingle<{ plan_json: PlanJson }>();

  if (planError) {
    return NextResponse.json({ ok: false, error: planError.message }, { status: 400 });
  }

  if (!planRow?.plan_json) {
    return NextResponse.json({ ok: false, error: 'Plan introuvable' }, { status: 404 });
  }

  const weekPlan = planRow.plan_json.weekPlans?.find((item) => item.week === week);
  const session = weekPlan?.sessions.find((item) => item.dayIndex === dayIndex);

  if (!session) {
    return NextResponse.json({ ok: false, error: 'Séance introuvable pour ce plan' }, { status: 404 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: user.id,
      plan_id: planId,
      week,
      day_index: dayIndex,
      session_json: session,
      status: 'in_progress',
      started_at: new Date().toISOString()
    })
    .select('id')
    .single<{ id: string }>();

  if (insertError) {
    return NextResponse.json({ ok: false, error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, sessionId: inserted.id });
}
