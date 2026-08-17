/**
 * One-off live send test for the price-drop alert email. Sends the real
 * template through the real Resend client (lib/email/resend.ts) using a
 * simulated price drop, to confirm RESEND_API_KEY actually works end to
 * end. Not part of the app itself — a manual verification tool.
 *
 * Run from the project root with your real .env.local values loaded, e.g.
 * (PowerShell):
 *   $env:RESEND_API_KEY="re_..."; $env:TEST_EMAIL_TO="you@example.com"; npx tsx scripts/send-test-price-drop-email.ts
 *
 * or (bash/macOS/Linux):
 *   RESEND_API_KEY=re_... TEST_EMAIL_TO=you@example.com npx tsx scripts/send-test-price-drop-email.ts
 */
import { resend, EMAIL_FROM } from "../lib/email/resend";
import { renderPriceDropAlertEmail } from "../lib/email/templates/priceDropAlert";
import { getAllRealProducts } from "../lib/partners";

async function main() {
  const to = process.env.TEST_EMAIL_TO;
  if (!to) {
    console.error("Set TEST_EMAIL_TO to the address to send the test email to.");
    process.exit(1);
  }
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set.");
    process.exit(1);
  }

  // A REAL catalog product, never fabricated demo data — a fabricated
  // payload with an absolute stock-photo URL is how the relative-image
  // bug shipped unnoticed (findings doc §9j), and a test send should
  // exercise exactly what production would send.
  const product = getAllRealProducts()[0];
  const { subject, html } = renderPriceDropAlertEmail({
    productName: product.name,
    productImageUrl: product.image,
    priceWhenSaved: product.price + 3,
    currentPrice: product.price,
    retailerName: product.partnerName,
    dealUrl: product.deepLink,
  });

  console.log("From:", EMAIL_FROM);
  console.log("To:", to);
  console.log("Subject:", subject);

  const result = await resend.emails.send({ from: EMAIL_FROM, to, subject, html });

  if (result.error) {
    console.error("SEND FAILED:", JSON.stringify(result.error, null, 2));
    process.exit(1);
  }

  console.log("SEND OK. Resend message id:", result.data?.id);
}

main();
