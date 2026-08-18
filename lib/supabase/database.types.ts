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

// No longer dormant as of 2026-08-15 — lib/cashback/syncAwinTransactions.ts
// (the sync-cashback cron) now reads AWIN's Transactions API and writes both
// tables. See supabase/migrations/0007_add_cashback_ledger.sql for the
// original schema and 0012_add_cashback_claims_awin_transaction_id.sql for
// the dedupe key that job depends on.
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
      feed_status: {
        // Hand-edited to match migration 0016 (applied by Cowork; DDL in
        // claude/migration-0016-feed-status-STEP2.md) — same hand-edit
        // precedent as the 0015 provenance columns below.
        Row: {
          feed_id: string;
          partner_id: string;
          feed_name: string | null;
          feed_last_imported_at: string | null;
          feed_last_checked_at: string | null;
          feed_status_read_at: string | null;
          catalog_imported_at: string;
          catalog_import_ref: string | null;
          is_catalog_source: boolean;
          notes: string | null;
        };
        Insert: {
          feed_id: string;
          partner_id: string;
          feed_name?: string | null;
          feed_last_imported_at?: string | null;
          feed_last_checked_at?: string | null;
          feed_status_read_at?: string | null;
          catalog_imported_at: string;
          catalog_import_ref?: string | null;
          is_catalog_source?: boolean;
          notes?: string | null;
        };
        Update: {
          feed_id?: string;
          partner_id?: string;
          feed_name?: string | null;
          feed_last_imported_at?: string | null;
          feed_last_checked_at?: string | null;
          feed_status_read_at?: string | null;
          catalog_imported_at?: string;
          catalog_import_ref?: string | null;
          is_catalog_source?: boolean;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "feed_status_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
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
        // Provenance columns added by migration 0015 (applied 2026-08-17,
        // ~02:50 UTC, by the Cowork session; 14,293 pre-existing rows
        // backfilled price_source='legacy_pre_provenance'). All six are
        // NULLABLE by design — Cowork tightens to NOT NULL only after the
        // snapshot writer (lib/pricing/snapshotPrices.ts) proves it stamps
        // every new row. Do not tighten these types ahead of that.
        //
        // price_source is CHECK-constrained in Postgres to
        // 'live_override' | 'catalog_fallback' | 'legacy_pre_provenance'
        // (or NULL). Typed as the union so a bad literal fails tsc before
        // it fails the CHECK.
        //
        // The three feed_* columns are inert (always written NULL) until
        // feed persistence lands — the snapshot writer sets them
        // explicitly so the day they become real is a one-file change.
        Row: {
          id: string;
          product_id: string;
          retailer: Retailer;
          price: number;
          recorded_at: string;
          recorded_date: string;
          price_source:
            | "live_override"
            | "catalog_fallback"
            | "legacy_pre_provenance"
            | null;
          observed_at: string | null;
          feed_id: string | null;
          feed_last_imported_at: string | null;
          feed_last_checked_at: string | null;
          catalog_price_at_snapshot: number | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          retailer: Retailer;
          price: number;
          recorded_at?: string;
          recorded_date?: string;
          price_source?:
            | "live_override"
            | "catalog_fallback"
            | "legacy_pre_provenance"
            | null;
          observed_at?: string | null;
          feed_id?: string | null;
          feed_last_imported_at?: string | null;
          feed_last_checked_at?: string | null;
          catalog_price_at_snapshot?: number | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          retailer?: Retailer;
          price?: number;
          recorded_at?: string;
          recorded_date?: string;
          price_source?:
            | "live_override"
            | "catalog_fallback"
            | "legacy_pre_provenance"
            | null;
          observed_at?: string | null;
          feed_id?: string | null;
          feed_last_imported_at?: string | null;
          feed_last_checked_at?: string | null;
          catalog_price_at_snapshot?: number | null;
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
          // Migration 0012 — AWIN transaction id, the dedupe key
          // syncAwinTransactions.ts uses so re-polling an overlapping date
          // range (needed to catch pending -> approved/declined transitions)
          // never double-records the same transaction. Nullable: existing
          // test claims predate this column.
          awin_transaction_id: string | null;
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
          awin_transaction_id?: string | null;
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
          awin_transaction_id?: string | null;
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
      // Migration 0011 — mobile app's affiliate-link click log (see
      // Go-Price-Finder/Price-Finder-App). One row per signed-in tap on
      // "View on partner site"; click_id is the AWIN clickref subid this
      // repo's syncAwinTransactions.ts matches transactions back against.
      // user_id NOT NULL — anonymous browsing taps aren't logged at all.
      spin_results: {
        // Matches supabase/migrations/0013_add_spin_results.sql. Verified
        // against the live schema 2026-08-16 rather than transcribed from the
        // migration file, since 0013 documents a schema that was applied
        // directly via MCP rather than having produced it.
        //
        // `amount` is a Postgres `numeric`. An earlier version of this comment
        // claimed PostgREST returns numeric as a STRING — that is wrong for
        // this stack, measured 2026-08-16: catalog_products.price,
        // current_prices.price, price_history.price and rating_stars all
        // arrive as JS numbers, fractional values included (99.95 is 99.95,
        // and `0 + price` adds rather than concatenates). `number` here is
        // accurate. See lib/catalog.ts's toNumber(), whose defensive
        // conversion is harmless but whose stated rationale is the same
        // incorrect claim.
        Row: {
          id: string;
          user_id: string;
          amount: number;
          spun_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount?: number;
          spun_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          spun_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "spin_results_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      affiliate_clicks: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          retailer: Retailer;
          click_id: string;
          clicked_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          retailer: Retailer;
          click_id?: string;
          clicked_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          retailer?: Retailer;
          click_id?: string;
          clicked_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "affiliate_clicks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
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
        // Matches supabase/migrations/0008_add_catalog_products.sql, plus
        // `sort_order` from 0010_add_catalog_product_sort_order.sql — the
        // curated per-partner product order the static lib/<partner>-data.ts
        // arrays carried implicitly. NOT NULL with no default, so required on
        // Insert and optional on Update, same shape as partners.display_order.
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
          sort_order: number;
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
          sort_order: number;
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
          sort_order?: number;
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
    Functions: {
      // supabase/migrations/0013_add_spin_results.sql. SECURITY DEFINER, no
      // arguments, returns a whole spin_results row. Confirmed against the
      // live catalog 2026-08-16: pg_get_function_result -> "spin_results",
      // pg_get_function_arguments -> "" (none).
      //
      // Not called by any app code yet. Typed now so the first caller gets a
      // checked signature instead of `any` — and because CLAUDE.md's Database
      // rules require types to track every migration.
      spin_daily_reward: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["spin_results"]["Row"];
      };
    };
    Enums: {
      retailer: Retailer;
    };
  };
};
