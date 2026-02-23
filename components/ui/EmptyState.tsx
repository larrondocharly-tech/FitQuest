import Link from 'next/link';

type EmptyStateProps = {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export default function EmptyState({ title, description, ctaLabel, ctaHref }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-5 text-center">
      <p className="text-base font-semibold text-slate-100">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
      {ctaLabel && ctaHref ? (
        <Link
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
          href={ctaHref}
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
