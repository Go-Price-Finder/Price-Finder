import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PurchaseHistoryTable from "@/components/PurchaseHistoryTable";
import { createClient } from "@/lib/supabase/server";
import { getPurchasesByUser } from "@/lib/supabase/queries";
import { ChevronRightIcon } from "@/components/icons";

export default async function PurchasesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirectedFrom=/purchases");
  }

  const purchases = await getPurchasesByUser(supabase, user.id);

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Link
                href="/dashboard"
                className="group mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-gilt-400 transition-colors hover:text-gilt-300"
              >
                <ChevronRightIcon className="h-3.5 w-3.5 rotate-180" />
                Dashboard
              </Link>
              <h1 className="font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
                Purchase history
              </h1>
              <p className="mt-2 text-sm text-ivory-300">
                {purchases.length === 0
                  ? "Nothing recorded yet."
                  : `${purchases.length} purchase${purchases.length === 1 ? "" : "s"}, most recent first.`}
              </p>
            </div>
          </div>

          <PurchaseHistoryTable purchases={purchases} />
        </section>
      </main>
      <Footer />
    </>
  );
}
