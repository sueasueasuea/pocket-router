'use client';

import { usePocketRouterStore } from '@/hooks/usePocketRouterStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo } from 'react';
import { Wallet, TrendingUp } from 'lucide-react';

export function DashboardSummary() {
  const { banks, allocations, settings } = usePocketRouterStore();

  const { totalBalance, estimatedInterest } = useMemo(() => {
    let total = 0;
    let interest = 0;

    allocations.forEach(allocation => {
      total += allocation.amount;
      const bank = banks.find(b => b.id === allocation.bankId);
      if (bank) {
        interest += (allocation.amount * bank.interestRate) / 100;
      }
    });

    return { totalBalance: total, estimatedInterest: interest };
  }, [allocations, banks]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Total Balance Card */}
      <Card className="bg-gradient-to-br from-primary/90 to-primary text-primary-foreground border-none shadow-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Wallet className="w-24 h-24" />
        </div>
        <CardHeader className="pb-2 relative z-10">
          <CardTitle className="text-sm font-medium text-primary-foreground/80 uppercase tracking-wider">
            Total Net Worth
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-4xl font-bold tracking-tight">
            {formatCurrency(totalBalance)}
          </div>
        </CardContent>
      </Card>

      {/* Estimated Interest Card */}
      <Card className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Est. Annual Interest</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                +{formatCurrency(estimatedInterest)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
