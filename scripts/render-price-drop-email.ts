/**
 * Renders the price-drop alert email to a static HTML file for a visual
 * check, using a simulated price drop (Wireless Noise-Cancelling
 * Headphones, saved at $349, "dropped" to $249 against a $260 target) —
 * standing in for a live price feed per Step 6 of the price-drop-alert
 * build (no real feed exists yet).
 *
 * Run with: npx tsx scripts/render-price-drop-email.ts
 */
import { writeFileSync } from "node:fs";
import { renderPriceDropAlertEmail } from "../lib/email/templates/priceDropAlert";

const { subject, html } = renderPriceDropAlertEmail({
  productName: "Wireless Noise-Cancelling Headphones",
  productImageUrl:
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=800&auto=format&fit=crop",
  oldPrice: 349,
  newPrice: 249,
  retailerName: "Amazon",
  dealUrl: "https://www.amazon.com/s?k=Wireless+Noise-Cancelling+Headphones",
});

console.log("Subject:", subject);
writeFileSync("/tmp/price-drop-email.html", html, "utf-8");
console.log("Wrote /tmp/price-drop-email.html");
