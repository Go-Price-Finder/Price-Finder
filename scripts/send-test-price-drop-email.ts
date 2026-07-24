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

  const { subject, html } = renderPriceDropAlertEmail({
    productName: "Wireless Noise-Cancelling Headphones",
    productImageUrl:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=800&auto=format&fit=crop",
    oldPrice: 349,
    newPrice: 249,
    retailerName: "Amazon",
    dealUrl: "https://www.amazon.com/s?k=Wireless+Noise-Cancelling+Headphones",
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
