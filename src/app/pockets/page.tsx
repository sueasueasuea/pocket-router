'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePocketRouterStore } from '@/hooks/usePocketRouterStore';
import { Pocket } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, Edit2, Wallet, ChevronRight } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';

const PRESET_EMOJIS = [
  '🏠', '💳', '🏥', '🚗', '✈️', '🎓', '🍔', '🛍️',
  '🎁', '💰', '🕹️', '📈', '💡', '👪', '🐱', '🌴',
  '☕', '🎵', '📱', '🏋️', '🎮', '🏖️', '🍕', '🚀',
  '💎', '🎯', '📚', '🏡', '💼', '🛡️', '⚡', '🌟',
  '🧳', '🎬', '🏦', '💸', '🩺', '🎂', '👗', '🔧',
];

export default function PocketsPage() {
  const { pockets, allocations, settings, addPocket, updatePocket, deletePocket } = usePocketRouterStore();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPocket, setEditingPocket] = useState<Pocket | null>(null);
  const [deletingPocketId, setDeletingPocketId] = useState<string | null>(null);

  // Form States
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [icon, setIcon] = useState(PRESET_EMOJIS[0]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="p-6">Loading...</div>;

  const handleAddPocket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const newPocket: Pocket = {
      id: crypto.randomUUID(),
      name,
      targetAmount: targetAmount ? parseFloat(targetAmount) : undefined,
      icon,
      createdAt: new Date().toISOString()
    };

    addPocket(newPocket);
    resetForm();
    setIsAddOpen(false);
  };

  const handleEditPocket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPocket || !name) return;

    updatePocket(editingPocket.id, {
      name,
      targetAmount: targetAmount ? parseFloat(targetAmount) : undefined,
      icon
    });

    resetForm();
    setIsEditOpen(false);
  };

  const openEditDialog = (pocket: Pocket) => {
    setEditingPocket(pocket);
    setName(pocket.name);
    setTargetAmount(pocket.targetAmount ? pocket.targetAmount.toString() : '');
    setIcon(pocket.icon);
    setIsEditOpen(true);
  };

  const handleDeletePocket = (id: string) => {
    setDeletingPocketId(id);
  };

  const confirmDeletePocket = () => {
    if (deletingPocketId) {
      deletePocket(deletingPocketId);
      setDeletingPocketId(null);
    }
  };

  const resetForm = () => {
    setName('');
    setTargetAmount('');
    setIcon(PRESET_EMOJIS[0]);
    setEditingPocket(null);
  };

  const getPocketBalance = (pocketId: string) => {
    return allocations
      .filter((a) => a.pocketId === pocketId)
      .reduce((sum, a) => sum + a.amount, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <main className="flex flex-col min-h-full bg-zinc-50 dark:bg-zinc-950 pb-8">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800 w-full">
        <div className="max-w-4xl mx-auto w-full px-6 pt-12 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Pockets
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              Virtual categories for your funds
            </p>
          </div>
          <Button 
            onClick={() => { resetForm(); setIsAddOpen(true); }} 
            size="icon" 
            className="rounded-full"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 w-full max-w-4xl mx-auto px-6 pt-6 flex flex-col gap-4">
        {pockets.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-zinc-400" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">No pockets created yet</p>
              <p className="text-xs text-zinc-500 max-w-[220px] mt-1">
                Create virtual pockets to start dividing your budget.
              </p>
            </div>
            <Button size="sm" className="mt-2 rounded-full" onClick={() => setIsAddOpen(true)}>
              Create Your First Pocket
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pockets.map((pocket) => {
              const balance = getPocketBalance(pocket.id);
              const hasTarget = pocket.targetAmount !== undefined && pocket.targetAmount > 0;
              const progress = hasTarget ? Math.min(100, Math.round((balance / pocket.targetAmount!) * 100)) : 0;

              return (
                <Card 
                  key={pocket.id}
                  className="border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98] duration-200"
                  onClick={() => router.push(`/pockets/${pocket.id}`)}
                >
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shadow-inner">
                          {pocket.icon}
                        </span>
                        <div>
                          <h3 className="font-bold text-zinc-950 dark:text-zinc-50">{pocket.name}</h3>
                          <p className="text-xs font-semibold text-zinc-500 mt-0.5">
                            {formatCurrency(balance)}
                            {hasTarget && ` / ${formatCurrency(pocket.targetAmount!)}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={(e) => { e.stopPropagation(); openEditDialog(pocket); }}>
                          <Edit2 className="w-3.5 h-3.5 text-zinc-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/20" onClick={(e) => { e.stopPropagation(); handleDeletePocket(pocket.id); }}>
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        </Button>
                        <div className="flex items-center text-zinc-300 dark:text-zinc-600">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {hasTarget && (
                      <div className="flex flex-col gap-1.5 mt-1">
                        <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                          <span>Target Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2 bg-zinc-100 dark:bg-zinc-800" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Pocket Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Create Pocket</DialogTitle>
            <DialogDescription>Add a virtual category for specific savings goals.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddPocket} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Pocket Name</Label>
              <Input 
                id="name" 
                placeholder="e.g. Rent, Emergency Fund" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetAmount">Target Amount (Optional)</Label>
              <Input 
                id="targetAmount" 
                type="number" 
                placeholder="Leave blank for no limit" 
                value={targetAmount} 
                onChange={(e) => setTargetAmount(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Emoji / Icon</Label>
              <div className="flex gap-2 flex-wrap max-h-24 overflow-y-auto p-1 border rounded-lg bg-zinc-50 dark:bg-zinc-950">
                {PRESET_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`w-8 h-8 text-lg rounded-md flex items-center justify-center transition-all ${
                      icon === emoji 
                        ? 'bg-primary text-white scale-110 shadow-sm' 
                        : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'
                    }`}
                    onClick={() => setIcon(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full rounded-full">Create Pocket</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Pocket Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Edit Pocket</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditPocket} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Pocket Name</Label>
              <Input 
                id="edit-name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-targetAmount">Target Amount (Optional)</Label>
              <Input 
                id="edit-targetAmount" 
                type="number" 
                placeholder="Leave blank for no limit" 
                value={targetAmount} 
                onChange={(e) => setTargetAmount(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Emoji / Icon</Label>
              <div className="flex gap-2 flex-wrap max-h-24 overflow-y-auto p-1 border rounded-lg bg-zinc-50 dark:bg-zinc-950">
                {PRESET_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`w-8 h-8 text-lg rounded-md flex items-center justify-center transition-all ${
                      icon === emoji 
                        ? 'bg-primary text-white scale-110 shadow-sm' 
                        : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'
                    }`}
                    onClick={() => setIcon(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full rounded-full">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!deletingPocketId}
        onOpenChange={(open) => !open && setDeletingPocketId(null)}
        title="Delete Pocket"
        description={`Are you sure you want to delete "${pockets.find(p => p.id === deletingPocketId)?.name}"? This will remove all allocations assigned to it. This action cannot be undone.`}
        confirmLabel="Delete Pocket"
        onConfirm={confirmDeletePocket}
      />
    </main>
  );
}
