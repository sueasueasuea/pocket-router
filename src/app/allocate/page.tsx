'use client';

import { useState, useEffect } from 'react';
import { usePocketRouterStore } from '@/hooks/usePocketRouterStore';
import { Allocation } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, ArrowRightLeft, Send, Landmark, Wallet } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AllocatePage() {
  const { 
    banks, 
    pockets, 
    allocations, 
    settings, 
    addAllocation, 
    updateAllocation, 
    deleteAllocation 
  } = usePocketRouterStore();

  const [mounted, setMounted] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form States
  const [selectedPocketId, setSelectedPocketId] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="p-6">Loading...</div>;

  const handleAllocate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPocketId || !selectedBankId || !amount) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    // Check if an allocation already exists for this Pocket -> Bank combo
    const existingAllocation = allocations.find(
      (a) => a.pocketId === selectedPocketId && a.bankId === selectedBankId
    );

    if (existingAllocation) {
      // If it exists, add the amount to the existing allocation
      updateAllocation(existingAllocation.id, {
        amount: existingAllocation.amount + numAmount
      });
    } else {
      // Create new allocation
      const newAllocation: Allocation = {
        id: crypto.randomUUID(),
        pocketId: selectedPocketId,
        bankId: selectedBankId,
        amount: numAmount,
        createdAt: new Date().toISOString()
      };
      addAllocation(newAllocation);
    }

    // Reset Form
    setSelectedPocketId('');
    setSelectedBankId('');
    setAmount('');
    setIsAddOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this allocation?')) {
      deleteAllocation(id);
    }
  };

  const getPocketName = (pocketId: string) => {
    const pocket = pockets.find((p) => p.id === pocketId);
    return pocket ? `${pocket.icon} ${pocket.name}` : 'Unknown Pocket';
  };

  const getBankName = (bankId: string) => {
    const bank = banks.find((b) => b.id === bankId);
    return bank ? bank.name : 'Unknown Bank';
  };

  const getBankColor = (bankId: string) => {
    const bank = banks.find((b) => b.id === bankId);
    return bank ? bank.themeColor : '#e4e4e7';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <main className="flex flex-col min-h-full bg-zinc-50 dark:bg-zinc-950 pb-8">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800 w-full">
        <div className="max-w-4xl mx-auto w-full px-6 pt-12 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Allocations
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              Route pocket funds to specific bank accounts
            </p>
          </div>
          <Button 
            onClick={() => setIsAddOpen(true)} 
            size="icon" 
            className="rounded-full"
            disabled={banks.length === 0 || pockets.length === 0}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 w-full max-w-4xl mx-auto px-6 pt-6 flex flex-col gap-4">
        {banks.length === 0 || pockets.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <ArrowRightLeft className="w-6 h-6 text-zinc-400" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Prerequisites missing</p>
              <p className="text-xs text-zinc-500 max-w-[240px] mt-1">
                You need to create at least one Bank and one Pocket before making allocations.
              </p>
            </div>
          </div>
        ) : allocations.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Send className="w-6 h-6 text-zinc-400" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">No allocations route yet</p>
              <p className="text-xs text-zinc-500 max-w-[220px] mt-1">
                Route money from your pockets into your high-yield savings accounts.
              </p>
            </div>
            <Button size="sm" className="mt-2 rounded-full" onClick={() => setIsAddOpen(true)}>
              Allocate Now
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {allocations.map((allocation) => (
              <Card 
                key={allocation.id}
                className="overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm relative"
              >
                <div 
                  className="absolute top-0 left-0 w-2 h-full" 
                  style={{ backgroundColor: getBankColor(allocation.bankId) }} 
                />
                <CardContent className="p-4 pl-6 flex justify-between items-center">
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                      <span className="font-bold">{getPocketName(allocation.pocketId)}</span>
                      <span className="text-xs text-zinc-400">➔</span>
                      <span className="text-sm font-semibold flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                        <Landmark className="w-3 h-3" />
                        {getBankName(allocation.bankId)}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-zinc-950 dark:text-zinc-50">
                      {formatCurrency(allocation.amount)}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/20" 
                    onClick={() => handleDelete(allocation.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Allocation Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Allocate Money</DialogTitle>
            <DialogDescription>Link a virtual pocket to a real bank account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAllocate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pocket">Select Pocket</Label>
              <Select value={selectedPocketId} onValueChange={(val) => setSelectedPocketId(val ?? '')} required>
                <SelectTrigger id="pocket">
                  <SelectValue placeholder="Choose a Pocket" />
                </SelectTrigger>
                <SelectContent>
                  {pockets.map((pocket) => (
                    <SelectItem key={pocket.id} value={pocket.id}>
                      {pocket.icon} {pocket.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank">Select Bank</Label>
              <Select value={selectedBankId} onValueChange={(val) => setSelectedBankId(val ?? '')} required>
                <SelectTrigger id="bank">
                  <SelectValue placeholder="Choose a Bank" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name} ({bank.interestRate}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input 
                id="amount" 
                type="number" 
                step="0.01" 
                min="0.01" 
                placeholder="0.00" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                required 
              />
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full rounded-full flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> Allocate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
