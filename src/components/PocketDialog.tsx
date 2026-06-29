import { useState, useEffect } from 'react';
import { Pocket } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const PRESET_EMOJIS = [
  '🏠', '💳', '🏥', '🚗', '✈️', '🎓', '🍔', '🛍️',
  '🎁', '💰', '🕹️', '📈', '💡', '👪', '🐱', '🌴',
  '☕', '🎵', '📱', '🏋️', '🎮', '🏖️', '🍕', '🚀',
  '💎', '🎯', '📚', '🏡', '💼', '🛡️', '⚡', '🌟',
  '🧳', '🎬', '🏦', '💸', '🩺', '🎂', '👗', '🔧',
];

export interface PocketFormData {
  name: string;
  targetAmount?: number;
  icon: string;
}

interface PocketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit';
  initialData?: Pocket | null;
  onSubmit: (data: PocketFormData) => Promise<boolean | void> | void;
}

export function PocketDialog({ open, onOpenChange, mode, initialData, onSubmit }: PocketDialogProps) {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [icon, setIcon] = useState(PRESET_EMOJIS[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initialData) {
        setName(initialData.name);
        setTargetAmount(initialData.targetAmount ? initialData.targetAmount.toString() : '');
        setIcon(initialData.icon);
      } else {
        setName('');
        setTargetAmount('');
        setIcon(PRESET_EMOJIS[0]);
      }
    }
  }, [open, mode, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    await onSubmit({
      name: name.trim(),
      targetAmount: targetAmount ? parseFloat(targetAmount) : undefined,
      icon,
    });
    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Create Pocket' : 'Edit Pocket'}</DialogTitle>
          {mode === 'add' && <DialogDescription>Add a virtual category for specific savings goals.</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${mode}-pocket-name`}>Pocket Name</Label>
            <Input 
              id={`${mode}-pocket-name`} 
              placeholder="e.g. Rent, Emergency Fund" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${mode}-pocket-target`}>Target Amount (Optional)</Label>
            <Input 
              id={`${mode}-pocket-target`} 
              type="number" 
              min={0}
              step="any"
              placeholder="Leave blank for no limit" 
              value={targetAmount} 
              onChange={(e) => setTargetAmount(e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <Label>Emoji / Icon</Label>
            <div className="flex gap-2 flex-wrap max-h-32 overflow-y-auto p-1 border rounded-lg bg-zinc-50 dark:bg-zinc-950">
              {PRESET_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-8 h-8 text-lg rounded-md flex items-center justify-center transition-all cursor-pointer ${
                    icon === emoji 
                      ? 'bg-primary text-primary-foreground scale-110 shadow-sm' 
                      : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full rounded-full" disabled={submitting || !name.trim()}>
              {submitting ? 'Saving...' : mode === 'add' ? 'Create Pocket' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
