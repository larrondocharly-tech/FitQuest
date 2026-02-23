import BottomNav from '@/components/ui/BottomNav';
import Card from '@/components/ui/Card';

export default function WalletPage() {
  return (
    <section className="space-y-4 pb-6">
      <Card title="Portefeuille" subtitle="Votre solde et vos derniers mouvements.">
        <p className="text-3xl font-bold text-violet-200">24,80€</p>
        <p className="mt-1 text-sm text-slate-400">Disponible maintenant</p>
      </Card>

      <Card title="Ce mois-ci">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between rounded-lg bg-slate-800/60 p-3">
            <span>Cashback cumulé</span>
            <strong>+12,40€</strong>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-800/60 p-3">
            <span>Dons versés</span>
            <strong>+6,20€</strong>
          </div>
        </div>
      </Card>
      <BottomNav />
    </section>
  );
}
