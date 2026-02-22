import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

export const runtime = "nodejs";

const BUILD_TAG = "gen-v3-input_text-2026-02-21";

type Goal = "fat_loss" | "muscle_gain" | "strength" | "recomp" | "endurance" | "general_fitness";
type Level = "beginner" | "intermediate" | "advanced";

type ProgramInput = {
  weeks: number;
  profile: {
    goal: Goal;
    level: Level;
    weightKg?: number;
    heightCm?: number;
    age?: number;
    sex?: "female" | "male" | "other";
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
    method: "double_progression" | "rpe_based" | "linear" | "undulating";
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

const GOALS = new Set<Goal>(["fat_loss", "muscle_gain", "strength", "recomp", "endurance", "general_fitness"]);
const LEVELS = new Set<Level>(["beginner", "intermediate", "advanced"]);

const isStringArray = (value: unknown) =>
  Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);

const validateInput = (payload: unknown): ProgramInput => {
  if (!payload || typeof payload !== "object") throw new Error("Body JSON invalide.");
  const input = payload as Partial<ProgramInput>;
  if (typeof input.weeks !== "number" || input.weeks < 4 || input.weeks > 12) throw new Error("weeks doit être entre 4 et 12.");
  if (!input.profile || typeof input.profile !== "object") throw new Error("profile manquant.");

  const profile = input.profile as ProgramInput["profile"];
  if (!GOALS.has(profile.goal)) throw new Error("goal invalide.");
  if (!LEVELS.has(profile.level)) throw new Error("level invalide.");
  if (typeof profile.sessionsPerWeek !== "number" || profile.sessionsPerWeek < 2 || profile.sessionsPerWeek > 6)
    throw new Error("sessionsPerWeek doit être entre 2 et 6.");
  if (!isStringArray(profile.equipment) || profile.equipment.length === 0) throw new Error("equipment doit contenir au moins un élément.");
  if (
    profile.sessionDurationMin !== undefined &&
    (typeof profile.sessionDurationMin !== "number" || profile.sessionDurationMin < 20 || profile.sessionDurationMin > 120)
  )
    throw new Error("sessionDurationMin doit être entre 20 et 120.");

  const clean = (arr?: string[]) => (arr || []).map((s) => (s ?? "").trim()).filter(Boolean);

  return {
    weeks: input.weeks,
    profile: {
      ...profile,
      constraints: profile.constraints
        ? {
            injuries: typeof profile.constraints.injuries === "string" ? profile.constraints.injuries : undefined,
            dislikes: clean(profile.constraints.dislikes),
            focusWeakPoints: clean(profile.constraints.focusWeakPoints),
            preferExercises: clean(profile.constraints.preferExercises),
          }
        : undefined,
    },
  };
};

const validatePlan = (plan: unknown): Plan => {
  if (!plan || typeof plan !== "object") throw new Error("Plan JSON invalide.");
  const parsed = plan as Plan;

  if (typeof parsed.title !== "string" || !parsed.title.trim() || typeof parsed.overview !== "string" || !parsed.overview.trim()) {
    throw new Error("title/overview invalides.");
  }
  if (typeof parsed.weeks !== "number" || parsed.weeks < 4 || parsed.weeks > 12) throw new Error("weeks du plan invalide.");
  if (typeof parsed.sessionsPerWeek !== "number" || parsed.sessionsPerWeek < 2 || parsed.sessionsPerWeek > 6)
    throw new Error("sessionsPerWeek du plan invalide.");
  if (!Array.isArray(parsed.weekPlans) || parsed.weekPlans.length !== parsed.weeks)
    throw new Error("weekPlans doit avoir la même longueur que weeks.");
  if (!Array.isArray(parsed.safetyNotes) || parsed.safetyNotes.some((item) => typeof item !== "string" || !item.trim()))
    throw new Error("safetyNotes invalide.");

  parsed.weekPlans.forEach((week) => {
    if (!Array.isArray(week.sessions) || week.sessions.length !== parsed.sessionsPerWeek) throw new Error("Nombre de sessions hebdo invalide.");
    week.sessions.forEach((session) => {
      if (!Array.isArray(session.exercises) || session.exercises.length < 4 || session.exercises.length > 8)
        throw new Error("Chaque session doit avoir 4 à 8 exercices.");
      session.exercises.forEach((exercise) => {
        if (typeof exercise.restSec !== "number" || exercise.restSec < 30 || exercise.restSec > 240) {
          throw new Error("restSec doit être entre 30 et 240.");
        }
      });
    });
  });

  return parsed;
};

const extractJsonObject = (value: string) => {
  const trimmed = (value || "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("JSON introuvable dans la sortie du modèle.");
  return trimmed.slice(start, end + 1);
};

const getModelText = (response: any): string => {
  if (typeof response?.output_text === "string" && response.output_text.trim()) return response.output_text;

  const chunks: string[] = [];
  for (const item of response?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content?.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
};

type InputTextBlock = { type: "input_text"; text: string };
type InputMessage = { role: "developer" | "user"; content: InputTextBlock[] };

function toInputTextMessage(message: { role: "developer" | "user"; content: unknown }): InputMessage {
  if (Array.isArray(message.content)) {
    const text = message.content
      .map((it: any) => (typeof it?.text === "string" ? it.text : typeof it === "string" ? it : ""))
      .join("\n")
      .trim();
    return { role: message.role, content: [{ type: "input_text", text }] };
  }
  const text = typeof message.content === "string" ? message.content.trim() : "";
  return { role: message.role, content: [{ type: "input_text", text }] };
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) return NextResponse.json({ ok: false, error: "OPENAI_API_KEY manquant", build_tag: BUILD_TAG }, { status: 500 });
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.json({ ok: false, error: "Configuration Supabase manquante", build_tag: BUILD_TAG }, { status: 500 });

  const openai = new OpenAI({ apiKey: openaiKey });

  let diag: { build_tag: string; input_types: Array<{ role: string; types: string[] }> } = {
    build_tag: BUILD_TAG,
    input_types: [],
  };

  try {
    const payload = await request.json();
    const input = validateInput(payload);

    const inputMessages: InputMessage[] = [
      toInputTextMessage({
        role: "developer",
        content:
  "Tu es un coach sportif expert. Réponds en JSON STRICT uniquement (aucun markdown, aucun texte hors JSON). " +
  "IMPORTANT: Tout le contenu doit être en français (title, overview, focus, name, notes, warmup, finisher, cooldown, safetyNotes). Aucune phrase en anglais. " +
  "Programme réaliste, periodisé et adapté au profil. Respecte impérativement: weekPlans.length==weeks, " +
  "chaque semaine contient exactement sessionsPerWeek sessions, 4..8 exercices par session, restSec 30..240. " +
  "En cas de blessure/douleur, éviter les mouvements à risque et proposer alternatives. Ajoute des safetyNotes sans avis médical."
      }),
      toInputTextMessage({
        role: "user",
        content: `Profil utilisateur:\n${JSON.stringify(input, null, 2)}`,
      }),
    ];

    diag = {
      build_tag: BUILD_TAG,
      input_types: inputMessages.map((m) => ({
        role: m.role,
        types: (m.content || []).map((c) => (c as any)?.type ?? "(missing-type)"),
      })),
    };

    const hasInvalidTypes =
      inputMessages.some(
        (m) =>
          !Array.isArray(m.content) ||
          m.content.length === 0 ||
          m.content.some((c) => c.type !== "input_text" || typeof c.text !== "string" || c.text.trim().length === 0)
      ) || diag.input_types.some((m) => m.types.some((t) => t === "text" || t === "(missing-type)"));

    if (hasInvalidTypes) {
      return NextResponse.json(
        {
          ok: false,
          reason: "preflight_invalid_content_type",
          message: `[${BUILD_TAG}] preflight_invalid_content_type ${JSON.stringify(diag)}`,
          ...diag,
        },
        { status: 500 }
      );
    }

    const model = "gpt-4.1-mini";

    // IMPORTANT: en "strict" OpenAI exige que "required" contienne toutes les clés de "properties".
    // Donc nos "optionnels" deviennent "nullable" (ex: deloadWeek: integer|null) mais restent requis.
    const planSchema = {
      type: "object",
      additionalProperties: false,
      required: ["title", "overview", "weeks", "sessionsPerWeek", "progression", "weekPlans", "safetyNotes"],
      properties: {
        title: { type: "string", minLength: 3 },
        overview: { type: "string", minLength: 10 },
        weeks: { type: "integer", minimum: 4, maximum: 12 },
        sessionsPerWeek: { type: "integer", minimum: 2, maximum: 6 },
        progression: {
          type: "object",
          additionalProperties: false,
          required: ["method", "deloadWeek"],
          properties: {
            method: { type: "string", enum: ["double_progression", "rpe_based", "linear", "undulating"] },
            deloadWeek: { type: ["integer", "null"], minimum: 1, maximum: 12 },
          },
        },
        weekPlans: {
          type: "array",
          minItems: input.weeks,
          maxItems: input.weeks,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["week", "focus", "sessions"],
            properties: {
              week: { type: "integer", minimum: 1, maximum: 12 },
              focus: { type: "string", minLength: 3 },
              sessions: {
                type: "array",
                minItems: input.profile.sessionsPerWeek,
                maxItems: input.profile.sessionsPerWeek,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["dayIndex", "name", "warmup", "exercises", "finisher", "cooldown"],
                  properties: {
                    dayIndex: { type: "integer", minimum: 1, maximum: 7 },
                    name: { type: "string", minLength: 3 },
                    warmup: { type: "array", items: { type: "string" } },
                    exercises: {
                      type: "array",
                      minItems: 4,
                      maxItems: 8,
                      items: {
                        type: "object",
                        additionalProperties: false,
                        required: ["name", "sets", "reps", "intensity", "restSec", "notes"],
                        properties: {
                          name: { type: "string", minLength: 2 },
                          sets: { type: "integer", minimum: 1, maximum: 10 },
                          reps: { type: "string", minLength: 1 },
                          intensity: { type: "string", minLength: 1 },
                          restSec: { type: "integer", minimum: 30, maximum: 240 },
                          notes: { type: ["string", "null"] },
                        },
                      },
                    },
                    finisher: { type: ["array", "null"], items: { type: "string" } },
                    cooldown: { type: ["array", "null"], items: { type: "string" } },
                  },
                },
              },
            },
          },
        },
        safetyNotes: { type: "array", minItems: 2, items: { type: "string" } },
      },
    } as const;

    async function generateOnce(extraDevNote?: string): Promise<Plan> {
      const extra: InputMessage[] = extraDevNote
        ? [
            toInputTextMessage({
              role: "developer",
              content: extraDevNote,
            }),
          ]
        : [];

      const resp = await openai.responses.create({
        model,
        input: [...inputMessages, ...extra],
        text: {
          format: {
            type: "json_schema",
            name: "training_plan",
            schema: planSchema as any,
            strict: true,
          },
        },
      } as any);

      const out = getModelText(resp);

      let obj: unknown;
      try {
        obj = JSON.parse(out);
      } catch {
        obj = JSON.parse(extractJsonObject(out));
      }
      return validatePlan(obj);
    }

    let plan: Plan;
    try {
      plan = await generateOnce();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      plan = await generateOnce(
        `La sortie précédente est invalide: ${msg}. Corrige et renvoie UNIQUEMENT un JSON conforme au schéma. IMPORTANT: deloadWeek, notes, finisher, cooldown doivent être présents (peuvent être null). weekPlans=${input.weeks} et sessions par semaine=${input.profile.sessionsPerWeek}.`
      );
    }

    const bearer = request.headers.get("authorization")?.replace("Bearer ", "").trim();

    const supabaseForAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined },
    });

    let userId: string | null = null;
    if (bearer) {
      const { data } = await supabaseForAuth.auth.getUser(bearer);
      userId = data?.user?.id ?? null;
    }

    const writeClient = userId ? supabaseForAuth : serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : supabaseForAuth;

    const { data, error } = await writeClient
      .from("training_plans")
      .insert({
        user_id: userId,
        title: plan.title,
        goal: input.profile.goal,
        level: input.profile.level,
        weeks: input.weeks,
        plan_json: plan,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, planId: data.id, plan });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Échec de génération du programme",
        message: `[${BUILD_TAG}] ${error instanceof Error ? error.message : "Erreur inconnue"}`,
        details: error instanceof Error ? error.message : "Erreur inconnue",
        ...diag,
      },
      { status: 500 }
    );
  }
}