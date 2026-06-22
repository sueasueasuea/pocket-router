'use client';

import { useState, useEffect } from 'react';
import { usePocketRouterStore } from '@/hooks/usePocketRouterStore';
import { Bank } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Landmark, Plus, Trash2, Edit2, Settings, Globe } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useRouter } from 'next/navigation';

const PRESET_COLORS = [
  { name: 'Emerald', value: '#10b981' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Slate', value: '#64748b' }
];

export default function BanksPage() {
  const { banks, allocations, settings, addBank, updateBank, deleteBank, updateSettings } = usePocketRouterStore();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  
  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);

  // Form States
  const [name, setName] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [themeColor, setThemeColor] = useState(PRESET_COLORS[0].value);
  const [currency, setCurrency] = useState(settings.currency);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      setCurrency(settings.currency);
    }
  }, [settings.currency, mounted]);


  if (!mounted) return <div className="p-6">Loading...</div>;

  const handleAddBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !interestRate) return;

    const newBank: Bank = {
      id: crypto.randomUUID(),
      name,
      interestRate: parseFloat(interestRate),
      logoUrl: logoUrl || undefined,
      themeColor,
      createdAt: new Date().toISOString()
    };

    addBank(newBank);
    resetForm();
    setIsAddOpen(false);
  };

  const handleEditBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBank || !name || !interestRate) return;

    updateBank(editingBank.id, {
      name,
      interestRate: parseFloat(interestRate),
      logoUrl: logoUrl || undefined,
      themeColor
    });

    resetForm();
    setIsEditOpen(false);
  };

  const openEditDialog = (bank: Bank) => {
    setEditingBank(bank);
    setName(bank.name);
    setInterestRate(bank.interestRate.toString());
    setLogoUrl(bank.logoUrl || '');
    setThemeColor(bank.themeColor);
    setIsEditOpen(true);
  };

  const handleDeleteBank = (id: string) => {
    if (confirm('Are you sure you want to delete this bank? This will remove all allocations to this bank.')) {
      deleteBank(id);
    }
  };

  const handleSaveSettings = () => {
    updateSettings({ currency });
    setIsSettingsOpen(false);
  };

  const resetForm = () => {
    setName('');
    setInterestRate('');
    setLogoUrl('');
    setThemeColor(PRESET_COLORS[0].value);
    setEditingBank(null);
  };

  const getBankBalance = (bankId: string) => {
    return allocations
      .filter((a) => a.bankId === bankId)
      .reduce((sum, a) => sum + a.amount, 0);
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
              Banks
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              Manage your accounts & interest rates
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setIsSettingsOpen(true)}
              className="rounded-full"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button 
              onClick={() => { resetForm(); setIsAddOpen(true); }} 
              size="icon" 
              className="rounded-full"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-4xl mx-auto px-6 pt-6 flex flex-col gap-4">
        {banks.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Landmark className="w-6 h-6 text-zinc-400" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">No banks added yet</p>
              <p className="text-xs text-zinc-500 max-w-[220px] mt-1">
                Add banks to start routing your virtual pockets.
              </p>
            </div>
            <Button size="sm" className="mt-2 rounded-full" onClick={() => setIsAddOpen(true)}>
              Add Your First Bank
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {banks.map((bank) => {
              const balance = getBankBalance(bank.id);
              const estInterest = (balance * bank.interestRate) / 100;
              return (
                <Card 
                  key={bank.id}
                  className="overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm relative"
                >
                  <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: bank.themeColor }} />
                  <CardContent className="p-4 pl-6 flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {bank.logoUrl ? (
                          <img src={bank.logoUrl} alt={bank.name} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <Landmark className="w-4 h-4 text-zinc-400" />
                        )}
                        <h3 className="font-bold text-zinc-950 dark:text-zinc-50">{bank.name}</h3>
                      </div>
                      <div className="flex gap-4 text-xs text-zinc-500 mt-1">
                        <span>Interest: <strong className="text-zinc-900 dark:text-zinc-100">{bank.interestRate}%</strong></span>
                        <span>Balance: <strong className="text-zinc-900 dark:text-zinc-100">{formatCurrency(balance)}</strong></span>
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        + {formatCurrency(estInterest)} / yr interest
                      </div>
                    </div>
                    
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => openEditDialog(bank)}>
                        <Edit2 className="w-3.5 h-3.5 text-zinc-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/20" onClick={() => handleDeleteBank(bank.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Bank Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add Bank</DialogTitle>
            <DialogDescription>Create a custom bank account profile.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddBank} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Bank Name</Label>
              <Input 
                id="name" 
                placeholder="e.g. Kept by Krungsri" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interestRate">Interest Rate (%)</Label>
              <Input 
                id="interestRate" 
                type="number" 
                step="0.01" 
                placeholder="e.g. 1.5" 
                value={interestRate} 
                onChange={(e) => setInterestRate(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL (Optional)</Label>
              <Input 
                id="logoUrl" 
                placeholder="https://..." 
                value={logoUrl} 
                onChange={(e) => setLogoUrl(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Theme Color</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className="w-8 h-8 rounded-full border-2 transition-all relative flex items-center justify-center"
                    style={{ 
                      backgroundColor: color.value,
                      borderColor: themeColor === color.value ? '#000000' : 'transparent'
                    }}
                    onClick={() => setThemeColor(color.value)}
                  >
                    {themeColor === color.value && (
                      <span className="w-2 h-2 rounded-full bg-white block" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full rounded-full">Add Bank</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Bank Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Edit Bank</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditBank} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Bank Name</Label>
              <Input 
                id="edit-name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-interestRate">Interest Rate (%)</Label>
              <Input 
                id="edit-interestRate" 
                type="number" 
                step="0.01" 
                value={interestRate} 
                onChange={(e) => setInterestRate(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-logoUrl">Logo URL (Optional)</Label>
              <Input 
                id="edit-logoUrl" 
                value={logoUrl} 
                onChange={(e) => setLogoUrl(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Theme Color</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className="w-8 h-8 rounded-full border-2 transition-all relative flex items-center justify-center"
                    style={{ 
                      backgroundColor: color.value,
                      borderColor: themeColor === color.value ? '#000000' : 'transparent'
                    }}
                    onClick={() => setThemeColor(color.value)}
                  >
                    {themeColor === color.value && (
                      <span className="w-2 h-2 rounded-full bg-white block" />
                    )}
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

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" /> Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="currency">Default Currency</Label>
              <Select value={currency} onValueChange={(val) => setCurrency(val ?? 'THB')}>
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select Currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="THB">THB (฿)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="JPY">JPY (¥)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button onClick={handleSaveSettings} className="w-full rounded-full">Save Settings</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
