import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const key = process.env.OPENAI_API_KEY;

  return NextResponse.json({
    hasOpenAIKey: Boolean(key),
    length: key?.length ?? 0,
  });
}
