'use client';

import { useState, useEffect, useRef } from 'react';
import { Bank } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ArrowRight, Landmark, Sparkles } from 'lucide-react';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromBank: Bank | null;
  toBank: Bank | null;
  maxAmount: number;
  currency: string;
  onConfirm: (amount: number) => void;
}

export function TransferDialog({
  open,
  onOpenChange,
  fromBank,
  toBank,
  maxAmount,
  currency,
  onConfirm,
}: TransferDialogProps) {
  const [amount, setAmount] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setAmount('');
      setShowSuccess(false);
      // Focus input on open
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const numAmount = parseFloat(amount) || 0;
  const isValid = numAmount > 0 && numAmount <= maxAmount;
  const percentage = maxAmount > 0 ? Math.round((numAmount / maxAmount) * 100) : 0;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleQuickFill = (pct: number) => {
    const val = Math.floor(maxAmount * (pct / 100));
    setAmount(val.toString());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setShowSuccess(true);
    setTimeout(() => {
      onConfirm(numAmount);
      setShowSuccess(false);
    }, 600);
  };

  if (!fromBank || !toBank) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-center">Transfer Money</DialogTitle>
          <DialogDescription className="text-center">
            Move funds between bank accounts
          </DialogDescription>
        </DialogHeader>

        {/* Visual Transfer Flow */}
        <div className="flex items-center justify-center gap-3 py-4">
          {/* From Bank */}
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md transition-transform"
              style={{ backgroundColor: fromBank.themeColor }}
            >
              {fromBank.logoUrl ? (
                <img src={fromBank.logoUrl} alt={fromBank.name} className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <Landmark className="w-5 h-5 text-white" />
              )}
            </div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-center leading-tight max-w-[80px] truncate">
              {fromBank.name}
            </span>
            <span className="text-[10px] font-semibold text-zinc-400">
              {formatCurrency(maxAmount)}
            </span>
          </div>

          {/* Arrow */}
          <div className={`flex flex-col items-center gap-1 transition-all duration-300 ${showSuccess ? 'scale-125' : ''}`}>
            {showSuccess ? (
              <Sparkles className="w-6 h-6 text-emerald-500 animate-pulse" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-zinc-400" />
              </div>
            )}
            {numAmount > 0 && (
              <span className={`text-xs font-bold transition-colors duration-300 ${showSuccess ? 'text-emerald-500' : 'text-primary'}`}>
                {formatCurrency(numAmount)}
              </span>
            )}
          </div>

          {/* To Bank */}
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md transition-transform"
              style={{ backgroundColor: toBank.themeColor }}
            >
              {toBank.logoUrl ? (
                <img src={toBank.logoUrl} alt={toBank.name} className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <Landmark className="w-5 h-5 text-white" />
              )}
            </div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-center leading-tight max-w-[80px] truncate">
              {toBank.name}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="transfer-amount">Amount</Label>
            <div className="relative">
              <Input
                ref={inputRef}
                id="transfer-amount"
                type="number"
                step="1"
                min="1"
                max={maxAmount}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg font-bold pr-16"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
                / {formatCurrency(maxAmount)}
              </span>
            </div>
            {numAmount > maxAmount && (
              <p className="text-xs text-rose-500 font-medium">
                Amount exceeds available balance
              </p>
            )}
          </div>

          {/* Quick Fill Buttons */}
          <div className="flex gap-2">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleQuickFill(pct)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all duration-200 ${
                  percentage === pct
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-primary/50 hover:text-primary'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Progress bar showing percentage */}
          {numAmount > 0 && numAmount <= maxAmount && (
            <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, percentage)}%` }}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={!isValid || showSuccess}
              className="w-full rounded-full"
            >
              {showSuccess ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-spin" /> Transferred!
                </span>
              ) : (
                'Confirm Transfer'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
