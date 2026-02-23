import type { Metadata } from 'next';
import './globals.css';
import TopBar from '@/components/ui/TopBar';

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
        <TopBar />
        <main className="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-8">{children}</main>
      </body>
    </html>
  );
}
