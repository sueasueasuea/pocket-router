'use client';

import { usePocketRouterStore } from '@/hooks/usePocketRouterStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

/**
 * Global error modal. Subscribes to `lastError` in the store and shows a
 * modal whenever any optimistic mutation fails (or fetchData errors).
 * Pressing OK (or closing the dialog) clears the error.
 */
export function ErrorModal() {
  const lastError = usePocketRouterStore((s) => s.lastError);
  const clearError = usePocketRouterStore((s) => s.clearError);

  const open = !!lastError;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) clearError();
      }}
    >
      <DialogContent className="max-w-sm rounded-3xl" showCloseButton={false}>
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-rose-500" />
            </div>
          </div>
          <DialogTitle className="text-center">
            {lastError?.context || 'Something went wrong'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {lastError?.message || 'An unexpected error occurred.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button className="w-full rounded-full" onClick={clearError}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}