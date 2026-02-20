# AGENTS.md — FitQuest (from scratch)

## Objective
Build a clean Next.js (App Router) web app named "FitQuest" with Supabase Auth (email+password) and protected routes.

## Hard rules
- Do NOT call Supabase REST auth endpoints directly (NO fetch to /auth/v1/token).
- Use supabase-js v2 for auth: signInWithPassword, signUp, signOut, getSession, onAuthStateChange.
- Keep changes minimal and consistent. Prefer simple file structure.
- Ensure .env.local is documented and uses NEXT_PUBLIC_ keys only on client.

## Tech choices
- Next.js latest stable (App Router)
- Tailwind CSS
- Supabase JS v2
- Middleware for route protection (redirect to /auth)

## Deliverables
- Working app with:
  - /auth page (tabs: login/signup)
  - /dashboard protected page
  - /onboarding protected page (simple placeholder)
  - Navbar with logout when logged in
  - Supabase client in /lib/supabaseClient.ts (or .js if JS)
- README with setup steps
- Basic profile table + trigger SQL in /supabase (optional but included)

## Definition of done
- `npm run dev` works
- Login/signup works against Supabase project
- No CORS errors in browser console
- Visiting /dashboard without session redirects to /auth