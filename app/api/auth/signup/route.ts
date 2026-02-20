import { NextResponse } from 'next/server';

type AuthPayload = {
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { error: { message: 'Supabase environment variables are not configured.' } },
      { status: 400 }
    );
  }

  let payload: AuthPayload;

  try {
    payload = (await request.json()) as AuthPayload;
  } catch {
    return NextResponse.json(
      { error: { message: 'Invalid JSON body.' } },
      { status: 400 }
    );
  }

  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!email || !password) {
    return NextResponse.json(
      { error: { message: 'Email and password are required.' } },
      { status: 400 }
    );
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  return NextResponse.json(data, { status: response.status });
}
