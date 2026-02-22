"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// ✅ Empêche le pré-render statique (fix Vercel prerender error)
export const dynamic = "force-dynamic";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const finishAuth = async () => {
      try {
        const code = searchParams.get("code");

        // ✅ PKCE (?code=...) — selon la version supabase-js
        if (code && typeof (supabase.auth as any).exchangeCodeForSession === "function") {
          const { error: exchangeError } = await (supabase.auth as any).exchangeCodeForSession(code);
          if (exchangeError) {
            console.error("[auth/callback] exchangeCodeForSession error", exchangeError.message);
          }
        }

        // ✅ Implicit / hash + initialise session
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("[auth/callback] getSession error", sessionError.message);
        }

        console.log("[auth/callback] done", { hasSession: !!data?.session });
      } catch (err) {
        console.error("[auth/callback] fatal", err);
      } finally {
        router.replace("/dashboard");
      }
    };

    finishAuth();
  }, [router, searchParams]);

  return <p>Connexion en cours...</p>;
}

export default function CallbackPage() {
  // ✅ Obligatoire pour éviter les erreurs de build/prerender avec useSearchParams
  return (
    <Suspense fallback={<p>Connexion en cours...</p>}>
      <CallbackInner />
    </Suspense>
  );
}