'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Wallet, User, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';
import { usePocketRouterStore } from '@/hooks/usePocketRouterStore';
import { useAuthStore } from '@/hooks/useAuthStore';

export function BottomNav() {
  const pathname = usePathname();
  const { fetchData, settings, isLoading } = usePocketRouterStore();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (settings.storageType === 'supabase') {
      fetchData();
    }
  }, [settings.storageType, fetchData]);

  const links = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/banks', label: 'Banks', icon: Landmark },
    { href: '/pockets', label: 'Pockets', icon: Wallet },
    { href: '/login', label: user ? 'Profile' : 'Login', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center bg-transparent pointer-events-none pb-4 px-4">
      <div className="w-full max-w-md md:max-w-lg bg-white/80 backdrop-blur-lg border border-neutral-200 shadow-lg rounded-3xl pointer-events-auto dark:bg-neutral-950/80 dark:border-neutral-800 overflow-hidden relative">
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
        )}
        <nav className="flex justify-around items-center p-3">
          {links.map((link) => {
            const Icon = link.icon;
            // Use exact match for "/" to avoid matching every route; for nested routes,
            // active when the current path is the route OR a child of it (e.g. /pockets/123
            // should highlight the "Pockets" tab).
            const isActive =
              link.href === '/'
                ? pathname === '/'
                : !!pathname && pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "flex flex-col items-center justify-center w-16 gap-1 transition-colors duration-200",
                  isActive ? "text-primary" : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300"
                )}
              >
                <div className={cn(
                  "p-2 rounded-full transition-all duration-300",
                  isActive ? "bg-primary/10" : "bg-transparent"
                )}>
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={cn(
                  "text-[10px] font-medium tracking-wide",
                  isActive ? "text-primary" : "text-neutral-500"
                )}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
