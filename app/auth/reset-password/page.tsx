import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ResetPasswordForm from "@/components/ResetPasswordForm";

/**
 * Where a password-reset link ultimately lands: the emailed link hits
 * Supabase's verify endpoint, which redirects to /auth/callback?next=
 * /auth/reset-password; the callback exchanges the code for a live
 * recovery session and forwards here. The form's server action
 * (updatePasswordAction) requires that session — arriving without one
 * (expired or reused link) gets a clear error pointing back to
 * /auth/forgot-password.
 */
export default function ResetPasswordPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <ResetPasswordForm />
        </section>
      </main>
      <Footer />
    </>
  );
}
