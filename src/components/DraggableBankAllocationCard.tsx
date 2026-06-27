'use client';

import { useRef, useState, useCallback, useId } from 'react';
import { Bank, Allocation, AppSettings } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Landmark, GripVertical, Trash2 } from 'lucide-react';

interface DraggableBankAllocationCardProps {
  bank: Bank;
  allocation: Allocation;
  settings: AppSettings;
  onDragStart: (bankId: string) => void;
  onDragEnd: () => void;
  onDrop: (targetBankId: string) => void;
  isDragging: boolean;
  isDragOver: boolean;
  /** Called when user taps the trash button to remove this allocation. */
  onRemove?: () => void;

  // --- Keyboard a11y coordination with parent ---
  /** True iff this card is currently the keyboard-picked-up card. */
  isKeyboardPickedUp: boolean;
  /** Bank id of the sibling that should show the keyboard drop highlight. */
  keyboardTargetBankId: string | null;
  /** Total number of allocations in this pocket (for Home/End + boundary checks). */
  totalCount: number;
  /** Called when the user picks up this card via keyboard (Space/Enter). */
  onKeyboardPickup: (bankId: string) => void;
  /** Called when the user confirms a keyboard drag (Space/Enter again). */
  onKeyboardDrop: (targetBankId: string) => void;
  /** Called when the user cancels a keyboard drag (Escape). */
  onKeyboardCancel: (bankId: string) => void;
  /** Called as the user navigates the keyboard drop target with arrow keys. */
  onKeyboardTargetChange: (targetBankId: string) => void;
  /** Notifies parent of live-region messages to announce. */
  onAnnounce: (message: string) => void;
}

export function DraggableBankAllocationCard({
  bank,
  allocation,
  settings,
  onDragStart,
  onDragEnd,
  onDrop,
  isDragging,
  isDragOver,
  onRemove,
  isKeyboardPickedUp,
  keyboardTargetBankId,
  totalCount,
  onKeyboardPickup,
  onKeyboardDrop,
  onKeyboardCancel,
  onKeyboardTargetChange,
  onAnnounce,
}: DraggableBankAllocationCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [touchDragging, setTouchDragging] = useState(false);
  const helpTextId = useId();

  const estimatedInterest = (allocation.amount * bank.interestRate) / 100;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // HTML5 Drag and Drop handlers
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', bank.id);
    e.dataTransfer.effectAllowed = 'move';
    // Small delay for visual effect
    setTimeout(() => onDragStart(bank.id), 0);
  }, [bank.id, onDragStart]);

  const handleDragEnd = useCallback(() => {
    onDragEnd();
  }, [onDragEnd]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    onDrop(bank.id);
  }, [bank.id, onDrop]);

  // Touch event handlers for mobile
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);

    // Start drag if moved more than 10px
    if (dx > 10 || dy > 10) {
      if (!touchDragging) {
        setTouchDragging(true);
        onDragStart(bank.id);
      }
    }
  }, [touchDragging, bank.id, onDragStart]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchDragging) {
      // Find element under touch point
      const touch = e.changedTouches[0];
      const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);

      // Walk up to find a card with data-bank-id
      let target = elementUnder;
      while (target && !target.getAttribute?.('data-bank-id')) {
        target = target.parentElement;
      }

      if (target) {
        const targetBankId = target.getAttribute('data-bank-id');
        if (targetBankId && targetBankId !== bank.id) {
          onDrop(targetBankId);
        }
      }

      setTouchDragging(false);
      onDragEnd();
    }
    touchStartPos.current = null;
  }, [touchDragging, bank.id, onDrop, onDragEnd]);

  // Helper: collect sibling bank ids + their data-allocation-index, in DOM order.
  const getSiblings = useCallback((): HTMLElement[] => {
    return Array.from(
      document.querySelectorAll<HTMLElement>('[data-bank-id]')
    );
  }, []);

  // --- Keyboard a11y handler ---
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const key = e.key;

      // Escape cancels regardless of picked-up state (no-op if not picked up).
      if (key === 'Escape') {
        if (!isKeyboardPickedUp) return;
        e.preventDefault();
        onKeyboardCancel(bank.id);
        onAnnounce(`Cancelled. ${bank.name} returned to original position.`);
        cardRef.current?.focus();
        return;
      }

      // Space / Enter toggles picked-up state.
      if (key === ' ' || key === 'Enter') {
        e.preventDefault();
        if (!isKeyboardPickedUp) {
          onKeyboardPickup(bank.id);
          onAnnounce(
            `Picked up ${bank.name}. Use arrow keys to choose a target bank. Press Enter to transfer, Escape to cancel.`
          );
        } else {
          // Drop: requires a different sibling to be the target.
          if (
            keyboardTargetBankId &&
            keyboardTargetBankId !== bank.id
          ) {
            onKeyboardDrop(keyboardTargetBankId);
            // Don't clear picked state here — parent will reset once the
            // transfer dialog closes.
            return;
          }
          // No valid target — treat as cancel.
          onKeyboardCancel(bank.id);
          onAnnounce(`Cancelled. ${bank.name} returned to original position.`);
          cardRef.current?.focus();
        }
        return;
      }

      // Movement keys — only active while picked up.
      if (
        isKeyboardPickedUp &&
        (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Home' || key === 'End')
      ) {
        e.preventDefault();
        const siblings = getSiblings();
        if (siblings.length <= 1 || totalCount <= 1) {
          onAnnounce('No other bank to transfer to.');
          return;
        }
        const ids = siblings
          .map((el) => el.getAttribute('data-bank-id'))
          .filter((v): v is string => Boolean(v));
        const currentIdx =
          keyboardTargetBankId !== null
            ? ids.indexOf(keyboardTargetBankId)
            : ids.indexOf(bank.id);
        const safeIdx = currentIdx === -1 ? ids.indexOf(bank.id) : currentIdx;
        if (safeIdx === -1) return;

        let nextIdx = safeIdx;
        if (key === 'ArrowUp') {
          if (safeIdx <= 0) {
            onAnnounce('Cannot move further up.');
            return;
          }
          nextIdx = safeIdx - 1;
        } else if (key === 'ArrowDown') {
          if (safeIdx >= ids.length - 1) {
            onAnnounce('Cannot move further down.');
            return;
          }
          nextIdx = safeIdx + 1;
        } else if (key === 'Home') {
          nextIdx = 0;
        } else if (key === 'End') {
          nextIdx = ids.length - 1;
        }

        // Skip self so user always lands on a different bank to transfer to.
        if (ids[nextIdx] === bank.id) {
          if (key === 'ArrowDown' && nextIdx < ids.length - 1) nextIdx += 1;
          else if (key === 'ArrowUp' && nextIdx > 0) nextIdx -= 1;
          else {
            onAnnounce('No other bank to transfer to.');
            return;
          }
        }

        const nextId = ids[nextIdx];
        if (nextId) {
          onKeyboardTargetChange(nextId);
          const targetBankName = siblings[nextIdx]?.getAttribute('data-bank-name') ?? 'target bank';
          onAnnounce(`Target: ${targetBankName}. Position ${nextIdx + 1} of ${totalCount}. Press Enter to transfer.`);
        }
        return;
      }
    },
    [
      isKeyboardPickedUp,
      keyboardTargetBankId,
      bank.id,
      bank.name,
      totalCount,
      getSiblings,
      onKeyboardPickup,
      onKeyboardDrop,
      onKeyboardCancel,
      onKeyboardTargetChange,
      onAnnounce,
    ]
  );

  // Keyboard-only "drag over" highlight, parallel to mouse `isDragOver`.
  const keyboardDragOver = isKeyboardPickedUp && keyboardTargetBankId === bank.id;

  return (
    <div
      ref={cardRef}
      id={`bank-alloc-${bank.id}`}
      data-bank-id={bank.id}
      data-bank-name={bank.name}
      tabIndex={0}
      role="option"
      aria-grabbed={isKeyboardPickedUp}
      aria-selected={isKeyboardPickedUp}
      aria-describedby={helpTextId}
      aria-label={`${bank.name} allocation, ${formatCurrency(allocation.amount)}. Press Space or Enter to pick up and choose a target bank for transfer.`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      className="touch-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-offset-zinc-950 rounded-2xl"
    >
      {/* Hidden description for screen readers — explains keyboard interaction. */}
      <span id={helpTextId} className="sr-only">
        Reorderable bank allocation card. Press Space or Enter to pick up, then
        use the arrow keys to choose another bank to transfer money to. Press
        Space or Enter again to transfer, or Escape to cancel.
      </span>
      <Card
        className={`
          overflow-hidden border transition-all duration-300 cursor-grab active:cursor-grabbing relative
          ${isDragging
            ? 'opacity-40 scale-95 border-dashed border-zinc-300 dark:border-zinc-600'
            : isDragOver || keyboardDragOver
              ? 'ring-2 ring-primary/50 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-zinc-950 border-primary/30 scale-[1.02] shadow-lg'
              : 'border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md'
          }
        `}
        style={{
          borderLeftColor: isDragOver || keyboardDragOver ? undefined : bank.themeColor,
          borderLeftWidth: isDragOver || keyboardDragOver ? undefined : '4px',
        }}
      >
        <CardContent className="p-4 pl-5">
          <div className="flex items-center gap-3">
            {/* Drag Handle */}
            <div className="text-zinc-300 dark:text-zinc-600 flex-shrink-0">
              <GripVertical className="w-4 h-4" />
            </div>

            {/* Bank Icon */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
              style={{ backgroundColor: bank.themeColor }}
            >
              {bank.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bank.logoUrl} alt={bank.name} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <Landmark className="w-4 h-4 text-white" />
              )}
            </div>

            {/* Bank Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm truncate">
                  {bank.name}
                </h4>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex-shrink-0">
                  {bank.interestRate}%
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                  {formatCurrency(allocation.amount)}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex-shrink-0">
                  +{formatCurrency(estimatedInterest)}/yr
                </p>
              </div>
            </div>

            {/* Remove button — always visible so it's tappable on mobile. */}
            {onRemove && (
              <button
                type="button"
                aria-label={`Remove ${bank.name} from this pocket`}
                title="Remove from this pocket"
                onClick={(e) => {
                  // Stop the touch/drag handlers on the parent from swallowing this tap.
                  e.stopPropagation();
                  onRemove();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex-shrink-0 h-11 w-11 rounded-full flex items-center justify-center text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:scale-95 transition-all touch-none"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </CardContent>

        {/* Drag over indicator glow */}
        {(isDragOver || keyboardDragOver) && (
          <div className="absolute inset-0 bg-primary/5 pointer-events-none rounded-lg" />
        )}
      </Card>
    </div>
  );
}
