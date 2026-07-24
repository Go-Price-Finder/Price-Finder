import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PurchaseHistoryTable from "@/components/PurchaseHistoryTable";
import LoyaltyTierCard from "@/components/LoyaltyTierCard";
import { createClient } from "@/lib/supabase/server";
import { getPurchasesByUser, getUserSpendingSummary } from "@/lib/supabase/queries";
import { formatLongDate, formatPrice } from "@/lib/data";
import { ChevronRightIcon, StoreIcon, TagIcon, TrendingUpIcon } from "@/components/icons";

const formatDate = formatLongDate;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const [profileResult, summary, purchases] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).maybeSingle(),
    getUserSpendingSummary(supabase, user.id),
    getPurchasesByUser(supabase, user.id),
  ]);

  const profile = profileResult.data;
  const email = profile?.email ?? user.email ?? "";
  const memberSince = profile?.created_at ?? user.created_at;

  const stats = [
    {
      icon: TagIcon,
      value: formatPrice(summary?.total_spent ?? 0),
      label: "Total spent",
      isPrice: true,
    },
    {
      icon: StoreIcon,
      value: String(summary?.purchase_count ?? 0),
      label: "Purchases",
      isPrice: false,
    },
    {
      icon: TrendingUpIcon,
      value: summary?.last_purchase_at ? formatDate(summary.last_purchase_at) : "—",
      label: "Last purchase",
      isPrice: false,
    },
  ];

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          {/* Profile card */}
          <div className="mb-10 flex flex-col items-start gap-5 rounded-3xl border border-gilt-500/20 bg-noir-800 p-6 shadow-soft sm:flex-row sm:items-center sm:p-8">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gilt-500/15 font-display text-2xl font-medium text-gilt-400">
              {email.charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
                Your account
              </span>
              <h1 className="mt-1 font-display text-2xl font-medium text-ivory-50 sm:text-3xl">
                {email}
              </h1>
              <p className="mt-1 text-sm text-ivory-300">
                Member since {formatDate(memberSince)}
              </p>
            </div>
          </div>

          {/* Loyalty tier */}
          <LoyaltyTierCard totalSpent={summary?.total_spent ?? 0} />

          {/* Spending stats */}
          <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map(({ icon: Icon, value, label, isPrice }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 rounded-2xl border border-gilt-500/20 bg-noir-800 px-4 py-6 text-center shadow-soft transition-transform duration-300 hover:-translate-y-1"
              >
                <Icon className="h-6 w-6 text-gilt-400" />
                <span
                  className={`font-display text-xl font-medium sm:text-2xl ${
                    isPrice ? "text-price-text" : "text-ivory-50"
                  }`}
                >
                  {value}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-ivory-300 sm:text-xs">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Purchase history */}
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-display text-xl font-medium text-ivory-50">
                Purchase history
              </h2>
              {purchases.length > 0 && (
                <Link
                  href="/purchases"
                  className="group inline-flex items-center gap-1 text-sm font-medium text-gilt-400 transition-colors hover:text-gilt-300"
                >
                  View all
                  <ChevronRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              )}
            </div>

            <PurchaseHistoryTable purchases={purchases.slice(0, 5)} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
