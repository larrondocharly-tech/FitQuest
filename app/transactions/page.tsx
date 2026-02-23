import BottomNav from '@/components/ui/BottomNav';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';

const txList = [
  { id: '1', merchant: 'Boulangerie Jo', date: 'Aujourd’hui', cashback: 1.2, donation: 0.6, amount: 12 },
  { id: '2', merchant: 'Pharmacie Centrale', date: 'Hier', cashback: 2.5, donation: 1.25, amount: 25 }
];

export default function TransactionsPage() {
  return (
    <section className="space-y-4 pb-6">
      <Card title="Historique" subtitle="Transactions récentes">
        {txList.length ? (
          <ul className="space-y-2">
            {txList.map((tx) => (
              <li className="rounded-xl border border-slate-800 bg-slate-900/60 p-3" key={tx.id}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-100">{tx.merchant}</p>
                  <span className="text-xs text-slate-400">{tx.date}</span>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-slate-300">
                  <p>Achat: {tx.amount.toFixed(2)}€</p>
                  <p>Cashback: +{tx.cashback.toFixed(2)}€</p>
                  <p>Don: +{tx.donation.toFixed(2)}€</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Aucune transaction" description="Scannez un premier achat pour voir l’historique." ctaHref="/scan" ctaLabel="Scanner" />
        )}
      </Card>
      <BottomNav />
    </section>
  );
}
