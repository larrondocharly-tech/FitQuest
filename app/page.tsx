'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';


export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      router.replace(user ? '/dashboard' : '/auth');
    };

    checkUser();
  }, [router]);

  return <p className="text-slate-300">Chargement de votre aventure...</p>;
}
