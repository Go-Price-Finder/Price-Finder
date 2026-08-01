// Hand-authored to match supabase/migrations/0001_initial_schema.sql.
//
// Once you have a live Supabase project, you can regenerate this file from
// the real database instead of maintaining it by hand:
//
//   npx supabase gen types typescript --project-id <your-project-ref> \
//     > lib/supabase/database.types.ts
//
// Keep the shape (Database.public.Tables/Views/Functions/Enums) if you do —
// it's what `@supabase/supabase-js`'s `SupabaseClient<Database>` and
// `createClient<Database>()` in client.ts / server.ts expect, right down to
// each table needing a `Relationships` array (used to type embedded
// resource queries like `.select("*, products(*)")`).

export type Retailer =
  | "amazon"
  | "walmart"
  | "etsy"
  | "target"
  | "ebay"
  | "brooklyn-delhi"
  | "evdance"
  | "golden-maple"
  | "canvas-vows"
  | "king-koil"
  | "tsar-bomba";

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          category?: string | null;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string | null;
          image_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      wishlists: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          retailer: Retailer;
          price_saved: number;
          target_price: number | null;
          alert_sent: boolean;
          alert_sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          retailer: Retailer;
          price_saved: number;
          target_price?: number | null;
          alert_sent?: boolean;
          alert_sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          retailer?: Retailer;
          price_saved?: number;
          target_price?: number | null;
          alert_sent?: boolean;
          alert_sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wishlists_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wishlists_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      purchases: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          retailer: Retailer;
          amount_spent: number;
          purchased_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          retailer: Retailer;
          amount_spent: number;
          purchased_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          retailer?: Retailer;
          amount_spent?: number;
          purchased_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchases_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchases_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      user_spending_summary: {
        Row: {
          user_id: string | null;
          purchase_count: number | null;
          total_spent: number | null;
          first_purchase_at: string | null;
          last_purchase_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      retailer: Retailer;
    };
  };
};
