'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase/client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Supabase will automatically parse the hash segment in the URL
    // (e.g. #access_token=...) and establish the session client-side.
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/');
      } else {
        // Wait a brief moment for the Supabase client to process the hash fragment if needed
        setTimeout(async () => {
          const { data: { session: retriedSession } } = await supabase.auth.getSession();
          if (retriedSession) {
            router.push('/');
          } else {
            router.push('/login');
          }
        }, 1500);
      }
    };
    
    checkSession();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2 text-zinc-800 dark:text-zinc-200">Logging you in...</h2>
        <p className="text-sm text-zinc-500 mb-4">Please wait while we complete the authentication.</p>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  );
}
