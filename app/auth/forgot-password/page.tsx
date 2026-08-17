import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <ForgotPasswordForm />
        </section>
      </main>
      <Footer />
    </>
  );
}
