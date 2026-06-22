'use client';

import { Bank, Allocation, AppSettings } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { useMemo } from 'react';

interface BankCardProps {
  bank: Bank;
  allocations: Allocation[];
  settings: AppSettings;
  onClick?: () => void;
}

export function BankCard({ bank, allocations, settings, onClick }: BankCardProps) {
  const currentAmount = useMemo(() => {
    return allocations
      .filter((a) => a.bankId === bank.id)
      .reduce((sum, a) => sum + a.amount, 0);
  }, [allocations, bank.id]);

  const estimatedInterest = (currentAmount * bank.interestRate) / 100;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Card 
      onClick={onClick}
      className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98] duration-200"
      style={{ backgroundColor: bank.themeColor }}
    >
      <div className="bg-black/10 dark:bg-black/40 backdrop-blur-[2px] w-full h-full p-4">
        <CardContent className="p-0 flex flex-col gap-4 text-white">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-lg leading-tight tracking-tight drop-shadow-sm">
              {bank.name}
            </h3>
            <div className="bg-white/20 px-2 py-1 rounded-md text-xs font-bold backdrop-blur-md">
              {bank.interestRate}%
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium text-white/80 uppercase tracking-widest mb-1">
              Total Balance
            </p>
            <p className="text-2xl font-bold tracking-tight drop-shadow-md">
              {formatCurrency(currentAmount)}
            </p>
            <p className="text-xs text-white/70 mt-1 font-medium">
              + {formatCurrency(estimatedInterest)} / year
            </p>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
