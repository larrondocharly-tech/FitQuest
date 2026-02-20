import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FitQuest',
  description: 'FitQuest auth MVP with Supabase'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <header className="border-b border-slate-800 bg-slate-950/60 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center px-4 py-4">
            <h1 className="text-xl font-bold tracking-wide text-violet-300">FitQuest</h1>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
