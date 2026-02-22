"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const finishAuth = async () => {
      try {
        const code = searchParams.get("code");

        if (code && typeof supabase.auth.exchangeCodeForSession === "function") {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error("[auth/callback] exchangeCodeForSession error", exchangeError.message);
          }
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("[auth/callback] getSession error", sessionError.message);
        }

        console.log("[auth/callback] done", { hasSession: !!data.session });
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
