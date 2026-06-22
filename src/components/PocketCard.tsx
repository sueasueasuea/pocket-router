'use client';

import { Pocket, Allocation, AppSettings } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useMemo } from 'react';

interface PocketCardProps {
  pocket: Pocket;
  allocations: Allocation[];
  settings: AppSettings;
  onClick?: () => void;
}

export function PocketCard({ pocket, allocations, settings, onClick }: PocketCardProps) {
  const currentAmount = useMemo(() => {
    return allocations
      .filter((a) => a.pocketId === pocket.id)
      .reduce((sum, a) => sum + a.amount, 0);
  }, [allocations, pocket.id]);

  const progress = pocket.targetAmount && pocket.targetAmount > 0
    ? Math.min(100, Math.round((currentAmount / pocket.targetAmount) * 100))
    : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card 
      onClick={onClick}
      className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98] duration-200"
    >
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl shadow-inner">
              {pocket.icon}
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 leading-none mb-1">
                {pocket.name}
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                {formatCurrency(currentAmount)}
                {pocket.targetAmount ? ` / ${formatCurrency(pocket.targetAmount)}` : ''}
              </p>
            </div>
          </div>
        </div>

        {pocket.targetAmount !== undefined && pocket.targetAmount > 0 && (
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-zinc-100 dark:bg-zinc-800" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
