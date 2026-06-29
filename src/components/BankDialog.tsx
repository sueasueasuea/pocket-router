import { useState, useEffect } from 'react';
import { Bank } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

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

export interface BankFormData {
  name: string;
  interestRate: number;
  logoUrl?: string;
  themeColor: string;
}

interface BankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit';
  initialData?: Bank | null;
  onSubmit: (data: BankFormData) => Promise<boolean | void> | void;
}

export function BankDialog({ open, onOpenChange, mode, initialData, onSubmit }: BankDialogProps) {
  const [bankName, setBankName] = useState('');
  const [bankInterestRate, setBankInterestRate] = useState('');
  const [bankLogoUrl, setBankLogoUrl] = useState('');
  const [bankThemeColor, setBankThemeColor] = useState(PRESET_COLORS[0].value);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initialData) {
        setBankName(initialData.name);
        setBankInterestRate(initialData.interestRate.toString());
        setBankLogoUrl(initialData.logoUrl || '');
        setBankThemeColor(initialData.themeColor);
      } else {
        setBankName('');
        setBankInterestRate('');
        setBankLogoUrl('');
        setBankThemeColor(PRESET_COLORS[0].value);
      }
    }
  }, [open, mode, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !bankInterestRate) return;
    setSubmitting(true);
    await onSubmit({
      name: bankName.trim(),
      interestRate: parseFloat(bankInterestRate) || 0,
      logoUrl: bankLogoUrl.trim() || undefined,
      themeColor: bankThemeColor,
    });
    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Add Bank' : 'Edit Bank'}</DialogTitle>
          {mode === 'add' && <DialogDescription>Create a new bank account profile.</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${mode}-bank-name`}>Bank Name</Label>
            <Input
              id={`${mode}-bank-name`}
              placeholder="e.g. Kept by Krungsri"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${mode}-bank-rate`}>Interest Rate (%)</Label>
            <Input
              id={`${mode}-bank-rate`}
              type="number"
              step="0.01"
              min={0}
              placeholder="e.g. 1.5"
              value={bankInterestRate}
              onChange={(e) => setBankInterestRate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${mode}-bank-logo`}>Logo URL (Optional)</Label>
            <Input
              id={`${mode}-bank-logo`}
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
                  className="w-7 h-7 rounded-full border-2 transition-all relative flex items-center justify-center cursor-pointer"
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
            <Button type="submit" className="w-full rounded-full" disabled={submitting || !bankName.trim()}>
              {submitting ? 'Saving...' : mode === 'add' ? 'Add Bank' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
