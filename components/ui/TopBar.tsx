'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const titleByPath: Record<string, string> = {
  '/dashboard': 'Accueil',
  '/scan': 'Scanner',
  '/wallet': 'Portefeuille',
  '/transactions': 'Historique'
};

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();

  const pageTitle = titleByPath[pathname] ?? 'FitQuest';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link className="text-lg font-bold tracking-wide text-violet-300" href="/dashboard">
          PawPass
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-300">{pageTitle}</span>
          <button
            aria-label="Se déconnecter"
            className="min-h-11 rounded-lg border border-slate-700 px-3 text-sm text-slate-200 transition hover:bg-slate-800"
            onClick={handleSignOut}
            type="button"
          >
            Sortir
          </button>
        </div>
      </div>
    </header>
  );
}
