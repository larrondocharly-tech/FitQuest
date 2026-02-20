import { NextResponse } from 'next/server';

type AuthPayload = {
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return NextResponse.json(
        {
          error: 'Supabase env missing',
          details: { hasUrl: !!SUPABASE_URL, hasKey: !!SUPABASE_ANON_KEY }
        },
        { status: 500 }
      );
    }

    let payload: AuthPayload;

    try {
      payload = (await request.json()) as AuthPayload;
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body', message: 'Body must be valid JSON.' },
        { status: 400 }
      );
    }

    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    const password = typeof payload.password === 'string' ? payload.password : '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Invalid request body', message: 'Email and password must be non-empty strings.' },
        { status: 400 }
      );
    }

    const normalizedSupabaseUrl = SUPABASE_URL.replace(/\/+$/, '');
    const response = await fetch(`${normalizedSupabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const raw = await response.text();
    let data: unknown = {};

    if (raw) {
      try {
        data = JSON.parse(raw) as unknown;
      } catch {
        data = { error: 'Upstream returned non-JSON response', raw };
      }
    }

    return NextResponse.json(data, { status: response.status });
  } catch (e) {
    console.error('[auth-proxy login] fail:', e);
    return NextResponse.json(
      {
        error: 'Proxy failed',
        message: String((e as Error | undefined)?.message ?? e),
        stack: process.env.NODE_ENV === 'development' ? String((e as Error | undefined)?.stack ?? '') : undefined
      },
      { status: 500 }
    );
  }
}
