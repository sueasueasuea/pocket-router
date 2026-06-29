'use client';

import { usePocketRouterStore } from '@/hooks/usePocketRouterStore';
import { useInviteStore } from '@/hooks/useInviteStore';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { DashboardSummary } from '@/components/DashboardSummary';
import { PocketCard } from '@/components/PocketCard';
import Link from 'next/link';
import { Plus, ArrowRight, Share2, Wallet, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMemo, useEffect } from 'react';
import { sortByOrderAndDate } from '@/lib/utils';

export default function Home() {
  const { pockets, allocations, settings } = usePocketRouterStore();
  const { acceptedShares, fetchAcceptedShares } = useInviteStore();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useHasHydrated();

  // Sort by user-defined order, fall back to creation time for legacy items.
  const sortedPockets = useMemo(() => sortByOrderAndDate(pockets), [pockets]);

  // Re-fetch when the authenticated user changes (including initial session load).
  useEffect(() => {
    if (user) {
      fetchAcceptedShares();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!hasHydrated) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <main className="flex flex-col min-h-full bg-zinc-50 dark:bg-zinc-950 pb-8">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800 w-full">
        <div className="max-w-4xl mx-auto w-full px-6 pt-12 pb-4 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Pocket Router
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              Track your money everywhere.
            </p>
          </div>
          <Link href="/settings/sharing">
            <Button
              size="icon"
              className="rounded-full cursor-pointer"
              aria-label="Sharing settings"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 w-full max-w-4xl mx-auto px-6 pt-6 flex flex-col gap-8">
        
        {/* Main Summary */}
        <section>
          <DashboardSummary />
        </section>

        {/* Pockets Section */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">My Pockets</h2>
            <Link href="/pockets">
              <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold text-primary cursor-pointer">
                Manage <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>

          {pockets.length === 0 ? (
             <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3">
             <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
               <Plus className="w-6 h-6 text-zinc-400" />
             </div>
             <div>
               <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">No pockets created</p>
               <p className="text-xs text-zinc-500 max-w-[200px] mt-1">Create pockets to allocate your money for specific goals.</p>
             </div>
             <Link href="/pockets">
               <Button size="sm" className="mt-2 rounded-full">Create Pocket</Button>
             </Link>
           </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sortedPockets.map(pocket => (
                <PocketCard 
                  key={pocket.id} 
                  pocket={pocket} 
                  allocations={allocations} 
                  settings={settings}
                  href={`/pockets/${pocket.id}`}
                 />
               ))}
             </div>
          )}
        </section>

        {/* Shared Wallets Section */}
        {acceptedShares.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Shared with Me
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {acceptedShares.map((share) => (
                <Link key={share.id} href={`/share/${share.token}`}>
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm group-hover:text-primary transition-colors">
                          {share.ownerName}&apos;s Wallet
                        </h3>
                        <p className="text-xs text-zinc-500 capitalize">
                          {share.permission === 'edit' ? 'View & Edit' : 'View Only'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
