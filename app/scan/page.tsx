'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import BottomNav from '@/components/ui/BottomNav';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

const donationOptions = [0, 50, 100] as const;

function parseFrenchAmount(raw: string): number | null {
  const normalized = raw.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.]/g, '');
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > 5000) return null;
  return Math.round(value * 100) / 100;
}

export default function ScanPage() {
  const [step, setStep] = useState(1);
  const [merchantName, setMerchantName] = useState('Boutique PawPass');
  const [amountInput, setAmountInput] = useState('');
  const [donationPct, setDonationPct] = useState<number>(50);
  const [success, setSuccess] = useState(false);

  const amount = useMemo(() => parseFrenchAmount(amountInput), [amountInput]);
  const cashback = amount ? Number((amount * 0.1).toFixed(2)) : 0;
  const donation = Number((cashback * (donationPct / 100)).toFixed(2));
  const walletGain = Number((cashback - donation).toFixed(2));
  const newBalance = Number((24.8 + walletGain).toFixed(2));

  const goNext = () => {
    if (step === 2 && !amount) return;
    if (step < 4) setStep((value) => value + 1);
    if (step === 4) setSuccess(true);
  };

  const resetFlow = () => {
    setStep(1);
    setAmountInput('');
    setDonationPct(50);
    setSuccess(false);
  };

  if (success) {
    return (
      <section className="space-y-4 pb-6">
        <Card title="Paiement validé ✅" subtitle="Tout est enregistré.">
          <div className="space-y-2 text-sm">
            <p className="rounded-lg bg-slate-800/60 p-3">+{walletGain.toFixed(2)}€ cashback</p>
            <p className="rounded-lg bg-slate-800/60 p-3">+{donation.toFixed(2)}€ don</p>
            <p className="rounded-lg bg-slate-800/60 p-3">Solde: {newBalance.toFixed(2)}€</p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link href="/transactions">
              <Button fullWidth type="button" variant="secondary">
                Voir historique
              </Button>
            </Link>
            <Button fullWidth onClick={resetFlow} type="button">
              Scanner à nouveau
            </Button>
          </div>
        </Card>
        <BottomNav />
      </section>
    );
  }

  return (
    <section className="space-y-4 pb-6">
      <Card title="Scan guidé" subtitle={`Étape ${step}/4`}>
        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Scannez le QR du marchand pour commencer.</p>
            <label className="block text-sm text-slate-300" htmlFor="merchant-name">
              Marchand détecté
            </label>
            <input
              className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-400"
              id="merchant-name"
              onChange={(event) => setMerchantName(event.target.value)}
              value={merchantName}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <label className="block text-sm text-slate-300" htmlFor="amount">
              Montant (€)
            </label>
            <input
              aria-label="Montant en euros"
              className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-400"
              id="amount"
              inputMode="decimal"
              onChange={(event) => setAmountInput(event.target.value)}
              pattern="[0-9]*[.,]?[0-9]*"
              placeholder="Ex: 18,50"
              value={amountInput}
            />
            {!amountInput || amount ? (
              <p className="text-xs text-slate-400">Format FR accepté: 18,50</p>
            ) : (
              <p className="text-xs text-red-300">Montant invalide. Entrez une valeur entre 0,01€ et 5000€.</p>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Donation du cashback</p>
            <div className="grid grid-cols-3 gap-2">
              {donationOptions.map((option) => (
                <button
                  aria-label={`Donation ${option}%`}
                  className={`min-h-11 rounded-xl border text-sm font-semibold ${
                    donationPct === option
                      ? 'border-violet-400 bg-violet-600/30 text-violet-100'
                      : 'border-slate-700 bg-slate-900 text-slate-300'
                  }`}
                  key={option}
                  onClick={() => setDonationPct(option)}
                  type="button"
                >
                  {option}%
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">Par défaut: 50% (modifiable à chaque achat).</p>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-2 text-sm text-slate-200">
            <p>Marchand: {merchantName}</p>
            <p>Achat: {amount?.toFixed(2) ?? '0.00'}€</p>
            <p>Cashback: +{cashback.toFixed(2)}€</p>
            <p>Don: +{donation.toFixed(2)}€</p>
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          <Button onClick={() => setStep((value) => Math.max(1, value - 1))} type="button" variant="secondary">
            Retour
          </Button>
          <Button fullWidth onClick={goNext} type="button">
            {step === 4 ? 'Valider' : 'Continuer'}
          </Button>
        </div>
      </Card>
      <BottomNav />
    </section>
  );
}
