# FitQuest

MVP Next.js + Supabase Auth avec routes protégées.

## Variables d'environnement

Créez un fichier `.env.local` à partir du template :

```bash
cp .env.example .env.local
```

Puis renseignez :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Installation

```bash
npm install
npm run dev
```

L'application sera disponible sur `http://localhost:3000`.

## Routes

- `/auth` : connexion / inscription
- `/dashboard` : page protégée utilisateur connecté
- `/onboarding` : page protégée placeholder

## Notes

- Auth côté client via `@supabase/supabase-js` (`signInWithPassword`, `signUp`, `signOut`).
- Middleware protège les routes privées et redirige les utilisateurs connectés depuis `/auth`.
- Aucun appel `fetch` direct vers `https://*.supabase.co/auth/v1/token`.
