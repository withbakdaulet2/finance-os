// HAND-WRITTEN to mirror supabase/migrations (V1). Same shape as the output of
// `supabase gen types typescript`, so it can be replaced by the generated file later.
//
// Deliberate differences from a generated file: Insert/Update types list only the
// columns the database lets a client write (column privileges), so the type system
// refuses what the database would refuse anyway:
//  - accounts: no current_balance (migration 20261002000000).
//  - transactions: no is_opening_balance; Update only type/amount/accounts/
//    category_id/occurred_on/note (migration 20261002120000).
//  - categories: Insert only user_id/name/type, Update only name; is_system and
//    parent_id are not client-writable (migration 20261002130000).
//  - Numeric columns are `number`, which is what PostgREST returns for numeric(14,2).
//    That is exact for this range (<= 12 integer digits); never do money arithmetic
//    on it in the client, only display it.
//
// Keep in sync with the migrations by hand until types are generated.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type:
            | "cash"
            | "bank"
            | "emergency_fund"
            | "investment"
            | "umrah_fund"
            | "business_fund"
            | "other";
          current_balance: number;
          is_archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type:
            | "cash"
            | "bank"
            | "emergency_fund"
            | "investment"
            | "umrah_fund"
            | "business_fund"
            | "other";
          is_archived?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?:
            | "cash"
            | "bank"
            | "emergency_fund"
            | "investment"
            | "umrah_fund"
            | "business_fund"
            | "other";
          is_archived?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: "income" | "expense" | "capital";
          parent_id: string | null;
          is_system: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: "income" | "expense" | "capital";
          created_at?: string;
        };
        Update: {
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: "income" | "expense" | "capital_allocation";
          amount: number;
          account_id: string;
          target_account_id: string | null;
          category_id: string | null;
          occurred_on: string;
          note: string | null;
          // true only for the income row create_account writes as an account's
          // starting balance. Period totals (Income/Expenses/Capital/Free Cash,
          // Analytics, Monthly Report) must exclude it. Filter on this flag, not on note.
          is_opening_balance: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: "income" | "expense" | "capital_allocation";
          amount: number;
          account_id: string;
          target_account_id?: string | null;
          category_id?: string | null;
          occurred_on?: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          // type/amount/account columns are writable by privilege but a trigger
          // rejects changing them in V1: only note, category_id, occurred_on really change.
          type?: "income" | "expense" | "capital_allocation";
          amount?: number;
          account_id?: string;
          target_account_id?: string | null;
          category_id?: string | null;
          occurred_on?: string;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_target_account_id_fkey";
            columns: ["target_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      // transactions without the opening-balance rows (security_invoker, read-only).
      // Every period total must be built on this, never on `transactions` directly.
      activity_transactions: {
        Row: Database["public"]["Tables"]["transactions"]["Row"];
        Relationships: [];
      };
    };
    Functions: {
      // Totals over [p_from, p_to_exclusive), opening balances excluded, summed in
      // Postgres numeric. Returns exactly one row. Values arrive as JSON numbers.
      period_summary: {
        Args: { p_from: string; p_to_exclusive: string };
        Returns: {
          income: number;
          expenses: number;
          capital: number;
          free_cash: number;
        }[];
      };
      create_account: {
        Args: {
          p_name: string;
          p_type: string;
          p_opening_balance?: number | string;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
