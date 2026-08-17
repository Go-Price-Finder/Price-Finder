/**
 * The price-drop notification email — sent by lib/alerts/checkPriceDrops.ts
 * when a wishlisted item's price falls to or below the target the user
 * set. Deliberately a plain string template (no @react-email or JSX)
 * since Resend just needs an `html` string — this keeps the dependency
 * list small while still being easy to preview (see
 * scripts/render-price-drop-email.ts).
 *
 * Inline styles only, with hex values pulled straight from
 * app/globals.css's @theme tokens, since email clients don't run Tailwind
 * (or any external stylesheet) — this is the one place in the codebase
 * those colors have to be duplicated as literal hex rather than a
 * `bg-sage-600`-style class.
 *
 * Two constraints found the hard way (findings doc §9j–§9k, 2026-08-17):
 * - Image URLs must be ABSOLUTE. Email clients have no base URL, so the
 *   catalog's site-relative paths render broken in every client. The
 *   origin is derived (lib/siteOrigin.ts), never hand-maintained; when no
 *   origin can be derived the image is omitted entirely rather than
 *   emitted broken.
 * - The only price-history fact available is wishlists.price_saved — the
 *   price when the user bookmarked the product. The copy claims exactly
 *   that ("when you saved it") and nothing more: no strikethrough, no
 *   percent-off badge. catalog_products.original_price is null for
 *   953/954 rows, so there is no basis for a market "was" price, and
 *   "87% off" derived from price_saved is a claim the data doesn't
 *   support.
 */
import { siteOrigin } from "@/lib/siteOrigin";

export type PriceDropEmailParams = {
  productName: string;
  productImageUrl?: string | null;
  /** wishlists.price_saved — what the product cost when the user saved it.
   * NOT a market original price; the copy must not present it as one. */
  priceWhenSaved: number;
  currentPrice: number;
  retailerName: string;
  dealUrl: string;
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function renderPriceDropAlertEmail(params: PriceDropEmailParams) {
  const { productName, productImageUrl, priceWhenSaved, currentPrice, retailerName, dealUrl } =
    params;

  // Absolute or nothing — a relative src is broken in every email client.
  // 713 of 954 catalog images are .webp, which classic desktop Outlook
  // (Word rendering engine) won't render even when absolute; accepted gap,
  // reasoning recorded in findings §9j — the alt text carries the slot.
  const origin = siteOrigin();
  const absoluteImageUrl = !productImageUrl
    ? null
    : /^https?:\/\//i.test(productImageUrl)
      ? productImageUrl
      : origin
        ? `${origin}${productImageUrl.startsWith("/") ? "" : "/"}${productImageUrl}`
        : null;

  const drop = priceWhenSaved - currentPrice;
  const subject = `Price drop: ${productName} is now ${formatUsd(currentPrice)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#faf7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf7f2;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
            <tr>
              <td style="padding-bottom:24px;text-align:center;">
                <span style="font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#3a7a46;">Go Price Finder</span>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff;border-radius:24px;box-shadow:0 8px 24px rgba(28,26,23,0.08);overflow:hidden;">
                ${
                  absoluteImageUrl
                    ? `<img src="${escapeHtml(absoluteImageUrl)}" alt="${escapeHtml(productName)}" width="480" style="width:100%;max-height:260px;object-fit:cover;display:block;" />`
                    : ""
                }
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 28px 32px;">
                  <tr>
                    <td>
                      <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#4c9459;">Price drop alert</p>
                      <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#1c1a17;font-weight:600;">${escapeHtml(productName)}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom:8px;">
                      <span style="display:block;font-size:28px;font-weight:600;color:#1c1a17;line-height:1;">${formatUsd(currentPrice)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom:22px;font-size:13px;line-height:1.5;color:#6b6660;">
                      When you saved it: ${formatUsd(priceWhenSaved)}${
                        drop > 0 ? ` — it&#39;s ${formatUsd(drop)} less now` : ""
                      }
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom:24px;font-size:13px;line-height:1.5;color:#6b6660;">
                      Now at <strong style="color:#1c1a17;">${escapeHtml(retailerName)}</strong> — at or below the price you asked to be notified about.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <a href="${escapeHtml(dealUrl)}" style="display:inline-block;background-color:#1c1a17;color:#fdfcfa;font-size:14px;font-weight:600;text-decoration:none;padding:12px 26px;border-radius:999px;">
                        View deal
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;text-align:center;">
                <p style="margin:0;font-size:12px;color:#a39d94;">
                  You're receiving this because you set a price alert on Go Price Finder.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
