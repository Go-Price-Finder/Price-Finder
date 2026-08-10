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

// Dormant as of 2026-08-02 — see supabase/migrations/0007_add_cashback_ledger.sql.
// No app code reads/writes cashback_claims or cashback_ledger_entries yet;
// these types exist so Phase 2 doesn't start from zero.
export type CashbackVertical = "products" | "gift_cards" | "hotels";
export type CashbackStatus = "pending" | "available" | "redeemed" | "reversed";

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
      current_prices: {
        Row: {
          product_id: string;
          retailer: Retailer;
          price: number;
          original_price: number | null;
          source: string;
          updated_at: string;
        };
        Insert: {
          product_id: string;
          retailer: Retailer;
          price: number;
          original_price?: number | null;
          source?: string;
          updated_at?: string;
        };
        Update: {
          product_id?: string;
          retailer?: Retailer;
          price?: number;
          original_price?: number | null;
          source?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "current_prices_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      price_history: {
        Row: {
          id: string;
          product_id: string;
          retailer: Retailer;
          price: number;
          recorded_at: string;
          recorded_date: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          retailer: Retailer;
          price: number;
          recorded_at?: string;
          recorded_date?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          retailer?: Retailer;
          price?: number;
          recorded_at?: string;
          recorded_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      cashback_claims: {
        Row: {
          id: string;
          user_id: string;
          vertical: CashbackVertical;
          retailer: Retailer;
          product_id: string | null;
          purchase_id: string | null;
          order_amount: number;
          cashback_amount: number;
          click_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vertical: CashbackVertical;
          retailer: Retailer;
          product_id?: string | null;
          purchase_id?: string | null;
          order_amount: number;
          cashback_amount: number;
          click_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          vertical?: CashbackVertical;
          retailer?: Retailer;
          product_id?: string | null;
          purchase_id?: string | null;
          order_amount?: number;
          cashback_amount?: number;
          click_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cashback_claims_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cashback_claims_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: false;
            referencedRelation: "purchases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cashback_claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      cashback_ledger_entries: {
        Row: {
          id: string;
          claim_id: string;
          status: CashbackStatus;
          amount: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          claim_id: string;
          status: CashbackStatus;
          amount: number;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          claim_id?: string;
          status?: CashbackStatus;
          amount?: number;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cashback_ledger_entries_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "cashback_claims";
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
      partners: {
        // Matches supabase/migrations/0008_add_catalog_products.sql —
        // mirrors lib/partners.ts's Partner type minus `products` (that
        // relationship is catalog_products.partner_id instead of a nested
        // array). See lib/catalog.ts (Step 12 of the catalog/search/
        // onboarding migration).
        //
        // `display_order` added by 0009_add_partner_display_order.sql — the
        // curated partner ordering that lib/partners.ts's PARTNERS array
        // encoded implicitly. NOT NULL with no default, so it is required on
        // Insert (not optional): a new partner must be given an explicit
        // slot rather than defaulting into one.
        Row: {
          id: string;
          name: string;
          tagline: string;
          href: string;
          logo_url: string | null;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          tagline: string;
          href: string;
          logo_url?: string | null;
          display_order: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          tagline?: string;
          href?: string;
          logo_url?: string | null;
          display_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      catalog_products: {
        // Matches supabase/migrations/0008_add_catalog_products.sql.
        // `price`/`original_price`/`rating_stars` are Postgres `numeric`
        // columns — PostgREST returns these as strings, not JS numbers, to
        // avoid float-precision loss; every reader in lib/catalog.ts must
        // explicitly Number()-convert them, never assume the wire type
        // matches the RealProduct.price: number contract.
        Row: {
          id: string;
          partner_id: string;
          slug: string;
          name: string;
          description: string;
          price: string;
          original_price: string | null;
          image: string;
          images: string[];
          category: string;
          parent_category: string;
          badge: string | null;
          rating_stars: string | null;
          rating_count: number | null;
          deep_link: string;
          variant_label: string | null;
          search_vector: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          partner_id: string;
          slug: string;
          name: string;
          description: string;
          price: number;
          original_price?: number | null;
          image: string;
          images?: string[];
          category: string;
          parent_category: string;
          badge?: string | null;
          rating_stars?: number | null;
          rating_count?: number | null;
          deep_link: string;
          variant_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          partner_id?: string;
          slug?: string;
          name?: string;
          description?: string;
          price?: number;
          original_price?: number | null;
          image?: string;
          images?: string[];
          category?: string;
          parent_category?: string;
          badge?: string | null;
          rating_stars?: number | null;
          rating_count?: number | null;
          deep_link?: string;
          variant_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_products_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
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
