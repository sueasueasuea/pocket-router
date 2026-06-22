import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Bank, Pocket, Allocation, AppSettings } from '@/types';
import { supabase } from '@/utils/supabase/client';
import { useAuthStore } from './useAuthStore';

interface PocketRouterState {
  banks: Bank[];
  pockets: Pocket[];
  allocations: Allocation[];
  settings: AppSettings;
  isLoading: boolean;
  
  // Actions
  fetchData: () => Promise<void>;
  
  addBank: (bank: Bank) => Promise<void>;
  updateBank: (id: string, bank: Partial<Bank>) => Promise<void>;
  deleteBank: (id: string) => Promise<void>;
  
  addPocket: (pocket: Pocket) => Promise<void>;
  updatePocket: (id: string, pocket: Partial<Pocket>) => Promise<void>;
  deletePocket: (id: string) => Promise<void>;
  
  addAllocation: (allocation: Allocation) => Promise<void>;
  updateAllocation: (id: string, allocation: Partial<Allocation>) => Promise<void>;
  deleteAllocation: (id: string) => Promise<void>;
  
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
}

export const usePocketRouterStore = create<PocketRouterState>()(
  persist(
    (set, get) => ({
      banks: [],
      pockets: [],
      allocations: [],
      settings: {
        currency: 'THB',
        storageType: 'local',
      },
      isLoading: false,
      
      fetchData: async () => {
        const state = get();
        if (state.settings.storageType !== 'supabase') return;
        
        const user = useAuthStore.getState().user;
        if (!user) return; // Don't fetch from Supabase if not logged in
        
        set({ isLoading: true });
        try {
          const [
            { data: dbBanks, error: banksErr },
            { data: dbPockets, error: pocketsErr },
            { data: dbAllocations, error: allocsErr },
            { data: dbSettings, error: settingsErr }
          ] = await Promise.all([
            supabase.from('banks').select('*'),
            supabase.from('pockets').select('*'),
            supabase.from('allocations').select('*'),
            supabase.from('settings').select('*')
          ]);

          if (banksErr) throw banksErr;
          if (pocketsErr) throw pocketsErr;
          if (allocsErr) throw allocsErr;
          if (settingsErr) throw settingsErr;

          const banks: Bank[] = (dbBanks || []).map((b) => ({
            id: b.id,
            name: b.name,
            interestRate: parseFloat(b.interest_rate),
            logoUrl: b.logo_url || undefined,
            themeColor: b.theme_color,
            createdAt: b.created_at
          }));

          const pockets: Pocket[] = (dbPockets || []).map((p) => ({
            id: p.id,
            name: p.name,
            targetAmount: p.target_amount ? parseFloat(p.target_amount) : undefined,
            icon: p.icon,
            createdAt: p.created_at
          }));

          const allocations: Allocation[] = (dbAllocations || []).map((a) => ({
            id: a.id,
            pocketId: a.pocket_id,
            bankId: a.bank_id,
            amount: parseFloat(a.amount),
            createdAt: a.created_at
          }));

          const currency = dbSettings && dbSettings.length > 0 ? dbSettings[0].currency : (state.settings.currency || 'THB');
          
          set({
            banks,
            pockets,
            allocations,
            settings: {
              currency,
              storageType: 'supabase'
            },
            isLoading: false
          });
        } catch (error) {
          console.error('Error fetching data from Supabase:', error);
          set({ isLoading: false });
        }
      },
      
      addBank: async (bank) => {
        const state = get();
        const user = useAuthStore.getState().user;
        
        if (!user && state.banks.length >= 3) {
          alert('Offline mode allows a maximum of 3 banks. Please log in to add more.');
          return;
        }

        if (state.settings.storageType === 'supabase') {
          const { error } = await supabase.from('banks').insert({
            id: bank.id,
            user_id: user?.id,
            name: bank.name,
            interest_rate: bank.interestRate,
            logo_url: bank.logoUrl,
            theme_color: bank.themeColor,
            created_at: bank.createdAt
          });
          if (error) {
            console.error('Failed to add bank to Supabase:', error);
            return;
          }
        }
        set((state) => ({ banks: [...state.banks, bank] }));
      },
      
      updateBank: async (id, updatedBank) => {
        const state = get();
        if (state.settings.storageType === 'supabase') {
          const { error } = await supabase.from('banks').update({
            name: updatedBank.name,
            interest_rate: updatedBank.interestRate !== undefined ? updatedBank.interestRate : undefined,
            logo_url: updatedBank.logoUrl,
            theme_color: updatedBank.themeColor
          }).eq('id', id);
          if (error) {
            console.error('Failed to update bank in Supabase:', error);
            return;
          }
        }
        set((state) => ({
          banks: state.banks.map((b) => b.id === id ? { ...b, ...updatedBank } : b)
        }));
      },
      
      deleteBank: async (id) => {
        const state = get();
        if (state.settings.storageType === 'supabase') {
          const { error } = await supabase.from('banks').delete().eq('id', id);
          if (error) {
            console.error('Failed to delete bank from Supabase:', error);
            return;
          }
        }
        set((state) => ({
          banks: state.banks.filter((b) => b.id !== id),
          allocations: state.allocations.filter((a) => a.bankId !== id)
        }));
      },
      
      addPocket: async (pocket) => {
        const state = get();
        const user = useAuthStore.getState().user;
        
        if (!user && state.pockets.length >= 5) {
          alert('Offline mode allows a maximum of 5 pockets. Please log in to add more.');
          return;
        }

        if (state.settings.storageType === 'supabase') {
          const { error } = await supabase.from('pockets').insert({
            id: pocket.id,
            user_id: user?.id,
            name: pocket.name,
            target_amount: pocket.targetAmount,
            icon: pocket.icon,
            created_at: pocket.createdAt
          });
          if (error) {
            console.error('Failed to add pocket to Supabase:', error);
            return;
          }
        }
        set((state) => ({ pockets: [...state.pockets, pocket] }));
      },
      
      updatePocket: async (id, updatedPocket) => {
        const state = get();
        if (state.settings.storageType === 'supabase') {
          const { error } = await supabase.from('pockets').update({
            name: updatedPocket.name,
            target_amount: updatedPocket.targetAmount,
            icon: updatedPocket.icon
          }).eq('id', id);
          if (error) {
            console.error('Failed to update pocket in Supabase:', error);
            return;
          }
        }
        set((state) => ({
          pockets: state.pockets.map((p) => p.id === id ? { ...p, ...updatedPocket } : p)
        }));
      },
      
      deletePocket: async (id) => {
        const state = get();
        if (state.settings.storageType === 'supabase') {
          const { error } = await supabase.from('pockets').delete().eq('id', id);
          if (error) {
            console.error('Failed to delete pocket from Supabase:', error);
            return;
          }
        }
        set((state) => ({
          pockets: state.pockets.filter((p) => p.id !== id),
          allocations: state.allocations.filter((a) => a.pocketId !== id)
        }));
      },
      
      addAllocation: async (allocation) => {
        const state = get();
        const user = useAuthStore.getState().user;

        if (state.settings.storageType === 'supabase') {
          const { error } = await supabase.from('allocations').insert({
            id: allocation.id,
            user_id: user?.id,
            pocket_id: allocation.pocketId,
            bank_id: allocation.bankId,
            amount: allocation.amount,
            created_at: allocation.createdAt
          });
          if (error) {
            console.error('Failed to add allocation to Supabase:', error);
            return;
          }
        }
        set((state) => ({ allocations: [...state.allocations, allocation] }));
      },
      
      updateAllocation: async (id, updatedAllocation) => {
        const state = get();
        if (state.settings.storageType === 'supabase') {
          const { error } = await supabase.from('allocations').update({
            amount: updatedAllocation.amount
          }).eq('id', id);
          if (error) {
            console.error('Failed to update allocation in Supabase:', error);
            return;
          }
        }
        set((state) => ({
          allocations: state.allocations.map((a) => a.id === id ? { ...a, ...updatedAllocation } : a)
        }));
      },
      
      deleteAllocation: async (id) => {
        const state = get();
        if (state.settings.storageType === 'supabase') {
          const { error } = await supabase.from('allocations').delete().eq('id', id);
          if (error) {
            console.error('Failed to delete allocation from Supabase:', error);
            return;
          }
        }
        set((state) => ({
          allocations: state.allocations.filter((a) => a.id !== id)
        }));
      },
      
      updateSettings: async (newSettings) => {
        const state = get();
        const user = useAuthStore.getState().user;
        const updated = { ...state.settings, ...newSettings };
        
        if (updated.storageType === 'supabase' && user) {
          try {
            const { data: existing } = await supabase.from('settings').select('id');
            if (existing && existing.length > 0) {
              await supabase.from('settings').update({
                currency: updated.currency
              }).eq('id', existing[0].id);
            } else {
              await supabase.from('settings').insert({
                user_id: user.id,
                currency: updated.currency
              });
            }
          } catch (e) {
            console.error('Failed to update settings in Supabase:', e);
          }
        }
        
        set({ settings: updated });
        
        // If we just toggled to supabase, fetch all data from Supabase
        if (newSettings.storageType === 'supabase' && state.settings.storageType !== 'supabase') {
          await get().fetchData();
        }
      },
    }),
    {
      name: 'pocket-router-storage',
    }
  )
);
