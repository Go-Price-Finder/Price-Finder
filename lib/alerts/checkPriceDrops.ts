import { createAdminClient } from "@/lib/supabase/admin";
import { resend, EMAIL_FROM } from "@/lib/email/resend";
import { renderPriceDropAlertEmail } from "@/lib/email/templates/priceDropAlert";
import { getAllRealProductsWithLivePrices } from "@/lib/pricing/getEffectivePrice";
import { evaluateAlertState } from "./evaluateAlertState";

export type CheckPriceDropsResult = {
  checked: number;
  sent: number;
  reset: number;
  errors: { wishlistId: string; message: string }[];
};

/**
 * The daily price-drop job — triggered by
 * app/api/cron/check-price-alerts/route.ts (Vercel Cron, once a day).
 *
 * For every wishlist row with a target_price set:
 *   1. Look up the product's current price.
 *   2. Ask evaluateAlertState() what to do (send / reset / nothing).
 *   3. Send the email and mark alert_sent = true, or reset alert_sent back
 *      to false if the price has climbed back above target since the last
 *      alert.
 *
 * Runs with the service-role client (lib/supabase/admin.ts) since it has
 * to read and update every user's rows, not just one signed-in caller's.
 *
 * "Current price" reads the real partner catalog (lib/partners.ts),
 * overridden by any live row in public.current_prices via
 * getAllRealProductsWithLivePrices() (see lib/pricing/getEffectivePrice.ts)
 * — so once the AWIN feed-ingestion cron exists and starts writing to that
 * table, alerts fire against genuinely fresh prices with no further change
 * needed here. Until then it's equivalent to the static catalog price,
 * refreshed whenever that partner's feed is re-imported by hand. A
 * wishlist row whose product isn't found there (e.g. it pre-dates the
 * real-partner wishlist rollout, or referenced a delisted product) is
 * skipped, same as any other "no price data for this product" case.
 */
export async function checkPriceDrops(): Promise<CheckPriceDropsResult> {
  const supabase = createAdminClient();

  const { data: rows, error } = await supabase
    .from("wishlists")
    .select("id, product_id, retailer, price_saved, target_price, alert_sent, users(email)")
    .not("target_price", "is", null);

  if (error) throw error;

  const products = await getAllRealProductsWithLivePrices();
  const result: CheckPriceDropsResult = { checked: 0, sent: 0, reset: 0, errors: [] };

  for (const row of rows ?? []) {
    result.checked += 1;

    const product = products.find((p) => p.id === row.product_id);
    if (!product) continue; // no price data for this product (yet)

    const decision = evaluateAlertState({
      targetPrice: row.target_price,
      currentPrice: product.price,
      alertSent: row.alert_sent,
    });

    try {
      if (decision.action === "send") {
        const email = row.users?.email;
        if (!email) continue; // shouldn't happen — every wishlist row has a user

        const { subject, html } = renderPriceDropAlertEmail({
          productName: product.name,
          productImageUrl: product.image,
          priceWhenSaved: row.price_saved,
          currentPrice: product.price,
          retailerName: product.partnerName,
          dealUrl: product.deepLink,
        });

        const { error: sendError } = await resend.emails.send({
          from: EMAIL_FROM,
          to: email,
          subject,
          html,
        });
        if (sendError) throw new Error(sendError.message);

        const { error: updateError } = await supabase
          .from("wishlists")
          .update({ alert_sent: true, alert_sent_at: new Date().toISOString() })
          .eq("id", row.id);
        if (updateError) throw updateError;

        result.sent += 1;
      } else if (decision.action === "reset") {
        const { error: updateError } = await supabase
          .from("wishlists")
          .update({ alert_sent: false, alert_sent_at: null })
          .eq("id", row.id);
        if (updateError) throw updateError;

        result.reset += 1;
      }
    } catch (err) {
      result.errors.push({
        wishlistId: row.id,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return result;
}
