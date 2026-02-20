'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      router.replace(session ? '/dashboard' : '/auth');
    };

    checkSession();
  }, [router]);

  return <p className="text-slate-300">Chargement de votre aventure...</p>;
}
