'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DraggableListItemProps {
  /** Stable id used to identify the dragged element. */
  id: string;
  /** Zero-based position of this item in the list. */
  index: number;
  /**
   * Called once on drop with the id of the dragged item and the target index
   * where it should land (0..length, clamped). Parent computes the new order.
   */
  onReorder: (fromId: string, toIndex: number) => void;
  /** Optional: notify parent of drag-active state for global UI cues. */
  onDragActiveChange?: (active: boolean) => void;
  className?: string;
  /** The visual content of the item. */
  children: ReactNode;
}

/**
 * Wraps a list item with HTML5 drag-and-drop + touch-drag support.
 * Renders a top or bottom drop-indicator line so users can see where the
 * dragged item will land. Designed to live inside a vertically stacked list
 * where siblings all carry `data-sortable-id` / `data-sortable-index`.
 */
export function DraggableListItem({
  id,
  index,
  onReorder,
  onDragActiveChange,
  className,
  children,
}: DraggableListItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dropAbove, setDropAbove] = useState(false);
  const [dropBelow, setDropBelow] = useState(false);
  const touchActive = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const clearOver = useCallback(() => {
    setDropAbove(false);
    setDropBelow(false);
  }, []);

  const setActive = useCallback(
    (active: boolean) => {
      setIsDragging(active);
      onDragActiveChange?.(active);
    },
    [onDragActiveChange]
  );

  // Compute where a dragged item should land given a Y coordinate.
  const computeInsertIndex = useCallback(
    (clientY: number): number | null => {
      const siblings = Array.from(
        document.querySelectorAll<HTMLElement>('[data-sortable-id]')
      );
      if (siblings.length === 0) return null;

      // Above the first item → index 0.
      const first = siblings[0].getBoundingClientRect();
      if (clientY < first.top + first.height / 2) {
        return 0;
      }
      // Below the last item → index = total.
      const last = siblings[siblings.length - 1].getBoundingClientRect();
      if (clientY > last.bottom - last.height / 2) {
        return siblings.length;
      }
      // Walk siblings and pick the one whose midpoint the cursor crosses.
      for (const el of siblings) {
        const rect = el.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
          const idx = parseInt(el.dataset.sortableIndex || '0', 10);
          return clientY < rect.top + rect.height / 2 ? idx : idx + 1;
        }
      }
      return null;
    },
    []
  );

  const updateOverFromIndex = useCallback(
    (insertIndex: number | null) => {
      if (insertIndex === null) {
        clearOver();
        return;
      }
      // Convert "insert before this index" into "show line above or below self".
      if (insertIndex <= index) {
        setDropAbove(true);
        setDropBelow(false);
      } else if (insertIndex >= index + 2) {
        setDropAbove(false);
        setDropBelow(true);
      } else {
        // insertIndex === index || insertIndex === index + 1 — landing on self
        clearOver();
      }
    },
    [index, clearOver]
  );

  // --- HTML5 desktop drag ---
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
      // Tiny delay so the browser captures the original element before we dim it.
      setTimeout(() => setActive(true), 0);
    },
    [id, setActive]
  );

  const handleDragEnd = useCallback(() => {
    setActive(false);
    clearOver();
  }, [setActive, clearOver]);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const above = e.clientY < rect.top + rect.height / 2;
      setDropAbove(above);
      setDropBelow(!above);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    clearOver();
  }, [clearOver]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const above = e.clientY < rect.top + rect.height / 2;
      const toIndex = above ? index : index + 1;
      setActive(false);
      clearOver();
      onReorder(id, toIndex);
    },
    [id, index, onReorder, setActive, clearOver]
  );

  // --- Touch drag (mobile) ---
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - touchStart.current.x);
      const dy = Math.abs(t.clientY - touchStart.current.y);

      if (!touchActive.current && (dx > 8 || dy > 8)) {
        touchActive.current = true;
        setActive(true);
      }

      if (touchActive.current) {
        const insertIndex = computeInsertIndex(t.clientY);
        updateOverFromIndex(insertIndex);
        // Prevent page scroll while dragging.
        e.preventDefault();
      }
    },
    [computeInsertIndex, updateOverFromIndex, setActive]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchActive.current) {
        const t = e.changedTouches[0];
        const insertIndex = computeInsertIndex(t.clientY);
        if (insertIndex !== null) {
          onReorder(id, insertIndex);
        }
      }
      touchActive.current = false;
      touchStart.current = null;
      setActive(false);
      clearOver();
    },
    [id, computeInsertIndex, onReorder, setActive, clearOver]
  );

  return (
    <div
      ref={ref}
      data-sortable-id={id}
      data-sortable-index={index}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn(
        'relative touch-none select-none transition-all duration-200',
        isDragging && 'z-20 opacity-60 scale-[0.98]',
        className
      )}
      style={{ cursor: isDragging ? 'grabbing' : undefined }}
    >
      {dropAbove && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-1.5 left-2 right-2 z-30 h-1 rounded-full bg-primary shadow-[0_0_0_2px_rgba(255,255,255,0.6)] dark:shadow-[0_0_0_2px_rgba(0,0,0,0.6)]"
        />
      )}
      {dropBelow && (
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-1.5 left-2 right-2 z-30 h-1 rounded-full bg-primary shadow-[0_0_0_2px_rgba(255,255,255,0.6)] dark:shadow-[0_0_0_2px_rgba(0,0,0,0.6)]"
        />
      )}
      {children}
    </div>
  );
}