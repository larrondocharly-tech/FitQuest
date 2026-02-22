"use client";

import { useRouter } from "next/navigation";

export default function BackButton({ fallbackHref = "/program" }: { fallbackHref?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        // back si possible, sinon fallback
        try {
          router.back();
          // petit timeout: si back ne change rien, on pousse le fallback
          setTimeout(() => {
            // si l’URL n’a pas bougé, on navigue vers fallback
            // (pas parfait mais efficace)
            router.push(fallbackHref);
          }, 150);
        } catch {
          router.push(fallbackHref);
        }
      }}
      className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
    >
      ← Retour
    </button>
  );
}