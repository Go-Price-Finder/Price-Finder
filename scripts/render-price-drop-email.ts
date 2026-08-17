/**
 * Renders the price-drop alert email to a static HTML file for a visual
 * check, using a REAL catalog product — never fabricated demo data. The
 * 2026-07-23 test send used an invented headphones product with an
 * absolute Unsplash image, which is exactly why the relative-image bug
 * shipped unnoticed: the only rendering anyone inspected was the one
 * that couldn't exhibit it (findings doc §9j).
 *
 * Run with: npx tsx scripts/render-price-drop-email.ts
 */
import { writeFileSync } from "node:fs";
import { renderPriceDropAlertEmail } from "../lib/email/templates/priceDropAlert";
import { getAllRealProducts } from "../lib/partners";

const product = getAllRealProducts()[0];

const { subject, html } = renderPriceDropAlertEmail({
  productName: product.name,
  productImageUrl: product.image,
  priceWhenSaved: product.price + 3, // simulate having saved it at a higher price
  currentPrice: product.price,
  retailerName: product.partnerName,
  dealUrl: product.deepLink,
});

console.log("Subject:", subject);
writeFileSync("/tmp/price-drop-email.html", html, "utf-8");
console.log("Wrote /tmp/price-drop-email.html");
