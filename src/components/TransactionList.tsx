'use client';

import { usePocketRouterStore } from '@/hooks/usePocketRouterStore';
import { Transaction, TransactionType } from '@/types';
import { ArrowUp, ArrowDown, ArrowLeftRight, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface TransactionListProps {
  pocketId: string;
}

export function TransactionList({ pocketId }: TransactionListProps) {
  const { transactions, banks, settings } = usePocketRouterStore();

  const pocketTransactions = useMemo(() => {
    return transactions.filter((tx) => tx.pocketId === pocketId);
  }, [transactions, pocketId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTxDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const getTxDetails = (tx: Transaction) => {
    const bank = banks.find((b) => b.id === tx.bankId);
    const toBank = tx.toBankId ? banks.find((b) => b.id === tx.toBankId) : null;
    const bankName = bank ? bank.name : 'Deleted Bank';
    const toBankName = toBank ? toBank.name : 'Deleted Bank';

    switch (tx.type) {
      case 'deposit':
        return {
          title: 'Deposit',
          description: `To ${bankName}`,
          icon: ArrowUp,
          iconColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/30',
          amountPrefix: '+',
          amountColor: 'text-emerald-600 dark:text-emerald-400',
        };
      case 'withdraw':
        return {
          title: 'Withdraw',
          description: `From ${bankName}`,
          icon: ArrowDown,
          iconColor: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/30',
          amountPrefix: '-',
          amountColor: 'text-rose-600 dark:text-rose-400',
        };
      case 'transfer':
        return {
          title: 'Transfer',
          description: `From ${bankName} to ${toBankName}`,
          icon: ArrowLeftRight,
          iconColor: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/30',
          amountPrefix: '',
          amountColor: 'text-blue-600 dark:text-blue-400',
        };
    }
  };

  if (pocketTransactions.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center border border-zinc-100 dark:border-zinc-800">
          <History className="w-5 h-5 text-zinc-400" />
        </div>
        <div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
            No activity yet
          </p>
          <p className="text-xs text-zinc-500 max-w-[240px] mt-1">
            Allocations updates and transfers will show up here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {pocketTransactions.map((tx) => {
        const details = getTxDetails(tx);
        const Icon = details.icon;

        return (
          <div
            key={tx.id}
            className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3.5">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", details.iconColor)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {details.title}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  {details.description}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className={cn("text-sm font-bold tracking-tight", details.amountColor)}>
                {details.amountPrefix}{formatCurrency(tx.amount)}
              </span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                {formatTxDate(tx.createdAt)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
