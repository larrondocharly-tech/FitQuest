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
- `/onboarding` : création du héros + préférences d'entraînement
- `/plan` : plan d'entraînement recommandé (génération + régénération)

## Supabase SQL (profiles + workout_plans + RLS)

1. Ouvrez le SQL Editor de votre projet Supabase.
2. Copiez-collez le contenu de `supabase/schema.sql`.
3. Exécutez le script.

Cela crée/met à jour :
- `public.profiles` avec préférences d'entraînement (`training_level`, `goal`, `location`, `days_per_week`, `equipment`)
- `public.workout_plans` pour stocker le plan actif et l'historique
- les policies RLS (select/insert/update sur ses propres lignes)
- le trigger `handle_new_user()` sur `auth.users`
- les triggers `updated_at`
- un index unique partiel pour garantir un seul plan actif par utilisateur

## Logique du générateur de plan

Le générateur se trouve dans `lib/plan/generatePlan.ts` et applique :

- Split par jours/semaine :
  - `3` => full body
  - `4` => upper/lower
  - `5` => push/pull/legs + upper + accessory
  - `6` => push/pull/legs x2
- Choix d'exercices selon `location` et `equipment` (gym vs home)
- Adaptation des reps/sets selon `goal` (`strength`, `muscle`, `fat_loss`, `general`)
- Mapping Warrior : orientation par défaut sur muscle/strength (avec override possible via goal)

## Notes

- Auth côté client via `@supabase/supabase-js`.
- Clients SSR/middleware via `@supabase/ssr`.
- Middleware vérifie `supabase.auth.getUser()` (pas `getSession()`) et redirige selon l'état auth.
- Aucun appel direct du navigateur vers les endpoints Auth Supabase.

## Fix CORS cache issues

Si vous voyez encore des erreurs CORS après les changements d'authentification :

1. Stop dev server
2. Delete .next folder
3. Restart npm run dev

Exemple :

```bash
rm -rf .next
npm run dev
```
