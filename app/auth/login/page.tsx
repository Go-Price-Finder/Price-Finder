import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AuthForm from "@/components/AuthForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    confirm?: string;
    error?: string;
    redirectedFrom?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          {params.confirm === "1" && (
            <div className="mx-auto mb-6 max-w-md rounded-2xl border border-gilt-500/30 bg-gilt-500/10 px-4 py-3 text-center text-sm text-gilt-400">
              Check your email to confirm your account, then log in below.
            </div>
          )}
          {params.error === "confirmation-failed" && (
            <div className="mx-auto mb-6 max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
              That confirmation link is invalid or has expired. Please sign
              up again or try logging in.
            </div>
          )}
          <AuthForm mode="login" redirectTo={params.redirectedFrom} />
        </section>
      </main>
      <Footer />
    </>
  );
}
