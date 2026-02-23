import type { ReactNode } from 'react';

type CardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export default function Card({ title, subtitle, children, className = '' }: CardProps) {
  return (
    <section className={`rounded-2xl border border-slate-800 bg-quest-card/90 p-4 shadow-sm ${className}`}>
      {title ? <h3 className="text-lg font-semibold text-slate-100">{title}</h3> : null}
      {subtitle ? <p className="mb-3 mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      {children}
    </section>
  );
}
