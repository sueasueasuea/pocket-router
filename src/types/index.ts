export interface Bank {
  id: string; // UUID
  user_id?: string;
  name: string;
  interestRate: number; // e.g., 1.5 for 1.5%
  logoUrl?: string; // URL to logo or image
  themeColor: string; // Hex color code for UI
  createdAt: string;
  order?: number; // User-defined display order (lower = first)
}

export interface Pocket {
  id: string; // UUID
  user_id?: string;
  name: string;
  targetAmount?: number; // Optional: Pockets can exist without a target amount
  icon: string; // Emoji or icon name string
  createdAt: string;
  order?: number; // User-defined display order (lower = first)
}

export interface Allocation {
  id: string; // UUID
  user_id?: string;
  pocketId: string;
  bankId: string;
  amount: number;
  createdAt: string;
}

export interface AppSettings {
  user_id?: string;
  currency: string;
  storageType?: 'local' | 'supabase';
}

// Derived Types for Dashboard Display
export interface PocketSummary extends Pocket {
  currentAmount: number;
  allocations: (Allocation & { bank: Bank })[];
}

export interface BankSummary extends Bank {
  currentAmount: number;
  allocations: (Allocation & { pocket: Pocket })[];
  estimatedAnnualInterest: number;
}

// Re-export invite / sharing domain so consumers can keep using
// `@/types` as a single barrel.
export * from './invite';
