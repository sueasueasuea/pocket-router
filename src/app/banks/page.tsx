'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePocketRouterStore } from '@/hooks/usePocketRouterStore';
import { Bank } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { Card, CardContent } from '@/components/ui/card';
import {
  Plus,
  Landmark,
  Edit2,
  Trash2,
  TrendingUp,
  GripVertical,
} from 'lucide-react';
import { DraggableListItem } from '@/components/DraggableListItem';

const PRESET_COLORS = [
  { name: 'Emerald', value: '#10b981' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Fuchsia', value: '#d946ef' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Slate', value: '#64748b' },
];

export default function ManageBanksPage() {
  const {
    banks,
    allocations,
    settings,
    addBank,
    updateBank,
    deleteBank,
    reorderBanks,
  } = usePocketRouterStore();

  const [mounted, setMounted] = useState(false);

  // Add bank dialog
  const [isAddBankOpen, setIsAddBankOpen] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankInterestRate, setBankInterestRate] = useState('');
  const [bankLogoUrl, setBankLogoUrl] = useState('');
  const [bankThemeColor, setBankThemeColor] = useState(PRESET_COLORS[0].value);

  // Edit bank dialog
  const [isEditBankOpen, setIsEditBankOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);

  // Delete confirmation
  const [deletingBank, setDeletingBank] = useState<Bank | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getBankTotal = (bankId: string) => {
    return allocations
      .filter((a) => a.bankId === bankId)
      .reduce((sum, a) => sum + a.amount, 0);
  };

  const getBankPocketCount = (bankId: string) => {
    return new Set(
      allocations.filter((a) => a.bankId === bankId).map((a) => a.pocketId)
    ).size;
  };

  // Sort banks by user-defined order, fall back to creation time.
  const sortedBanks = useMemo(
    () =>
      [...banks].sort((a, b) => {
        const ao = a.order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.order ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }),
    [banks]
  );

  const handleReorderBank = useCallback(
    async (fromId: string, toIndex: number) => {
      const ids = sortedBanks.map((b) => b.id);
      const fromIndex = ids.indexOf(fromId);
      if (fromIndex === -1) return;
      const clamped = Math.max(0, Math.min(toIndex, ids.length));
      if (clamped === fromIndex || clamped === fromIndex + 1) return;
      const next = [...ids];
      next.splice(fromIndex, 1);
      const adjusted = clamped > fromIndex ? clamped - 1 : clamped;
      next.splice(adjusted, 0, fromId);
      await reorderBanks(next);
    },
    [sortedBanks, reorderBanks]
  );

  const resetBankForm = () => {
    setBankName('');
    setBankInterestRate('');
    setBankLogoUrl('');
    setBankThemeColor(PRESET_COLORS[0].value);
    setEditingBank(null);
  };

  const handleAddBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !bankInterestRate) return;

    addBank({
      id: crypto.randomUUID(),
      name: bankName,
      interestRate: parseFloat(bankInterestRate),
      logoUrl: bankLogoUrl || undefined,
      themeColor: bankThemeColor,
      createdAt: new Date().toISOString(),
    });

    resetBankForm();
    setIsAddBankOpen(false);
  };

  const openEditBankDialog = (bank: Bank) => {
    setEditingBank(bank);
    setBankName(bank.name);
    setBankInterestRate(bank.interestRate.toString());
    setBankLogoUrl(bank.logoUrl || '');
    setBankThemeColor(bank.themeColor);
    setIsEditBankOpen(true);
  };

  const handleEditBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBank || !bankName || !bankInterestRate) return;

    updateBank(editingBank.id, {
      name: bankName,
      interestRate: parseFloat(bankInterestRate),
      logoUrl: bankLogoUrl || undefined,
      themeColor: bankThemeColor,
    });

    resetBankForm();
    setIsEditBankOpen(false);
  };

  const handleDeleteBank = (bank: Bank) => {
    setDeletingBank(bank);
  };

  const confirmDeleteBank = () => {
    if (deletingBank) {
      deleteBank(deletingBank.id);
      setDeletingBank(null);
    }
  };

  if (!mounted) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <main className="flex flex-col min-h-full bg-zinc-50 dark:bg-zinc-950 pb-28">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800 w-full">
        <div className="max-w-4xl mx-auto w-full px-6 pt-12 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Banks
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              {banks.length} bank{banks.length !== 1 ? 's' : ''} registered
            </p>
          </div>
          <Button
            onClick={() => {
              resetBankForm();
              setIsAddBankOpen(true);
            }}
            size="icon"
            className="rounded-full"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 w-full max-w-4xl mx-auto px-6 pt-6 flex flex-col gap-4">
        {banks.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Landmark className="w-7 h-7 text-zinc-400" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                No banks yet
              </p>
              <p className="text-xs text-zinc-500 max-w-[240px] mt-1">
                Add your bank accounts to start allocating money across pockets.
              </p>
            </div>
            <Button
              size="sm"
              className="mt-2 rounded-full"
              onClick={() => {
                resetBankForm();
                setIsAddBankOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add First Bank
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedBanks.map((bank, index) => {
              const total = getBankTotal(bank.id);
              const pocketCount = getBankPocketCount(bank.id);
              const estimatedInterest = (total * bank.interestRate) / 100;

              return (
                <DraggableListItem
                  key={bank.id}
                  id={bank.id}
                  index={index}
                  onReorder={handleReorderBank}
                  className="rounded-2xl"
                >
                  <Card
                    className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-200"
                    style={{ backgroundColor: bank.themeColor }}
                  >
                    <div className="bg-black/10 dark:bg-black/40 backdrop-blur-[2px] w-full h-full">
                      <CardContent className="p-0 text-white">
                        <div className="flex items-stretch">
                          {/* Bank info */}
                          <div className="flex-1 p-5">
                            <div className="flex items-start justify-between mb-3 gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {/* Bank icon — logo if available, otherwise Landmark. */}
                                <div
                                  aria-hidden
                                  className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20 backdrop-blur-sm shadow-sm flex-shrink-0"
                                >
                                  {bank.logoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={bank.logoUrl}
                                      alt=""
                                      className="w-6 h-6 rounded-full object-cover bg-white"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <Landmark className="w-5 h-5 text-white drop-shadow" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-bold text-lg leading-tight tracking-tight drop-shadow-sm truncate">
                                    {bank.name}
                                  </h3>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <TrendingUp className="w-3 h-3 text-white/70" />
                                    <span className="text-xs font-medium text-white/70">
                                      {bank.interestRate}% / year
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-end gap-6 flex-wrap">
                              <div>
                                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-0.5">
                                  Total Balance
                                </p>
                                <p className="text-xl font-bold tracking-tight drop-shadow-md">
                                  {formatCurrency(total)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-0.5">
                                  Est. Interest
                                </p>
                                <p className="text-sm font-semibold text-white/80">
                                  +{formatCurrency(estimatedInterest)}
                                </p>
                              </div>
                              {pocketCount > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-0.5">
                                    Pockets
                                  </p>
                                  <p className="text-sm font-semibold text-white/80">
                                    {pocketCount}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action buttons + drag handle */}
                          <div className="flex flex-col border-l border-white/10">
                            <button
                              aria-label="Edit bank"
                              className="flex-1 flex items-center justify-center px-3 hover:bg-white/10 transition-colors duration-150"
                              onClick={() => openEditBankDialog(bank)}
                            >
                              <Edit2 className="w-4 h-4 text-white/80" />
                            </button>
                            <div className="border-t border-white/10" />
                            <button
                              aria-label="Delete bank"
                              className="flex-1 flex items-center justify-center px-3 hover:bg-rose-500/20 transition-colors duration-150"
                              onClick={() => handleDeleteBank(bank)}
                            >
                              <Trash2 className="w-4 h-4 text-white/80" />
                            </button>
                            <div className="border-t border-white/10" />
                            <span
                              aria-hidden
                              className="flex-1 flex items-center justify-center px-3 text-white/70 cursor-grab active:cursor-grabbing touch-none"
                            >
                              <GripVertical className="w-4 h-4" />
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                </DraggableListItem>
              );
            })}
          </div>
        )}
        {sortedBanks.length > 1 && (
          <p className="text-[11px] text-center text-zinc-400 mt-1">
            Tip: long-press or drag a card to reorder
          </p>
        )}
      </div>

      {/* Add Bank Dialog */}
      <Dialog open={isAddBankOpen} onOpenChange={setIsAddBankOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add Bank</DialogTitle>
            <DialogDescription>Create a new bank account profile.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddBank} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bank-name">Bank Name</Label>
              <Input
                id="bank-name"
                placeholder="e.g. Kept by Krungsri"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-rate">Interest Rate (%)</Label>
              <Input
                id="bank-rate"
                type="number"
                step="0.01"
                placeholder="e.g. 1.5"
                value={bankInterestRate}
                onChange={(e) => setBankInterestRate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-logo">Logo URL (Optional)</Label>
              <Input
                id="bank-logo"
                placeholder="https://..."
                value={bankLogoUrl}
                onChange={(e) => setBankLogoUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Theme Color</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className="w-7 h-7 rounded-full border-2 transition-all relative flex items-center justify-center"
                    style={{
                      backgroundColor: color.value,
                      borderColor: bankThemeColor === color.value ? '#fff' : 'transparent',
                      boxShadow: bankThemeColor === color.value ? '0 0 0 2px #000' : 'none',
                    }}
                    onClick={() => setBankThemeColor(color.value)}
                  >
                    {bankThemeColor === color.value && (
                      <span className="w-2 h-2 rounded-full bg-white block" />
                    )}
                  </button>
                ))}
                {/* Custom color picker */}
                <label
                  className="w-7 h-7 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center cursor-pointer hover:border-zinc-500 transition-colors relative overflow-hidden"
                  title="Custom color"
                  style={{
                    backgroundColor: !PRESET_COLORS.some(c => c.value === bankThemeColor) ? bankThemeColor : undefined,
                    borderStyle: !PRESET_COLORS.some(c => c.value === bankThemeColor) ? 'solid' : 'dashed',
                    borderColor: !PRESET_COLORS.some(c => c.value === bankThemeColor) ? '#fff' : undefined,
                    boxShadow: !PRESET_COLORS.some(c => c.value === bankThemeColor) ? '0 0 0 2px #000' : 'none',
                  }}
                >
                  {PRESET_COLORS.some(c => c.value === bankThemeColor) && (
                    <span className="text-[10px] font-bold text-zinc-400">+</span>
                  )}
                  {!PRESET_COLORS.some(c => c.value === bankThemeColor) && (
                    <span className="w-2 h-2 rounded-full bg-white block" />
                  )}
                  <input
                    type="color"
                    value={bankThemeColor}
                    onChange={(e) => setBankThemeColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full rounded-full">
                Add Bank
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Bank Dialog */}
      <Dialog open={isEditBankOpen} onOpenChange={setIsEditBankOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Edit Bank</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditBank} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-bank-name">Bank Name</Label>
              <Input
                id="edit-bank-name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bank-rate">Interest Rate (%)</Label>
              <Input
                id="edit-bank-rate"
                type="number"
                step="0.01"
                value={bankInterestRate}
                onChange={(e) => setBankInterestRate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bank-logo">Logo URL (Optional)</Label>
              <Input
                id="edit-bank-logo"
                value={bankLogoUrl}
                onChange={(e) => setBankLogoUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Theme Color</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className="w-7 h-7 rounded-full border-2 transition-all relative flex items-center justify-center"
                    style={{
                      backgroundColor: color.value,
                      borderColor: bankThemeColor === color.value ? '#fff' : 'transparent',
                      boxShadow: bankThemeColor === color.value ? '0 0 0 2px #000' : 'none',
                    }}
                    onClick={() => setBankThemeColor(color.value)}
                  >
                    {bankThemeColor === color.value && (
                      <span className="w-2 h-2 rounded-full bg-white block" />
                    )}
                  </button>
                ))}
                {/* Custom color picker */}
                <label
                  className="w-7 h-7 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center cursor-pointer hover:border-zinc-500 transition-colors relative overflow-hidden"
                  title="Custom color"
                  style={{
                    backgroundColor: !PRESET_COLORS.some(c => c.value === bankThemeColor) ? bankThemeColor : undefined,
                    borderStyle: !PRESET_COLORS.some(c => c.value === bankThemeColor) ? 'solid' : 'dashed',
                    borderColor: !PRESET_COLORS.some(c => c.value === bankThemeColor) ? '#fff' : undefined,
                    boxShadow: !PRESET_COLORS.some(c => c.value === bankThemeColor) ? '0 0 0 2px #000' : 'none',
                  }}
                >
                  {PRESET_COLORS.some(c => c.value === bankThemeColor) && (
                    <span className="text-[10px] font-bold text-zinc-400">+</span>
                  )}
                  {!PRESET_COLORS.some(c => c.value === bankThemeColor) && (
                    <span className="w-2 h-2 rounded-full bg-white block" />
                  )}
                  <input
                    type="color"
                    value={bankThemeColor}
                    onChange={(e) => setBankThemeColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full rounded-full">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!deletingBank}
        onOpenChange={(open) => !open && setDeletingBank(null)}
        title="Delete Bank"
        description={`Are you sure you want to delete "${deletingBank?.name}"? This will remove all its allocations across all pockets. This action cannot be undone.`}
        confirmLabel="Delete Bank"
        onConfirm={confirmDeleteBank}
      />
    </main>
  );
}
