# FitQuest

MVP Next.js + Supabase Auth avec routes protégées en SSR cookie-based.

## Variables d'environnement

Créez un fichier `.env.local` **à la racine du projet** (au même niveau que `package.json`) à partir du template :

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
- `/onboarding` : création du héros

## Supabase SQL (profiles + RLS)

1. Ouvrez le SQL Editor de votre projet Supabase.
2. Copiez-collez le contenu de `supabase/schema.sql`.
3. Exécutez le script.

Cela crée :
- `public.profiles`
- les policies RLS (select/insert/update sur son propre profil)
- le trigger `handle_new_user()` sur `auth.users`
- le trigger `updated_at`

## Notes

- Auth côté client via `@supabase/supabase-js`.
- Clients SSR/middleware via `@supabase/ssr`.
- Middleware vérifie `supabase.auth.getUser()` (pas `getSession()`) et redirige selon l'état auth.
- Aucun appel `fetch` direct vers `https://*.supabase.co/auth/v1/token`.
