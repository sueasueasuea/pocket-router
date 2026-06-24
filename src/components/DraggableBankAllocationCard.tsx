'use client';

import { useRef, useState, useCallback } from 'react';
import { Bank, Allocation, AppSettings } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Landmark, GripVertical } from 'lucide-react';

interface DraggableBankAllocationCardProps {
  bank: Bank;
  allocation: Allocation;
  settings: AppSettings;
  onDragStart: (bankId: string) => void;
  onDragEnd: () => void;
  onDrop: (targetBankId: string) => void;
  isDragging: boolean;
  isDragOver: boolean;
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
}: DraggableBankAllocationCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [touchDragging, setTouchDragging] = useState(false);

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

  return (
    <div
      ref={cardRef}
      data-bank-id={bank.id}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="touch-none select-none"
    >
      <Card
        className={`
          overflow-hidden border transition-all duration-300 cursor-grab active:cursor-grabbing relative
          ${isDragging
            ? 'opacity-40 scale-95 border-dashed border-zinc-300 dark:border-zinc-600'
            : isDragOver
              ? 'ring-2 ring-primary/50 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-zinc-950 border-primary/30 scale-[1.02] shadow-lg'
              : 'border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md'
          }
        `}
        style={{
          borderLeftColor: isDragOver ? undefined : bank.themeColor,
          borderLeftWidth: isDragOver ? undefined : '4px',
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
          </div>
        </CardContent>

        {/* Drag over indicator glow */}
        {isDragOver && (
          <div className="absolute inset-0 bg-primary/5 pointer-events-none rounded-lg" />
        )}
      </Card>
    </div>
  );
}
