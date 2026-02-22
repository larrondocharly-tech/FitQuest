'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const finishAuth = async () => {
      await supabase.auth.getSession();
      router.replace('/dashboard');
    };
    finishAuth();
  }, [router]);

  return <p>Connexion en cours...</p>;
}