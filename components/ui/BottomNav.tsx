'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const userNav: NavItem[] = [
  { href: '/scan', label: 'Scanner', icon: '📷' },
  { href: '/wallet', label: 'Portefeuille', icon: '💳' },
  { href: '/transactions', label: 'Historique', icon: '🧾' }
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950/95 px-2 py-2 md:hidden" aria-label="Navigation mobile">
      <ul className="mx-auto grid max-w-xl grid-cols-3 gap-2">
        {userNav.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                aria-label={item.label}
                className={`flex min-h-11 flex-col items-center justify-center rounded-xl px-2 py-1 text-xs font-medium transition ${
                  active ? 'bg-violet-600/30 text-violet-200' : 'text-slate-400 hover:bg-slate-800'
                }`}
                href={item.href}
              >
                <span aria-hidden="true" className="text-sm">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
