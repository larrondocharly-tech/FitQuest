export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    app: "FitQuest",
    version: "2026-02-21-openai-fix",
    timestamp: new Date().toISOString(),
    env: process.env.VERCEL_ENV || "unknown",
  });
}
