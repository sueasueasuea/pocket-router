'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DraggableListItemProps {
  /** Stable id used to identify the dragged element. */
  id: string;
  /** Zero-based position of this item in the list. */
  index: number;
  /** Total number of items in the list (needed for Home/End + boundary checks). */
  totalCount: number;
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

  // --- Keyboard a11y coordination with parent ---
  /** Accessible name of this item (e.g. bank name). Used in live region messages. */
  itemName: string;
  /** True iff this item is currently the keyboard-picked-up item. */
  isKeyboardPickedUp: boolean;
  /**
   * Index (in the original list) of the sibling where the keyboard drop
   * indicator should be displayed. The parent derives this from arrow-key
   * navigation in the picked-up item.
   */
  keyboardTargetIndex: number | null;
  /** Called when the user picks up this item via keyboard (Space/Enter). */
  onKeyboardPickup: (id: string) => void;
  /**
   * Called when the user confirms the keyboard drag (Space/Enter again).
   * The `toIndex` here is the desired NEW position of the item in the list
   * (0..lastIndex). Parent converts this to the `onReorder` insert index.
   */
  onKeyboardDrop: (id: string, toIndex: number) => void;
  /** Called when the user cancels the keyboard drag (Escape). */
  onKeyboardCancel: (id: string) => void;
  /** Called as the user navigates the keyboard drop target with arrow keys. */
  onKeyboardTargetChange: (targetIndex: number) => void;
  /** Notifies parent of live-region messages to announce. */
  onAnnounce: (message: string) => void;
}

/**
 * Wraps a list item with HTML5 drag-and-drop + touch-drag + keyboard support.
 * Renders a top or bottom drop-indicator line so users can see where the
 * dragged item will land. Designed to live inside a vertically stacked list
 * where siblings all carry `data-sortable-id` / `data-sortable-index`.
 *
 * Keyboard interaction:
 *  - Tab to focus an item.
 *  - Space / Enter to pick up.
 *  - ArrowUp / ArrowDown / Home / End to move the drop target.
 *  - Space / Enter to drop at the target.
 *  - Escape to cancel and return focus to the original item.
 *
 * Mouse and touch behavior are unchanged.
 */
export function DraggableListItem({
  id,
  index,
  totalCount,
  onReorder,
  onDragActiveChange,
  className,
  children,
  itemName,
  isKeyboardPickedUp,
  keyboardTargetIndex,
  onKeyboardPickup,
  onKeyboardDrop,
  onKeyboardCancel,
  onKeyboardTargetChange,
  onAnnounce,
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
      // The drop event fires on the element being dropped ONTO, so the closure
      // `id` here is the drop target's id, not the dragged item's id. Read the
      // dragged id from dataTransfer (set in handleDragStart) instead.
      const draggedId = e.dataTransfer.getData('text/plain');
      if (!draggedId || draggedId === id) {
        // Drop on self, or from an unknown source (e.g. external drag) — no-op.
        setActive(false);
        clearOver();
        return;
      }
      const above = e.clientY < rect.top + rect.height / 2;
      const toIndex = above ? index : index + 1;
      setActive(false);
      clearOver();
      onReorder(draggedId, toIndex);
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

  // --- Keyboard a11y handler ---
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const key = e.key;

      // Escape cancels regardless of picked-up state (no-op if not picked up).
      if (key === 'Escape') {
        if (!isKeyboardPickedUp) return;
        e.preventDefault();
        onKeyboardCancel(id);
        onAnnounce(`Cancelled. ${itemName} returned to original position.`);
        // Return focus to the (still-rendered) picked-up element.
        ref.current?.focus();
        return;
      }

      // Space / Enter toggles picked-up state.
      if (key === ' ' || key === 'Enter') {
        e.preventDefault();
        if (!isKeyboardPickedUp) {
          // Pick up.
          onKeyboardPickup(id);
          onAnnounce(
            `Picked up ${itemName}. Use arrow keys to move. Press Enter to drop, Escape to cancel.`
          );
        } else {
          // Drop.
          const target = keyboardTargetIndex;
          if (target !== null && target !== index) {
            onKeyboardDrop(id, target);
            onAnnounce(`Dropped. ${itemName} is now at position ${target + 1} of ${totalCount}.`);
          } else {
            // No movement — treat as cancel.
            onKeyboardCancel(id);
            onAnnounce(`Cancelled. ${itemName} returned to original position.`);
            ref.current?.focus();
          }
        }
        return;
      }

      // Movement keys — only active while picked up.
      if (
        isKeyboardPickedUp &&
        (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Home' || key === 'End')
      ) {
        e.preventDefault();
        // With a single item there's nowhere to move.
        if (totalCount <= 1) {
          onAnnounce('Nothing to reorder.');
          return;
        }
        const current = keyboardTargetIndex ?? index;
        let next = current;
        if (key === 'ArrowUp') {
          if (current <= 0) {
            onAnnounce('Cannot move further up.');
            return;
          }
          next = current - 1;
        } else if (key === 'ArrowDown') {
          if (current >= totalCount - 1) {
            onAnnounce('Cannot move further down.');
            return;
          }
          next = current + 1;
        } else if (key === 'Home') {
          next = 0;
        } else if (key === 'End') {
          next = totalCount - 1;
        }
        onKeyboardTargetChange(next);
        onAnnounce(`Moved to position ${next + 1} of ${totalCount}. Press Enter to drop.`);
        return;
      }
    },
    [
      isKeyboardPickedUp,
      keyboardTargetIndex,
      index,
      totalCount,
      id,
      itemName,
      onKeyboardPickup,
      onKeyboardDrop,
      onKeyboardCancel,
      onKeyboardTargetChange,
      onAnnounce,
    ]
  );

  // Keyboard-only drop indicator: shows on the target sibling while an item
  // is picked up. Mouse/touch continues to drive the existing `dropAbove` /
  // `dropBelow` state separately, and the two never collide because mouse
  // and keyboard input are mutually exclusive on a single device.
  const keyboardDropAbove =
    isKeyboardPickedUp &&
    keyboardTargetIndex !== null &&
    keyboardTargetIndex === index;

  return (
    <div
      ref={ref}
      data-sortable-id={id}
      data-sortable-index={index}
      tabIndex={0}
      role="option"
      id={`sortable-${id}`}
      aria-grabbed={isKeyboardPickedUp}
      aria-selected={isKeyboardPickedUp}
      aria-label={`${itemName}, position ${index + 1} of ${totalCount}. Press Space or Enter to pick up.`}
      aria-posinset={index + 1}
      aria-setsize={totalCount}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative touch-none select-none transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-offset-zinc-950 rounded-2xl',
        (isDragging || isKeyboardPickedUp) && 'z-20 opacity-60 scale-[0.98]',
        className
      )}
      style={{ cursor: isDragging ? 'grabbing' : undefined }}
    >
      {(dropAbove || keyboardDropAbove) && (
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
