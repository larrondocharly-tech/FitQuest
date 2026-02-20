import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createMiddlewareSupabase } from '@/lib/supabase/middleware';

const protectedPrefixes = ['/dashboard', '/onboarding', '/app'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = pathname.startsWith('/auth');

  const { supabase, res } = createMiddlewareSupabase(request);
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return res;
}

export const config = {
  matcher: ['/auth', '/dashboard/:path*', '/onboarding/:path*', '/app/:path*']
};
