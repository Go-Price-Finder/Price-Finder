import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Retailer } from "./database.types";

type TypedClient = SupabaseClient<Database>;

/**
 * Typed query helpers built on the schema in
 * supabase/migrations/0001_initial_schema.sql. Each one takes an already
 * -created client (from lib/supabase/client.ts or lib/supabase/server.ts)
 * so it works the same from a Client Component, a Server Component, or a
 * Route Handler.
 */

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

/** All purchases by a user, most recent first, with product details joined in. */
export async function getPurchasesByUser(supabase: TypedClient, userId: string) {
  const { data, error } = await supabase
    .from("purchases")
    .select("id, retailer, amount_spent, purchased_at, products(id, name, image_url)")
    .eq("user_id", userId)
    .order("purchased_at", { ascending: false });

  if (error) throw error;
  return data;
}

/** Total spend, purchase count, and first/last purchase date for a user. */
export async function getUserSpendingSummary(supabase: TypedClient, userId: string) {
  const { data, error } = await supabase
    .from("user_spending_summary")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function recordPurchase(
  supabase: TypedClient,
  purchase: {
    userId: string;
    productId: string;
    retailer: Retailer;
    amountSpent: number;
  }
) {
  const { data, error } = await supabase
    .from("purchases")
    .insert({
      user_id: purchase.userId,
      product_id: purchase.productId,
      retailer: purchase.retailer,
      amount_spent: purchase.amountSpent,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Wishlists
// ---------------------------------------------------------------------------

/** A user's saved items, newest first, with product details joined in. */
export async function getWishlistByUser(supabase: TypedClient, userId: string) {
  const { data, error } = await supabase
    .from("wishlists")
    .select(
      "id, retailer, price_saved, target_price, alert_sent, alert_sent_at, created_at, products(id, name, image_url, category)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/** Save a product+retailer to a user's wishlist (updates price_saved if already saved). */
export async function addToWishlist(
  supabase: TypedClient,
  item: { userId: string; productId: string; retailer: Retailer; priceSaved: number }
) {
  const { data, error } = await supabase
    .from("wishlists")
    .upsert(
      {
        user_id: item.userId,
        product_id: item.productId,
        retailer: item.retailer,
        price_saved: item.priceSaved,
      },
      { onConflict: "user_id,product_id,retailer" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeFromWishlist(
  supabase: TypedClient,
  item: { userId: string; productId: string; retailer: Retailer }
) {
  const { error } = await supabase
    .from("wishlists")
    .delete()
    .match({
      user_id: item.userId,
      product_id: item.productId,
      retailer: item.retailer,
    });

  if (error) throw error;
}

/**
 * Sets (or clears, when `targetPrice` is null) the price-drop alert
 * threshold on an existing wishlist row. The database trigger added in
 * migrations/0003_add_target_price.sql resets `alert_sent` back to false
 * whenever target_price actually changes, so a user editing this after
 * already receiving an alert is automatically eligible for a new one.
 */
export async function setWishlistTargetPrice(
  supabase: TypedClient,
  item: { userId: string; productId: string; retailer: Retailer; targetPrice: number | null }
) {
  const { data, error } = await supabase
    .from("wishlists")
    .update({ target_price: item.targetPrice })
    .match({
      user_id: item.userId,
      product_id: item.productId,
      retailer: item.retailer,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
